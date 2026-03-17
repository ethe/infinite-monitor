import { createMCPClient } from "@ai-sdk/mcp";

export async function POST(request: Request) {
  try {
    const { url, transportType, headers } = (await request.json()) as {
      url: string;
      transportType: "http" | "sse";
      headers?: Record<string, string>;
    };

    if (!url) {
      return Response.json({ ok: false, error: "URL is required" }, { status: 400 });
    }

    const client = await createMCPClient({
      transport: {
        type: transportType,
        url,
        headers: headers ?? {},
      },
    });

    const tools = await client.tools();
    const toolNames = Object.keys(tools);

    await client.close();

    return Response.json({
      ok: true,
      tools: toolNames,
      toolCount: toolNames.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 200 });
  }
}
