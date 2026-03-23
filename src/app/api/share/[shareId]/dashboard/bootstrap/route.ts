import { bootstrapLiveDashboardState } from "@/lib/publish-dashboard";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await params;
  const result = await bootstrapLiveDashboardState(shareId);

  if (result.status === "ready") {
    return Response.json({
      state: result.state,
      nextOffset: result.nextOffset,
    });
  }

  if (result.status === "unavailable") {
    return Response.json({ error: "Live dashboard state not found" }, { status: 404 });
  }

  return Response.json(
    { error: result.message },
    { status: 503 },
  );
}
