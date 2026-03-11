import { streamText, stepCountIs, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { writeWidgetCode, rebuildWidget } from "@/lib/widget-runner";

const SYSTEM_PROMPT = `You are a coding agent that builds a SINGLE React widget component.

You write ONE file: App.tsx. The widget runs in a Vite + React environment inside a Docker container with all dependencies pre-installed.

## What You Are Building

One focused widget — NOT an app, NOT a page, NOT a dashboard. The widget is embedded as an iframe inside a parent dashboard that ALREADY provides:
- A title bar with the widget name
- An expand/collapse button
- A close button

DO NOT recreate any of these. Just build the core content the user asks for.

## Component Rules

- Default export a React component named \`App\`
- Write TypeScript JSX (.tsx)
- Root layout: \`<div className="w-full h-full overflow-auto p-4 space-y-4">…</div>\`

## Available Packages (pre-installed)

\`\`\`tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, AreaChart, BarChart, PieChart, Line, Area, Bar, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, RefreshCw, Search, AlertCircle } from "lucide-react"; // any lucide icon
import { format, formatDistanceToNow, subDays } from "date-fns";
import maplibregl from "maplibre-gl";
import { motion, AnimatePresence } from "framer-motion";
\`\`\`

## shadcn/ui Components

All shadcn components are pre-installed. Import from \`@/components/ui/*\`:

\`\`\`tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
\`\`\`

Utility: \`import { cn } from "@/lib/utils";\`

## Data Fetching

For external APIs, use the CORS proxy provided by the host app:
\`\`\`tsx
const res = await fetch("/api/proxy?url=" + encodeURIComponent("https://api.example.com/data"));
const data = await res.json();
\`\`\`

Use \`useEffect\` with \`setInterval\` for polling. Always handle loading and error states.

## Styling

- Tailwind CSS utility classes for all styling
- Dark theme active (html has class="dark")
- Use light text: text-zinc-100, text-zinc-300, text-white
- Charts: bright colours (#60a5fa, #34d399, #f87171, #fbbf24, #a78bfa)
- No rounded corners
- Monospace font is default, base 13px

## Workflow

1. Briefly explain what you will build (1-2 sentences max).
2. Call \`writeCode\` with the complete App.tsx.
3. If you spot issues, call \`writeCode\` again with the fix.

Keep the widget focused, clean, and production-quality.`;

export async function POST(request: Request) {
  const body = await request.json();
  const { messages, widgetId } = body as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    widgetId: string;
  };

  if (!widgetId) {
    return Response.json({ error: "widgetId required" }, { status: 400 });
  }

  const writeCodeTool = tool({
    description:
      "Write the complete App.tsx source code. The widget preview will update immediately. Call again to iterate.",
    inputSchema: z.object({
      code: z
        .string()
        .describe("The complete App.tsx source code (TypeScript JSX)"),
    }),
    execute: async ({ code }) => {
      // Write to disk so Docker container can pick it up
      await writeWidgetCode(widgetId, code);
      // Trigger container rebuild (async, don't block)
      rebuildWidget(widgetId).catch(console.error);
      return { success: true };
    },
  });

  const webSearchTool = anthropic.tools.webSearch_20250305({ maxUses: 5 });

  const result = streamText({
    model: anthropic("claude-opus-4-6"),
    system: SYSTEM_PROMPT,
    messages,
    tools: {
      writeCode: writeCodeTool,
      web_search: webSearchTool,
    },
    stopWhen: stepCountIs(40),
    providerOptions: {
      anthropic: {
        thinking: { type: "adaptive" },
        effort: "high",
      },
    },
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        for await (const part of result.fullStream) {
          switch (part.type) {
            case "reasoning-delta":
              send({ type: "reasoning-delta", text: part.text });
              break;

            case "text-delta":
              send({ type: "text-delta", text: part.text });
              break;

            case "tool-call": {
              const input = part.input as Record<string, unknown> | undefined;
              if (part.toolName === "writeCode") {
                // Stream the code to the client so it can update the store
                send({ type: "widget-code", code: input?.code });
                send({ type: "tool-call", toolName: "writeCode", args: {} });
              } else if (part.toolName === "web_search") {
                send({
                  type: "tool-call",
                  toolName: "web_search",
                  args: { query: input?.query },
                });
              }
              break;
            }

            case "tool-result":
              // No need to send tool results to client for writeCode
              break;

            case "error":
              send({ type: "error", error: String(part.error) });
              break;
          }
        }

        send({ type: "done" });
      } catch (err) {
        send({ type: "error", error: String(err) });
      } finally {
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
