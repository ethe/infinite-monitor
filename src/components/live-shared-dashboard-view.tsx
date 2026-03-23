"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import { SharedDashboardView } from "@/components/shared-dashboard-view";
import {
  isDashboardLiveEventV1,
  type DashboardSharedStateV1,
} from "@/lib/share-types";

interface LiveBootstrapPayload {
  state: DashboardSharedStateV1;
  nextOffset?: string | null;
}

export function LiveSharedDashboardView({
  shareId,
}: {
  shareId: string;
}) {
  const [dashboard, setDashboard] = useState<DashboardSharedStateV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let eventSource: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let nextLiveOffset = "now";

    const applyLivePayload = (payload: unknown) => {
      const candidates = Array.isArray(payload) ? payload : [payload];

      for (const candidate of candidates) {
        if (!isDashboardLiveEventV1(candidate)) {
          continue;
        }

        setDashboard(candidate.state);
        setLiveError(null);
      }
    };

    const connectLive = (offset: string) => {
      if (cancelled) {
        return;
      }

      nextLiveOffset = offset;
      eventSource?.close();
      eventSource = new EventSource(
        `/api/share/${shareId}/dashboard/live?offset=${encodeURIComponent(offset)}`,
      );

      eventSource.addEventListener("data", (event) => {
        try {
          applyLivePayload(JSON.parse((event as MessageEvent<string>).data));
        } catch {
          // Ignore malformed SSE data frames.
        }
      });

      eventSource.addEventListener("control", (event) => {
        try {
          const parsed = JSON.parse((event as MessageEvent<string>).data) as unknown;
          if (
            parsed
            && typeof parsed === "object"
            && typeof (parsed as { streamNextOffset?: unknown }).streamNextOffset === "string"
          ) {
            nextLiveOffset = (parsed as { streamNextOffset: string }).streamNextOffset;
            setLiveError(null);
          }
        } catch {
          // Ignore malformed control frames.
        }
      });

      eventSource.onerror = () => {
        if (cancelled) {
          return;
        }

        eventSource?.close();
        eventSource = null;
        setLiveError("Live dashboard connection interrupted");

        if (reconnectTimer !== null) {
          return;
        }

        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          connectLive(nextLiveOffset);
        }, 1500);
      };
    };

    const bootstrapDashboard = async () => {
      setLoading(true);
      setBootstrapError(null);
      setLiveError(null);

      try {
        const response = await fetch(`/api/share/${shareId}/dashboard/bootstrap`);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error ?? `Live dashboard load failed with status ${response.status}`);
        }

        if (cancelled) {
          return;
        }

        const payload = data as LiveBootstrapPayload;
        setDashboard(payload.state);
        connectLive(payload.nextOffset ?? "now");
      } catch (err) {
        if (!cancelled) {
          setBootstrapError(err instanceof Error ? err.message : String(err));
          setDashboard(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void bootstrapDashboard();

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      eventSource?.close();
    };
  }, [shareId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 bg-zinc-900 text-sm text-zinc-500">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Loading shared dashboard…
      </div>
    );
  }

  if (bootstrapError || !dashboard) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-zinc-900">
        <header className="border-b border-zinc-800 px-5 py-3">
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Shared Dashboard
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="max-w-md border border-zinc-800 bg-zinc-900/60 p-6 text-center">
            <div className="flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
            </div>
            <h1 className="mt-3 text-sm uppercase tracking-[0.18em] text-zinc-100">
              Shared dashboard unavailable
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              This share link does not have any durable dashboard state yet.
            </p>
            {bootstrapError && (
              <div className="mt-4 break-words text-xs text-zinc-500">{bootstrapError}</div>
            )}
            <div className="mt-4 break-all text-[11px] uppercase tracking-[0.16em] text-zinc-600">
              {shareId}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen">
      <SharedDashboardView dashboard={dashboard} />
      {liveError && (
        <div className="pointer-events-none absolute top-16 right-4 border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-amber-100">
          {liveError}
        </div>
      )}
    </div>
  );
}
