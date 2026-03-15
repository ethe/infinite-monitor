"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

export const CELL_W = 120;
export const CELL_H = 80;
export const MARGIN = 12;

const STEP = CELL_W + MARGIN;
const STEP_Y = CELL_H + MARGIN;

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3.0;
const ZOOM_SENSITIVITY = 0.001;

interface InfiniteCanvasProps {
  panX: number;
  panY: number;
  zoom: number;
  onViewportChange: (panX: number, panY: number, zoom: number) => void;
  children: ReactNode;
}

export function InfiniteCanvas({
  panX,
  panY,
  zoom,
  onViewportChange,
  children,
}: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        const rect = containerRef.current!.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const delta = -e.deltaY * ZOOM_SENSITIVITY;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (1 + delta)));

        const worldX = (cursorX - panX) / zoom;
        const worldY = (cursorY - panY) / zoom;

        const newPanX = cursorX - worldX * newZoom;
        const newPanY = cursorY - worldY * newZoom;

        onViewportChange(newPanX, newPanY, newZoom);
      } else {
        onViewportChange(panX - e.deltaX, panY - e.deltaY, zoom);
      }
    },
    [panX, panY, zoom, onViewportChange]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1 || (e.button === 0 && e.target === containerRef.current)) {
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY, panX, panY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }
    },
    [panX, panY]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      onViewportChange(panStart.current.panX + dx, panStart.current.panY + dy, zoom);
    },
    [isPanning, zoom, onViewportChange]
  );

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const DOT_SPACING = 22;
  const gridBg = `radial-gradient(circle, rgba(255,255,255,0.10) 0.8px, transparent 0.8px)`;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ cursor: isPanning ? "grabbing" : "grab" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        style={{
          position: "absolute",
          transformOrigin: "0 0",
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          backgroundImage: gridBg,
          backgroundSize: `${DOT_SPACING}px ${DOT_SPACING}px`,
          left: 0,
          top: 0,
          width: "200000px",
          height: "200000px",
          marginLeft: "-100000px",
          marginTop: "-100000px",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "100000px",
            top: "100000px",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
