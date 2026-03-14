import { getAllDashboards, getWidget, getWidgetFiles } from "@/db/widgets";

const TEMPLATE_DASHBOARDS = [
  "Crypto Trader",
  "World Conflicts OSINT",
  "Prediction Markets",
];

export async function GET() {
  const allDashboards = getAllDashboards();

  const templates = allDashboards
    .filter((d) => TEMPLATE_DASHBOARDS.includes(d.title))
    .map((d) => {
      const widgetIds: string[] = d.widgetIdsJson
        ? JSON.parse(d.widgetIdsJson)
        : [];

      const widgets = widgetIds
        .map((id) => {
          const w = getWidget(id);
          if (!w || !w.code) return null;
          const files = getWidgetFiles(id);
          return {
            title: w.title,
            description: w.description,
            code: w.code,
            files,
            layoutJson: w.layoutJson,
          };
        })
        .filter(Boolean);

      if (widgets.length === 0) return null;

      return {
        name: d.title,
        description: getTemplateDescription(d.title),
        widgetCount: widgets.length,
        widgets,
      };
    })
    .filter(Boolean);

  return Response.json(templates);
}

function getTemplateDescription(name: string): string {
  switch (name) {
    case "Crypto Trader":
      return "Real-time crypto prices, charts, fear & greed index, top movers, and gas tracker.";
    case "World Conflicts OSINT":
      return "Conflict map, military news, YouTube OSINT feeds, displacement data, and airspace monitoring.";
    case "Prediction Markets":
      return "Live Polymarket and Kalshi markets, top traders, arbitrage scanner, and news feed.";
    default:
      return "";
  }
}
