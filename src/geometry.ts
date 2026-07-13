import type { Nail, Unit, Vec2, LineStyle } from "./types";

export function dashPattern(style: LineStyle, thickness: number): number[] {
  const t = Math.max(1, thickness);
  switch (style) {
    case "solid": return [];
    case "dashed": return [t * 3, t * 2];
    case "dotted": return [t * 0.5, t * 1.5];
    case "dashdot": return [t * 3, t * 1.5, t * 0.5, t * 1.5];
    case "longdash": return [t * 6, t * 3];
    default: return [];
  }
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-9) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function angleOf(v: Vec2): number {
  return Math.atan2(v.y, v.x);
}

export function snapToGrid(x: number, y: number, gridSize: number): Vec2 {
  if (gridSize <= 0) return { x, y };
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}

export function hitTestNail(nails: Nail[], p: Vec2, tolerance: number): Nail | null {
  let closest: Nail | null = null;
  let closestDist = Infinity;
  for (const n of nails) {
    const d = dist(n, p);
    if (d <= n.radius + tolerance && d < closestDist) {
      closest = n;
      closestDist = d;
    }
  }
  return closest;
}

/**
 * Compute the tangent point on a circle (nail) for a line coming FROM a given
 * external point. `side` controls which tangent: -1 = left, +1 = right, 0 = direct edge.
 *
 * Math: given nail center C, radius r, and external point P:
 *   d = |P - C|, if d <= r return closest edge point toward P
 *   alpha = asin(r/d), theta = atan2(P.y - C.y, P.x - C.x)
 *   tangentAngle = theta + side * alpha
 *   tangent point = C + r * (cos(tangentAngle), sin(tangentAngle))
 */
export function tangentPoint(nail: Nail, from: Vec2, side: number): Vec2 {
  const dx = from.x - nail.x;
  const dy = from.y - nail.y;
  const d = Math.hypot(dx, dy);
  if (d <= nail.radius) {
    if (d < 1e-9) return { x: nail.x + nail.radius, y: nail.y };
    const dir = normalize({ x: dx, y: dy });
    return { x: nail.x + dir.x * nail.radius, y: nail.y + dir.y * nail.radius };
  }
  const theta = Math.atan2(dy, dx);
  const alpha = Math.asin(nail.radius / d);
  const tangentAngle = theta + side * alpha;
  return {
    x: nail.x + nail.radius * Math.cos(tangentAngle),
    y: nail.y + nail.radius * Math.sin(tangentAngle),
  };
}

/**
 * Determine which side a string wraps around a nail, given the incoming and
 * outgoing directions. Uses the cross product of (nail->prev) x (nail->next).
 * cross > 0 => left turn (CCW) => side = +1; cross < 0 => right turn (CW) => side = -1.
 */
export function wrapSide(prev: Vec2, nail: Nail, next: Vec2): number {
  const v1 = sub(prev, nail);
  const v2 = sub(next, nail);
  const cross = v1.x * v2.y - v1.y * v2.x;
  return cross >= 0 ? 1 : -1;
}

export type PathSegment =
  | { type: "line"; from: Vec2; to: Vec2 }
  | { type: "arc"; center: Vec2; radius: number; startAngle: number; endAngle: number; ccw: boolean };

/**
 * Build a complete thread path through a sequence of nails with realistic
 * wrapping. For each consecutive pair, compute tangent lines and arcs around
 * intermediate nails so the string never passes through a nail — it wraps
 * along the outer circumference, simulating real string tension.
 */
export function buildThreadPath(nails: Nail[], nailIds: string[]): PathSegment[] {
  const seq = nailIds.map((id) => nails.find((n) => n.id === id)).filter(Boolean) as Nail[];
  if (seq.length < 2) return [];

  const segments: PathSegment[] = [];

  for (let i = 0; i < seq.length - 1; i++) {
    const a = seq[i];
    const b = seq[i + 1];

    const beforeA = i > 0 ? seq[i - 1] : b;
    const afterB = i + 2 < seq.length ? seq[i + 2] : a;

    const sideA = i === 0 ? 0 : wrapSide(beforeA, a, b);
    const sideB = i + 2 >= seq.length ? 0 : wrapSide(a, b, afterB);

    let ptA: Vec2;
    if (i === 0) {
      const dir = normalize(sub(b, a));
      ptA = add(a, scale(dir, a.radius));
    } else {
      ptA = tangentPoint(a, b, sideA);
    }

    let ptB: Vec2;
    if (i + 2 >= seq.length) {
      const dir = normalize(sub(a, b));
      ptB = add(b, scale(dir, b.radius));
    } else {
      ptB = tangentPoint(b, a, -sideB);
    }

    segments.push({ type: "line", from: ptA, to: ptB });

    if (i + 2 < seq.length) {
      const c = seq[i + 2];
      const exitPt = tangentPoint(b, c, sideB);
      if (dist(ptB, exitPt) > 0.5) {
        const startAngle = angleOf(sub(ptB, b));
        const endAngle = angleOf(sub(exitPt, b));
        const ccw = sideB < 0;
        segments.push({
          type: "arc",
          center: { x: b.x, y: b.y },
          radius: b.radius,
          startAngle,
          endAngle,
          ccw,
        });
      }
    }
  }

  return segments;
}

export function unitToPx(value: number, unit: Unit, dpi: number): number {
  if (unit === "px") return value;
  if (unit === "cm") return (value / 2.54) * dpi;
  if (unit === "in") return value * dpi;
  return value;
}

export function pxToUnit(px: number, unit: Unit, dpi: number): number {
  if (unit === "px") return px;
  if (unit === "cm") return (px / dpi) * 2.54;
  if (unit === "in") return px / dpi;
  return px;
}

/** Distribute nails evenly around a shape. */
export function distributeNails(
  shape: "circle" | "square",
  count: number,
  cx: number,
  cy: number,
  size: number,
  radius: number
): Nail[] {
  const nails: Nail[] = [];
  if (shape === "circle") {
    const r = size / 2;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      nails.push({
        id: `nail-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        radius,
      });
    }
  } else {
    const half = size / 2;
    const perSide = Math.ceil(count / 4);
    const step = size / perSide;
    let placed = 0;
    for (let i = 0; i < perSide && placed < count; i++) {
      nails.push({ id: `nail-${Date.now()}-${placed}-${Math.random().toString(36).slice(2, 7)}`, x: cx - half + i * step, y: cy - half, radius });
      placed++;
    }
    for (let i = 0; i < perSide && placed < count; i++) {
      nails.push({ id: `nail-${Date.now()}-${placed}-${Math.random().toString(36).slice(2, 7)}`, x: cx + half, y: cy - half + i * step, radius });
      placed++;
    }
    for (let i = 0; i < perSide && placed < count; i++) {
      nails.push({ id: `nail-${Date.now()}-${placed}-${Math.random().toString(36).slice(2, 7)}`, x: cx + half - i * step, y: cy + half, radius });
      placed++;
    }
    for (let i = 0; i < perSide && placed < count; i++) {
      nails.push({ id: `nail-${Date.now()}-${placed}-${Math.random().toString(36).slice(2, 7)}`, x: cx - half, y: cy + half - i * step, radius });
      placed++;
    }
  }
  return nails;
}
