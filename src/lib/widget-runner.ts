import Docker from "dockerode";
import getPort from "get-port";
import fs from "fs/promises";
import path from "path";

const docker = new Docker();

const WIDGET_BASE_PATH =
  process.env.WIDGET_BASE_PATH ||
  path.join(process.cwd(), "widgets");

const IMAGE_NAME = "widget-base:latest";

interface WidgetContainer {
  containerId: string;
  port: number;
  status: "starting" | "building" | "ready" | "error";
}

const registry = new Map<string, WidgetContainer>();

/** Write the agent's App.tsx to disk for a given widget. */
export async function writeWidgetCode(
  widgetId: string,
  code: string
): Promise<void> {
  const widgetDir = path.join(WIDGET_BASE_PATH, widgetId, "src");
  await fs.mkdir(widgetDir, { recursive: true });
  await fs.writeFile(path.join(widgetDir, "App.tsx"), code, "utf-8");
}

/** Read the agent's App.tsx from disk. */
export async function readWidgetCode(
  widgetId: string
): Promise<string | null> {
  try {
    const filePath = path.join(
      WIDGET_BASE_PATH,
      widgetId,
      "src",
      "App.tsx"
    );
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Ensure a widget container is running. If already running and ready, return immediately.
 * Otherwise start a new container.
 */
export async function ensureWidget(
  widgetId: string
): Promise<WidgetContainer> {
  const existing = registry.get(widgetId);
  if (existing && existing.status === "ready") return existing;
  if (existing && existing.status === "building") return existing;

  return startWidget(widgetId);
}

/** Start a new container for a widget. Kills any existing container first. */
async function startWidget(widgetId: string): Promise<WidgetContainer> {
  // Clean up any existing container for this widget
  await stopWidget(widgetId);

  const port = await getPort({ port: { start: 3100, end: 3999 } });

  const widgetSrcPath = path.join(WIDGET_BASE_PATH, widgetId, "src");

  // Ensure the src dir exists
  await fs.mkdir(widgetSrcPath, { recursive: true });

  const entry: WidgetContainer = {
    containerId: "",
    port,
    status: "starting",
  };
  registry.set(widgetId, entry);

  try {
    const container = await docker.createContainer({
      Image: IMAGE_NAME,
      name: `widget-${widgetId}-${Date.now()}`,
      Cmd: [
        "sh",
        "-c",
        [
          // Copy base template into /app
          "cp -r /base/. /app",
          // Overwrite App.tsx with the agent's version
          "cp /widget/App.tsx /app/src/App.tsx",
          // Build and serve
          "cd /app",
          "npx vite build",
          "npx vite preview --host 0.0.0.0 --port 3000",
        ].join(" && "),
      ],
      ExposedPorts: { "3000/tcp": {} },
      HostConfig: {
        PortBindings: {
          "3000/tcp": [{ HostPort: String(port) }],
        },
        Binds: [
          // Mount the widget's src/App.tsx read-only
          `${widgetSrcPath}:/widget:ro`,
        ],
        AutoRemove: true,
      },
    });

    await container.start();
    entry.containerId = container.id;
    entry.status = "building";

    // Wait for the Vite preview server to become ready
    waitForReady(port)
      .then(() => {
        entry.status = "ready";
        console.log(
          `[widget-runner] Widget ${widgetId} ready on port ${port}`
        );
      })
      .catch(() => {
        entry.status = "error";
        console.error(
          `[widget-runner] Widget ${widgetId} failed to start`
        );
      });

    return entry;
  } catch (err) {
    entry.status = "error";
    console.error("[widget-runner] Failed to create container:", err);
    return entry;
  }
}

/** Stop and remove a widget's container. */
export async function stopWidget(widgetId: string): Promise<void> {
  const entry = registry.get(widgetId);
  if (!entry || !entry.containerId) return;

  try {
    const container = docker.getContainer(entry.containerId);
    await container.stop().catch(() => {});
    await container.remove().catch(() => {});
  } catch {
    // Container may already be gone (AutoRemove: true)
  }

  registry.delete(widgetId);
}

/** Stop the old container, start a fresh one (re-reads App.tsx from disk). */
export async function rebuildWidget(
  widgetId: string
): Promise<WidgetContainer> {
  return startWidget(widgetId);
}

/** Get current status for a widget. */
export function getWidgetStatus(
  widgetId: string
): WidgetContainer | null {
  return registry.get(widgetId) ?? null;
}

/** Poll until the port returns a response. */
async function waitForReady(
  port: number,
  timeout = 60000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://localhost:${port}/`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok || res.status === 404) return;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Widget did not start within ${timeout}ms`);
}
