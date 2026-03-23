import { createHash } from "node:crypto";
import {
  getDashboard,
  getDashboardByWidgetId,
  getTextBlock,
  getWidget,
  getWidgetFiles,
  upsertWidget,
} from "@/db/widgets";
import { buildWidget, rebuildWidget } from "@/lib/widget-runner";
import {
  deriveShareId,
  getDashboardStreamId,
  getPublishedWidgetId,
  SHARE_BUCKET,
} from "@/lib/share";
import {
  getRequiredRiverrunClient,
} from "@/lib/riverrun";
import {
  isDashboardLiveEventV1,
  isDashboardSharedStateV1,
  type DashboardLiveEventV1,
  type DashboardSharedStateV1,
  type PublishedCanvasLayout,
} from "@/lib/share-types";
import {
  DEFAULT_CANVAS_VIEWPORT,
  isCanvasViewportSnapshot,
  normalizeCanvasViewport,
  type CanvasViewportSnapshot,
} from "@/lib/canvas-viewport";

export type LiveDashboardBootstrapResult =
  | {
      status: "ready";
      state: DashboardSharedStateV1;
      nextOffset: string | null;
    }
  | {
      status: "unavailable";
    }
  | {
      status: "backend_unavailable";
      message: string;
    };

interface AppendDashboardStateOptions {
  force?: boolean;
  waitForBuild?: boolean;
}

interface AppendDashboardStateResult {
  shareId: string;
  state: DashboardSharedStateV1;
  nextOffset: string | null;
  skipped: boolean;
}

const dashboardWriteLocks = new Map<string, Promise<void>>();
const dashboardStreamEnsures = new Map<string, Promise<void>>();
const knownDashboardStateHashes = new Map<string, string | null>();
const liveAppendTimers = new Map<string, ReturnType<typeof setTimeout>>();

export interface DashboardPublishTextBlockSource {
  id: string;
  text: string;
  fontSize: number;
  layout: PublishedCanvasLayout;
}

export interface DashboardPublishWidgetSource {
  id: string;
  title: string;
  description: string;
  layout: PublishedCanvasLayout;
  files: Record<string, string>;
  messages?: unknown[];
}

export interface DashboardPublishSource {
  dashboardId: string;
  title: string;
  viewport: CanvasViewportSnapshot;
  widgets: DashboardPublishWidgetSource[];
  textBlocks: DashboardPublishTextBlockSource[];
}

function parseStringArray(value: string | null | undefined) {
  if (!value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function parseLayout(
  value: string | null | undefined,
  fallback: PublishedCanvasLayout,
): PublishedCanvasLayout {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value) as Partial<PublishedCanvasLayout>;
    return {
      x: typeof parsed.x === "number" ? parsed.x : fallback.x,
      y: typeof parsed.y === "number" ? parsed.y : fallback.y,
      w: typeof parsed.w === "number" ? parsed.w : fallback.w,
      h: typeof parsed.h === "number" ? parsed.h : fallback.h,
    };
  } catch {
    return fallback;
  }
}

function parseViewport(value: string | null | undefined) {
  if (!value) {
    return DEFAULT_CANVAS_VIEWPORT;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isCanvasViewportSnapshot(parsed)
      ? normalizeCanvasViewport(parsed)
      : DEFAULT_CANVAS_VIEWPORT;
  } catch {
    return DEFAULT_CANVAS_VIEWPORT;
  }
}

