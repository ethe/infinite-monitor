import { getDashboard } from "@/db/widgets";
import { appendLiveDashboardState } from "@/lib/publish-dashboard";
import { ensurePublishedTraceStream } from "@/lib/share-trace";
import {
  deriveShareId,
  getDashboardStreamId,
  getTraceStreamId,
} from "@/lib/share";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const dashboard = getDashboard(id);

  if (!dashboard) {
    return Response.json({ error: "Dashboard not found" }, { status: 404 });
  }

  try {
    const shareId = deriveShareId(id);
    const origin = new URL(request.url).origin;
    const liveState = await appendLiveDashboardState(id);
    await ensurePublishedTraceStream(shareId);

    return Response.json({
      dashboardId: id,
      shareId,
      shareUrl: `${origin}/share/${shareId}`,
      dashboardStreamId: getDashboardStreamId(shareId),
      traceStreamId: getTraceStreamId(shareId),
      updatedAt: liveState.state.updatedAt,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
