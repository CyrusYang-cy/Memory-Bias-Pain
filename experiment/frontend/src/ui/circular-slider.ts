/**
 * A circular slider with a picture in the middle, drawn with SVG (ring + handle) and a
 * canvas (picture). Replaces the jQuery `round-slider` plugin used originally, keeping
 * its look and its angle conventions:
 *
 *   - Screen angles are measured in degrees clockwise from the left (west) point.
 *   - `value` (0–359) is measured clockwise from `startAngle`, the point where value 0 sits.
 *   - No arc is drawn from `startAngle` to the handle: it would show where value 0 is.
 *
 * The component knows nothing about faces or morphs: it reports values and draws
 * whatever image it is given. It is laid out at `diameter` px and shrinks with CSS on
 * small screens (see .circular-slider); input is mapped back to the full-size geometry.
 */

export interface CircularSliderOptions {
  diameter: number;
  /** Screen angle (degrees clockwise from west) where value 0 sits. */
  startAngle: number;
  initialValue: number;
  /** Called whenever the (integer) value changes through user input or `setValue`. */
  onChange?: (value: number) => void;
  trackWidth?: number;
  handleDiameter?: number;
  /** Vertical shift of the picture inside the disk, in px (negative = up). */
  imageOffsetY?: number;
}

const COLORS = {
  border: "#AAAAAA",
  track: "#000000",
  handle: "#1098F7",
};

const SVG_NS = "http://www.w3.org/2000/svg";

export class CircularSlider {
  readonly element: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly handle: SVGCircleElement;
  private readonly center: number;
  private readonly trackRadius: number;
  private readonly trackWidth: number;
  private readonly imageOffsetY: number;
  private readonly diskSize: number;
  private readonly svg: SVGSVGElement;
  private tickLayer: SVGGElement | null = null;
  private currentValue: number;
  private interactive = false;
  private dragging = false;