function sortStringRecord(value: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function hashString(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildWidgetRevision(files: Record<string, string>) {
  return hashString(JSON.stringify(sortStringRecord(files))).slice(0, 16);
}

export function buildDashboardStateContentHash(state: DashboardSharedStateV1) {
  const { updatedAt, ...stableState } = state;
  void updatedAt;
  return hashString(JSON.stringify(stableState));
}

async function ensureDashboardStream(shareId: string) {
  const existing = dashboardStreamEnsures.get(shareId);
  if (existing) {
    return existing;
  }

  const ensureTask = (async () => {
    const riverrun = getRequiredRiverrunClient();
    await riverrun.createStream(SHARE_BUCKET, getDashboardStreamId(shareId));
  })();

  dashboardStreamEnsures.set(shareId, ensureTask);

  try {
    await ensureTask;
  } catch (err) {
    if (dashboardStreamEnsures.get(shareId) === ensureTask) {
      dashboardStreamEnsures.delete(shareId);
    }
    throw err;
  }
}

async function withDashboardWriteLock<T>(
  shareId: string,
  task: () => Promise<T>,
): Promise<T> {
  const previous = dashboardWriteLocks.get(shareId) ?? Promise.resolve();
  const nextTask = previous.catch(() => {}).then(task);
  const nextLock = nextTask.then(
    () => undefined,
    () => undefined,
  );

  dashboardWriteLocks.set(shareId, nextLock);

  try {
    return await nextTask;
  } finally {
    if (dashboardWriteLocks.get(shareId) === nextLock) {
      dashboardWriteLocks.delete(shareId);
    }
  }
}

export function buildDashboardSharedState(
  source: DashboardPublishSource,
  shareId: string,
  updatedAt = new Date().toISOString(),
): DashboardSharedStateV1 {
  return {
    version: "v1",
    shareId,
    dashboardId: source.dashboardId,
    title: source.title,
    updatedAt,
    viewport: source.viewport,
    textBlocks: source.textBlocks.map((textBlock) => ({
      id: textBlock.id,
      text: textBlock.text,
      fontSize: textBlock.fontSize,
      layout: textBlock.layout,
    })),
    widgets: source.widgets.map((widget) => {
      const files = sortStringRecord(widget.files);
      return {
        sourceWidgetId: widget.id,
        publishedWidgetId: getPublishedWidgetId(shareId, widget.id),
        revision: buildWidgetRevision(files),
        title: widget.title,
        description: widget.description,
        layout: widget.layout,
        files,
      };
    }),
  };
}

function buildDashboardLiveEvent(
  state: DashboardSharedStateV1,
  stateHash = buildDashboardStateContentHash(state),
): DashboardLiveEventV1 {
  return {
    version: "v1",
    kind: "dashboard-state",
    shareId: state.shareId,
    dashboardId: state.dashboardId,
    at: state.updatedAt,
    stateHash,
    state,
  };
}

export function loadDashboardPublishSource(dashboardId: string): DashboardPublishSource {
  const dashboard = getDashboard(dashboardId);
  if (!dashboard) {
    throw new Error(`Dashboard not found: ${dashboardId}`);
  }

  const widgetIds = parseStringArray(dashboard.widgetIdsJson);
  const textBlockIds = parseStringArray(dashboard.textBlockIdsJson);

  const widgets = widgetIds.flatMap((widgetId) => {
    const widget = getWidget(widgetId);
    if (!widget) {
      return [];
    }

    return [{
      id: widget.id,
      title: widget.title,
      description: widget.description,
      layout: parseLayout(widget.layoutJson, { x: 0, y: 0, w: 4, h: 3 }),
      files: getWidgetFiles(widgetId),
    }];
  });

  const textBlocks = textBlockIds.flatMap((textBlockId) => {
    const textBlock = getTextBlock(textBlockId);
    if (!textBlock) {
      return [];
    }

    return [{
      id: textBlock.id,
      text: textBlock.text,
      fontSize: textBlock.fontSize,
      layout: parseLayout(textBlock.layoutJson, { x: 0, y: 0, w: 3, h: 1 }),
    }];
  });

  return {
    dashboardId: dashboard.id,
    title: dashboard.title,
    viewport: parseViewport(dashboard.viewportJson),
    widgets,
    textBlocks,
  };
}

async function materializePublishedWidgets(
  state: DashboardSharedStateV1,
  {
    waitForBuild,
  }: {
    waitForBuild: boolean;
  },
) {
  for (const widget of state.widgets) {
    const code = widget.files["src/App.tsx"] ?? null;
    const existingPublishedWidget = getWidget(widget.publishedWidgetId);
    const nextFilesJson = JSON.stringify(widget.files);
    const filesChanged = existingPublishedWidget?.filesJson !== nextFilesJson;

    upsertWidget({
      id: widget.publishedWidgetId,
      title: widget.title,
      description: widget.description,
      code,
      filesJson: nextFilesJson,
      layoutJson: JSON.stringify(widget.layout),
      messagesJson: JSON.stringify([]),
    });

    if (!filesChanged || !code) {
      continue;
    }

    if (waitForBuild) {
      await buildWidget(widget.publishedWidgetId);
    } else {
      rebuildWidget(widget.publishedWidgetId).catch((err) => {
        console.error(`[share-dashboard] Failed to rebuild ${widget.publishedWidgetId}:`, err);
      });
    }
  }
}

async function lookupCurrentDashboardStateHash(shareId: string) {
  if (knownDashboardStateHashes.has(shareId)) {
    return knownDashboardStateHashes.get(shareId) ?? null;
  }

  const bootstrap = await bootstrapLiveDashboardState(shareId);
  const stateHash = bootstrap.status === "ready"
    ? buildDashboardStateContentHash(bootstrap.state)
    : null;
  knownDashboardStateHashes.set(shareId, stateHash);
  return stateHash;
}

async function appendDashboardState(
  dashboardId: string,
  {
    force = false,
    waitForBuild = false,
  }: AppendDashboardStateOptions = {},
): Promise<AppendDashboardStateResult> {
  const shareId = deriveShareId(dashboardId);
  const state = buildDashboardSharedState(loadDashboardPublishSource(dashboardId), shareId);
  await materializePublishedWidgets(state, { waitForBuild });

  return withDashboardWriteLock(shareId, async () => {
    const dashboardStreamId = getDashboardStreamId(shareId);
    const stateHash = buildDashboardStateContentHash(state);

    await ensureDashboardStream(shareId);

    const previousHash = force ? null : await lookupCurrentDashboardStateHash(shareId);
    if (!force && previousHash === stateHash) {
      return {
        shareId,
        state,
        nextOffset: null,
        skipped: true,
      };
    }

    const riverrun = getRequiredRiverrunClient();
    const { nextOffset } = await riverrun.appendJson(
      SHARE_BUCKET,
      dashboardStreamId,
      buildDashboardLiveEvent(state, stateHash),
    );

    knownDashboardStateHashes.set(shareId, stateHash);

    return {
      shareId,
      state,
      nextOffset,
      skipped: false,
    };
  });
}

export async function appendLiveDashboardState(dashboardId: string) {
  return appendDashboardState(dashboardId);
}

export function scheduleLiveDashboardAppend(
  dashboardId: string,
  delayMs = 250,
) {
  const existingTimer = liveAppendTimers.get(dashboardId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    liveAppendTimers.delete(dashboardId);
    void appendDashboardState(dashboardId).catch((err) => {
      console.error(`[share-dashboard] Failed to append live state for ${dashboardId}:`, err);
    });
  }, delayMs);

  liveAppendTimers.set(dashboardId, timer);
}

export function scheduleLiveDashboardAppendForWidget(
  widgetId: string,
  delayMs = 250,
) {
  const dashboard = getDashboardByWidgetId(widgetId);
  if (!dashboard) {
    return;
  }

  scheduleLiveDashboardAppend(dashboard.id, delayMs);
}

export async function bootstrapLiveDashboardState(
  shareId: string,
): Promise<LiveDashboardBootstrapResult> {
  const riverrun = getRequiredRiverrunClient();

  try {
    const bootstrap = await riverrun.bootstrap(
      SHARE_BUCKET,
      getDashboardStreamId(shareId),
    );

    if (!bootstrap) {
      return { status: "unavailable" };
    }

    const [snapshotPart, ...updateParts] = bootstrap.parts;
    let currentState: DashboardSharedStateV1 | null = null;

    if (snapshotPart?.body.trim()) {
      let parsedSnapshot: unknown;

      try {
        parsedSnapshot = JSON.parse(snapshotPart.body);
      } catch {
        return {
          status: "backend_unavailable",
          message: "Dashboard bootstrap snapshot is invalid JSON",
        };
      }

      if (isDashboardSharedStateV1(parsedSnapshot)) {
        currentState = parsedSnapshot;
      } else {
        return {
          status: "backend_unavailable",
          message: "Dashboard bootstrap snapshot is invalid",
        };
      }
    }

    for (const part of updateParts) {
      const body = part.body.trim();
      if (!body) {
        continue;
      }

      let parsedEvent: unknown;
      try {
        parsedEvent = JSON.parse(body);
      } catch {
        return {
          status: "backend_unavailable",
          message: "Dashboard bootstrap update is invalid JSON",
        };
      }

      if (!isDashboardLiveEventV1(parsedEvent)) {
        return {
          status: "backend_unavailable",
          message: "Dashboard bootstrap update is invalid",
        };
      }

      currentState = parsedEvent.state;
    }

    if (!currentState) {
      return { status: "unavailable" };
    }

    knownDashboardStateHashes.set(shareId, buildDashboardStateContentHash(currentState));

    return {
      status: "ready",
      state: currentState,
      nextOffset: bootstrap.nextOffset ?? "now",
    };
  } catch (err) {
    return {
      status: "backend_unavailable",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
