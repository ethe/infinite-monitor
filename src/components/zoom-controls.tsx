"use client";

import { Minus, Plus, Maximize, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CELL_W, CELL_H, MARGIN } from "@/components/infinite-canvas";
import type { CanvasLayout } from "@/store/widget-store";

interface ZoomControlsProps {
  zoom: number;
  panX: number;
  panY: number;
  containerWidth: number;
  containerHeight: number;
  widgets: Array<{ layout: CanvasLayout }>;
  onViewportChange: (panX: number, panY: number, zoom: number) => void;
}

export function ZoomControls({
  zoom,
  panX,
  panY,
  containerWidth,
  containerHeight,
  widgets,
  onViewportChange,
}: ZoomControlsProps) {
  const zoomIn = () => {
    const newZoom = Math.min(3, zoom + 0.1);
    const cx = containerWidth / 2;
    const cy = containerHeight / 2;
    const worldX = (cx - panX) / zoom;
    const worldY = (cy - panY) / zoom;
    onViewportChange(cx - worldX * newZoom, cy - worldY * newZoom, newZoom);
  };

  const zoomOut = () => {
    const newZoom = Math.max(0.1, zoom - 0.1);
    const cx = containerWidth / 2;
    const cy = containerHeight / 2;
    const worldX = (cx - panX) / zoom;
    const worldY = (cy - panY) / zoom;
    onViewportChange(cx - worldX * newZoom, cy - worldY * newZoom, newZoom);
  };

  const resetView = () => {
    onViewportChange(0, 0, 1);
  };

  const fitToView = () => {
    if (widgets.length === 0) {
      resetView();
      return;
    }

    const step = CELL_W + MARGIN;
    const stepY = CELL_H + MARGIN;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const w of widgets) {
      const left = w.layout.x * step;
      const top = w.layout.y * stepY;
      const right = left + w.layout.w * step - MARGIN;
      const bottom = top + w.layout.h * stepY - MARGIN;
      if (left < minX) minX = left;
      if (top < minY) minY = top;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const padding = 60;
    const availW = containerWidth - padding * 2;
    const availH = containerHeight - padding * 2;

    const fitZoom = Math.min(1, Math.min(availW / contentW, availH / contentH));
    const fitPanX = (containerWidth - contentW * fitZoom) / 2 - minX * fitZoom;
    const fitPanY = (containerHeight - contentH * fitZoom) / 2 - minY * fitZoom;

    onViewportChange(fitPanX, fitPanY, fitZoom);
  };

  return (
    <div className="absolute bottom-4 right-4 z-50 flex items-center gap-1 bg-zinc-800 border border-zinc-700 px-1 py-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
        onClick={zoomOut}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <span className="text-[11px] text-zinc-400 w-10 text-center tabular-nums select-none">
        {Math.round(zoom * 100)}%
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
        onClick={zoomIn}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px h-4 bg-zinc-700 mx-0.5" />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
        onClick={fitToView}
        title="Fit to view"
      >
        <Maximize className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
        onClick={resetView}
        title="Reset view"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
