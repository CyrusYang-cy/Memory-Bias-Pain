/**
 * Debug only ("Reveal"): the morph as a straight line, `ends[0]` (frame 0) on the left to
 * `ends[1]` (last frame) on the right, with the studied range shaded, the correct answer
 * (orange ring) and the face currently shown (blue dot). Unlike the slider, whose start
 * angle is random on every trial, this layout never changes.
 */
const SVG_NS = "http://www.w3.org/2000/svg";
const W = 300;
const M = 14;
const Y = 14;

export class MorphLine {
  readonly element: SVGSVGElement;
  private readonly answer: SVGCircleElement;
  private readonly current: SVGCircleElement;

  constructor(
    private readonly frames: number,
    ends: readonly [string, string],
    studied?: readonly [number, number],
  ) {
    this.element = el("svg", { viewBox: `0 0 ${W} 40`, width: W, height: 40, class: "morph-line" });
    this.element.setAttribute("aria-hidden", "true");
    if (studied) {
      const [a, b] = [this.x(studied[0]), this.x(studied[1])];
      this.element.append(
        el("rect", { x: a, y: Y - 7, width: b - a, height: 14, class: "morph-line__studied" }),
      );
    }
    this.element.append(el("line", { x1: M, y1: Y, x2: W - M, y2: Y, class: "morph-line__axis" }));
    for (const [text, x, anchor] of [
      [`${ends[0]} 0`, M, "start"],
      [`${frames - 1} ${ends[1]}`, W - M, "end"],
    ] as const) {
      const label = el("text", { x, y: 36, "text-anchor": anchor, class: "morph-line__end" });
      label.textContent = text;
      this.element.append(label);
    }
    this.answer = el("circle", { cy: Y, r: 6, class: "morph-line__answer" });
    this.current = el("circle", { cy: Y, r: 4, class: "morph-line__current" });
    this.element.append(this.answer, this.current);
  }

  setAnswer(frame: number): void {
    this.answer.setAttribute("cx", String(this.x(frame)));
  }

  setCurrent(frame: number): void {
    this.current.setAttribute("cx", String(this.x(frame)));
  }

  private x(frame: number): number {
    return M + (frame / (this.frames - 1)) * (W - 2 * M);
  }
}

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}
