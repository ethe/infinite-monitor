import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bootstrapLiveDashboardState,
  buildDashboardStateContentHash,
  buildDashboardSharedState,
} from "@/lib/publish-dashboard";
import { DEFAULT_RIVERRUN_BASE_URL } from "@/lib/riverrun";

const ORIGINAL_RIVERRUN_BASE_URL = process.env.RIVERRUN_BASE_URL;
const BOOTSTRAP_BOUNDARY = "rr-dashboard-bootstrap";

function buildBootstrapBody(parts: string[]) {
  return `${parts
    .map((part) => `--${BOOTSTRAP_BOUNDARY}\r\n${part}\r\n`)
    .join("")}--${BOOTSTRAP_BOUNDARY}--\r\n`;
}

afterEach(() => {
  vi.restoreAllMocks();

  if (ORIGINAL_RIVERRUN_BASE_URL === undefined) {
    delete process.env.RIVERRUN_BASE_URL;
  } else {
    process.env.RIVERRUN_BASE_URL = ORIGINAL_RIVERRUN_BASE_URL;
  }
});

describe("buildDashboardSharedState", () => {
  it("builds a sanitized live state without widget messages", () => {
    const state = buildDashboardSharedState(
      {
        dashboardId: "dash-1",
        title: "Markets",
        viewport: { panX: 24, panY: 60, zoom: 1 },
        textBlocks: [
          {
            id: "text-1",
            text: "Overview",
            fontSize: 32,
            layout: { x: 0, y: 0, w: 3, h: 1 },
          },
        ],
        widgets: [
          {
            id: "widget-1",
            title: "Widget One",
            description: "Shows shared output",
            layout: { x: 1, y: 2, w: 4, h: 3 },
            files: {
              "src/App.tsx": "export default function App() { return null; }",
              "src/components/Chart.tsx": "export function Chart() { return null; }",
            },
            messages: [
              {
                id: "msg-1",
                reasoning: "private chain of thought",
                attachments: [{ name: "image.png", url: "data:image/png;base64,..." }],
              },
            ],
          },
        ],
      },
      "shr_test",
      "2026-03-22T12:34:56.000Z",
    );

    expect(state).toEqual({
      version: "v1",
      shareId: "shr_test",
      dashboardId: "dash-1",
      title: "Markets",
      updatedAt: "2026-03-22T12:34:56.000Z",
      viewport: { panX: 24, panY: 60, zoom: 1 },
      textBlocks: [
        {
          id: "text-1",
          text: "Overview",
          fontSize: 32,
          layout: { x: 0, y: 0, w: 3, h: 1 },
        },
      ],
      widgets: [
        {
          sourceWidgetId: "widget-1",
          publishedWidgetId: "share--shr_test--widget-1",
          revision: expect.any(String),
          title: "Widget One",
          description: "Shows shared output",
          layout: { x: 1, y: 2, w: 4, h: 3 },
          files: {
            "src/App.tsx": "export default function App() { return null; }",
            "src/components/Chart.tsx": "export function Chart() { return null; }",
          },
        },
      ],
    });

    expect("messages" in state.widgets[0]).toBe(false);
  });

  it("ignores updatedAt when hashing equivalent live state content", () => {
    const source = {
      dashboardId: "dash-1",
      title: "Markets",
      viewport: { panX: 24, panY: 60, zoom: 1 },
      textBlocks: [],
      widgets: [
        {
          id: "widget-1",
          title: "Widget One",
          description: "Shows shared output",
          layout: { x: 1, y: 2, w: 4, h: 3 },
          files: {
            "src/components/Chart.tsx": "export function Chart() { return null; }",
            "src/App.tsx": "export default function App() { return null; }",
          },
        },
      ],
    };

    const firstState = buildDashboardSharedState(
      source,
      "shr_test",
      "2026-03-22T12:34:56.000Z",
    );
    const secondState = buildDashboardSharedState(
      source,
      "shr_test",
      "2026-03-22T12:35:56.000Z",
    );

    expect(buildDashboardStateContentHash(firstState)).toBe(
      buildDashboardStateContentHash(secondState),
    );
  });
});

describe("bootstrapLiveDashboardState", () => {
  it("falls back to the default riverrun base url when env is not configured", async () => {
    delete process.env.RIVERRUN_BASE_URL;
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(bootstrapLiveDashboardState("shr_test")).resolves.toEqual({
      status: "unavailable",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${DEFAULT_RIVERRUN_BASE_URL}/ds/im-share/shr_test.dashboard/bootstrap`,
    );
  });

  it("builds current live state from snapshot plus retained updates", async () => {
    process.env.RIVERRUN_BASE_URL = "https://riverrun.test";

    const snapshot = {
      version: "v1" as const,
      shareId: "shr_test",
      dashboardId: "dash-1",
      title: "Markets",
      updatedAt: "2026-03-22T12:34:56.000Z",
      viewport: { panX: 12, panY: 18, zoom: 1 },
      textBlocks: [],
      widgets: [],
    };

    const liveEvent = {
      version: "v1" as const,
      kind: "dashboard-state" as const,
      shareId: "shr_test",
      dashboardId: "dash-1",
      at: "2026-03-22T12:35:10.000Z",
      stateHash: "hash-1",
      state: {
        version: "v1" as const,
        shareId: "shr_test",
        dashboardId: "dash-1",
        title: "Markets Live",
        updatedAt: "2026-03-22T12:35:10.000Z",
        viewport: { panX: 30, panY: 40, zoom: 1.2 },
        textBlocks: [],
        widgets: [],
      },
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(
        buildBootstrapBody([
          `Content-Type: application/json\r\n\r\n${JSON.stringify(snapshot)}`,
          `Content-Type: application/json\r\n\r\n${JSON.stringify(liveEvent)}`,
        ]),
        {
          status: 200,
          headers: {
            "Content-Type": `multipart/mixed; boundary=${BOOTSTRAP_BOUNDARY}`,
            "Stream-Snapshot-Offset": "12",
            "Stream-Next-Offset": "42",
            "Stream-Up-To-Date": "true",
          },
        },
      ),
    ));

    await expect(bootstrapLiveDashboardState("shr_test")).resolves.toEqual({
      status: "ready",
      state: liveEvent.state,
      nextOffset: "42",
    });
  });
});