  constructor(private readonly options: CircularSliderOptions) {
    const { diameter } = options;
    this.trackWidth = options.trackWidth ?? 10;
    const handleDiameter = options.handleDiameter ?? this.trackWidth + 20;
    this.imageOffsetY = options.imageOffsetY ?? 0;
    this.center = diameter / 2;
    this.trackRadius = diameter / 2 - 1 - this.trackWidth / 2;
    this.currentValue = Math.round(options.initialValue) % 360;

    this.element = document.createElement("div");
    this.element.className = "circular-slider";
    this.element.style.width = `${diameter}px`;
    const pct = (px: number) => `${(px / diameter) * 100}%`;

    // Picture disk, inside the ring.
    const inset = this.trackWidth + 1;
    const diskSize = diameter - 2 * inset;
    this.diskSize = diskSize;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "circular-slider__disk";
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.canvas.height = Math.round(diskSize * dpr);
    Object.assign(this.canvas.style, {
      width: pct(diskSize),
      height: pct(diskSize),
      left: pct(inset),
      top: pct(inset),
      background: "transparent",
    });

    // Ring and handle.
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${diameter} ${diameter}`);
    this.svg = svg;
    svg.classList.add("circular-slider__ring");
    svg.append(
      this.circle(this.trackRadius, COLORS.border, this.trackWidth + 2),
      this.circle(this.trackRadius, COLORS.track, this.trackWidth),
    );
    this.handle = document.createElementNS(SVG_NS, "circle");
    this.handle.setAttribute("r", String(handleDiameter / 2));
    this.handle.setAttribute("fill", COLORS.handle);
    this.handle.classList.add("circular-slider__handle");
    svg.append(this.handle);

    this.element.append(this.canvas, svg);
    this.element.addEventListener("pointerdown", this.onPointerDown);
    this.element.addEventListener("pointermove", this.onPointerMove);
    this.element.addEventListener("pointerup", this.onPointerUp);
    this.element.addEventListener("pointercancel", this.onPointerUp);
    this.element.addEventListener("keydown", this.onKeyDown);

    this.setInteractive(false);
    this.render();
  }

  get value(): number {
    return this.currentValue;
  }

  /** Screen angle of the handle (degrees clockwise from west). */
  get screenAngle(): number {
    return (this.options.startAngle + this.currentValue) % 360;
  }

  setValue(value: number): void {
    const next = ((Math.round(value) % 360) + 360) % 360;
    if (next === this.currentValue) return;
    this.currentValue = next;
    this.render();
    this.options.onChange?.(next);
  }

  /** While not interactive, the handle is hidden and input is ignored. */
  setInteractive(interactive: boolean): void {
    this.interactive = interactive;
    this.handle.style.display = interactive ? "" : "none";
    this.element.tabIndex = interactive ? 0 : -1;
    this.element.classList.toggle("is-interactive", interactive);
  }

  /** Draw an image into the disk, or clear it to the page background with `null`. */
  showImage(image: HTMLImageElement | null): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const size = this.canvas.width;
    ctx.clearRect(0, 0, size, size);
    if (!image) return;
    // Fit the whole image, preserving its aspect ratio (CSS `background-size: contain`).
    const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const pxPerCssPx = size / this.diskSize; // canvas px per full-size layout px
    const x = (size - width) / 2;
    const y = (size - height) / 2 + this.imageOffsetY * pxPerCssPx;
    ctx.drawImage(image, x, y, width, height);
  }

  /**
   * Debug only: show `text` next to the ring at each slider `value` (e.g. frame numbers);
   * `null` hides them again.
   */
  setTickLabels(ticks: ReadonlyArray<{ value: number; text: string }> | null): void {
    this.tickLayer?.remove();
    this.tickLayer = null;
    if (!ticks) return;
    const layer = document.createElementNS(SVG_NS, "g");
    const radius = this.trackRadius - this.trackWidth - 16; // just inside the ring
    for (const { value, text } of ticks) {
      const radians = ((this.options.startAngle + value - 180) * Math.PI) / 180;
      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("x", String(this.center + radius * Math.cos(radians)));
      label.setAttribute("y", String(this.center + radius * Math.sin(radians) + 4));
      label.setAttribute("text-anchor", "middle");
      label.classList.add("circular-slider__tick");
      label.textContent = text;
      layer.append(label);
    }
    this.svg.insertBefore(layer, this.handle);
    this.tickLayer = layer;
  }

  private render(): void {
    const handleAngle = this.screenAngle;
    const [hx, hy] = this.pointAt(handleAngle);
    this.handle.setAttribute("cx", String(hx));
    this.handle.setAttribute("cy", String(hy));
  }

  /** Point on the track at a screen angle (clockwise from west). */
  private pointAt(screenAngle: number): [number, number] {
    const radians = ((screenAngle - 180) * Math.PI) / 180;
    return [
      this.center + this.trackRadius * Math.cos(radians),
      this.center + this.trackRadius * Math.sin(radians),
    ];
  }

  private eventGeometry(event: PointerEvent): { angle: number; distance: number } {
    const rect = this.element.getBoundingClientRect();
    const scale = rect.width / this.options.diameter; // < 1 when CSS shrinks the slider
    const dx = (event.clientX - rect.left) / scale - this.center;
    const dy = (event.clientY - rect.top) / scale - this.center;
    const angle = (-Math.atan2(dy, -dx) * 180) / Math.PI;
    return { angle: (angle + 360) % 360, distance: Math.hypot(dx, dy) };
  }

  private setFromEvent(event: PointerEvent): void {
    this.setValue(this.eventGeometry(event).angle - this.options.startAngle);
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    if (!this.interactive) return;
    const onHandle = event.target === this.handle;
    const { distance } = this.eventGeometry(event);
    const onTrack = distance >= this.trackRadius - this.trackWidth && distance <= this.center + 5;
    if (!onHandle && !onTrack) return;
    event.preventDefault();
    this.dragging = true;
    this.element.setPointerCapture(event.pointerId);
    this.setFromEvent(event);
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (this.dragging) this.setFromEvent(event);
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    this.dragging = false;
    if (this.element.hasPointerCapture(event.pointerId)) {
      this.element.releasePointerCapture(event.pointerId);
    }
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (!this.interactive) return;
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    this.setValue(this.currentValue + step);
  };

  private circle(radius: number, stroke: string, width: number): SVGCircleElement {
    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("cx", String(this.center));
    c.setAttribute("cy", String(this.center));
    c.setAttribute("r", String(radius));
    c.setAttribute("fill", "none");
    c.setAttribute("stroke", stroke);
    c.setAttribute("stroke-width", String(width));
    return c;
  }
}
