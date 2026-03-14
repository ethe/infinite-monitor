"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import { GridLayout, useContainerWidth } from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import { LayoutGrid, TrendingUp, Shield, Globe, Plus } from "lucide-react";
import { useWidgetStore } from "@/store/widget-store";
import { WidgetCard } from "@/components/widget-card";
import { deleteWidgetFromDb, scheduleSyncToServer } from "@/lib/sync-db";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreateWidgetDialog } from "@/components/create-widget-dialog";

const COLS = 12;
const ROW_HEIGHT = 80;
const MARGIN = 12;

interface Template {
  name: string;
  description: string;
  widgetCount: number;
  widgets: Array<{
    title: string;
    description: string;
    code: string;
    files: Record<string, string>;
    layoutJson: string | null;
  }>;
}

const TEMPLATE_ICONS: Record<string, typeof TrendingUp> = {
  "Crypto Trader": TrendingUp,
  "World Conflicts OSINT": Globe,
  "Prediction Markets": Shield,
};

function TemplateGallery() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const applyTemplate = useWidgetStore((s) => s.applyTemplate);
  const renameDashboard = useWidgetStore((s) => s.renameDashboard);
  const activeDashboardId = useWidgetStore((s) => s.activeDashboardId);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleApply = async (template: Template) => {
    setApplying(template.name);
    applyTemplate(template);
    if (activeDashboardId) {
      renameDashboard(activeDashboardId, template.name);
    }
    scheduleSyncToServer();
    setApplying(null);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12 gap-8">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center w-10 h-10 mx-auto bg-zinc-800 mb-3">
          <LayoutGrid className="w-5 h-5 text-zinc-400" />
        </div>
        <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-300">
          Start with a Template
        </h2>
        <p className="text-xs text-zinc-500 max-w-sm">
          Choose a pre-built dashboard to get started instantly, or create a blank one.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-zinc-800/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
          {templates.map((template) => {
            const Icon = TEMPLATE_ICONS[template.name] || LayoutGrid;
            const isApplying = applying === template.name;
            return (
              <button
                key={template.name}
                onClick={() => handleApply(template)}
                disabled={isApplying}
                className="group relative flex flex-col items-start gap-3 p-5 bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900 transition-all text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-300">
                    {template.name}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  {template.description}
                </p>
                <div className="text-[10px] text-zinc-600 mt-auto">
                  {template.widgetCount} widgets
                </div>
                {isApplying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
                    <span className="text-xs text-zinc-400 animate-pulse">Loading...</span>
                  </div>
                )}
              </button>
            );
          })}

          <button
            onClick={() => {}}
            className="group flex flex-col items-center justify-center gap-2 p-5 border border-dashed border-zinc-800 hover:border-zinc-600 transition-all"
          >
            <Plus className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            <span className="text-[11px] text-zinc-600 group-hover:text-zinc-400 transition-colors">
              Blank Dashboard
            </span>
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 mt-2">
        <CreateWidgetDialog />
      </div>
    </div>
  );
}

export function DashboardGrid() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useWidgetStore.persist.onFinishHydration(() => setHydrated(true));
    if (useWidgetStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  const allWidgets = useWidgetStore((s) => s.widgets);
  const dashboards = useWidgetStore((s) => s.dashboards);
  const activeDashboardId = useWidgetStore((s) => s.activeDashboardId);
  const updateLayouts = useWidgetStore((s) => s.updateLayouts);
  const removeWidget = useWidgetStore((s) => s.removeWidget);
  const { width, containerRef, mounted } = useContainerWidth();

  const activeDashboard = dashboards.find((d) => d.id === activeDashboardId);

  const widgets = useMemo(() => {
    if (!activeDashboard) return allWidgets;
    return allWidgets.filter((w) => activeDashboard.widgetIds.includes(w.id));
  }, [allWidgets, activeDashboard]);

  const handleRemove = useCallback(
    (id: string) => {
      removeWidget(id);
      deleteWidgetFromDb(id);
    },
    [removeWidget]
  );

  const layout: Layout = useMemo(
    () => widgets.map((w) => ({ ...w.layout })),
    [widgets]
  );

  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      updateLayouts(newLayout);
    },
    [updateLayouts]
  );

  if (!hydrated) {
    return <div ref={containerRef} className="min-w-0 flex-1 w-full overflow-hidden" />;
  }

  return (
    <div ref={containerRef} className="min-w-0 flex-1 w-full overflow-hidden">
      {widgets.length === 0 ? (
        <TemplateGallery />
      ) : (
        <ScrollArea className="h-full w-full">
          <div className="px-5 pt-1 pb-40">
            {mounted && (
              <GridLayout
                className="layout"
                layout={layout}
                width={width - 40}
                gridConfig={{
                  cols: COLS,
                  rowHeight: ROW_HEIGHT,
                  margin: [MARGIN, MARGIN] as const,
                  containerPadding: [0, 0] as const,
                }}
                dragConfig={{
                  handle: ".drag-handle",
                }}
                resizeConfig={{
                  enabled: true,
                }}
                onLayoutChange={handleLayoutChange}
              >
                {widgets.map((widget) => (
                  <div key={widget.id} className="relative h-full">
                    <WidgetCard widget={widget} onRemove={handleRemove} />
                  </div>
                ))}
              </GridLayout>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
