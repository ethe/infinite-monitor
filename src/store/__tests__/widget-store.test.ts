import { describe, it, expect } from "vitest";
import { getNextPosition } from "@/store/widget-store";
import type { Widget } from "@/store/widget-store";

function makeWidget(id: string, x: number, y: number, w: number, h: number): Widget {
  return {
    id,
    title: id,
    description: "",
    messages: [],
    layout: { x, y, w, h },
    code: null,
    files: {},
    iframeVersion: 0,
  };
}

describe("getNextPosition", () => {
  it("returns origin for empty grid", () => {
    expect(getNextPosition([], [])).toEqual({ x: 0, y: 0 });
  });

  it("returns origin when no widgets match the dashboard", () => {
    const widgets = [makeWidget("w1", 0, 0, 4, 3)];
    expect(getNextPosition(widgets, ["other"])).toEqual({ x: 0, y: 0 });
  });

  it("places next widget to the right when space is available", () => {
    const widgets = [makeWidget("w1", 0, 0, 4, 3)];
    expect(getNextPosition(widgets, ["w1"])).toEqual({ x: 4, y: 0 });
  });

  it("places to the right of the last widget in a full row", () => {
    const widgets = [
      makeWidget("w1", 0, 0, 4, 3),
      makeWidget("w2", 4, 0, 4, 3),
      makeWidget("w3", 8, 0, 4, 3),
    ];
    expect(getNextPosition(widgets, ["w1", "w2", "w3"])).toEqual({ x: 12, y: 0 });
  });

  it("places next to rightmost widget on the last row", () => {
    const widgets = [
      makeWidget("w1", 0, 0, 4, 3),
      makeWidget("w2", 4, 0, 4, 3),
    ];
    expect(getNextPosition(widgets, ["w1", "w2"])).toEqual({ x: 8, y: 0 });
  });

  it("only considers widgets in the given dashboard", () => {
    const widgets = [
      makeWidget("w1", 0, 0, 4, 3),
      makeWidget("w2", 4, 0, 4, 3),
    ];
    expect(getNextPosition(widgets, ["w1"])).toEqual({ x: 4, y: 0 });
  });
});
