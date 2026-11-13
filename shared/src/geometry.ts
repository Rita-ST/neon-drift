export type Pt = { x: number; y: number };

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function wrapAngle(a: number): number {
  let x = (a + Math.PI) % (Math.PI * 2);
  if (x < 0) x += Math.PI * 2;
  return x - Math.PI;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function loopLength(points: Pt[]): number {
  let length = 0;
  for (let i = 0; i < points.length; i++) {
    length += dist(points[i], points[(i + 1) % points.length]);
  }
  return length;
}

export function poseAt(points: Pt[], length: number, along: number): { x: number; y: number; angle: number } {
  let d = along % length;
  if (d < 0) d += length;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const seg = dist(a, b);
    if (d <= seg || i === points.length - 1) {
      const t = seg === 0 ? 0 : Math.min(1, d / seg);
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    d -= seg;
  }
  const a = points[0];
  const b = points[1] ?? points[0];
  return { x: a.x, y: a.y, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

export function projectPoint(points: Pt[], x: number, y: number): { dist: number; along: number; x: number; y: number; angle: number } {
  let best = Infinity;
  let acc = 0;
  let bestAlong = 0;
  let bx = points[0].x;
  let by = points[0].y;
  let ba = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    const t = len2 === 0 ? 0 : clamp(((x - a.x) * abx + (y - a.y) * aby) / len2, 0, 1);
    const px = a.x + abx * t;
    const py = a.y + aby * t;
    const d = Math.hypot(x - px, y - py);
    if (d < best) {
      best = d;
      bestAlong = acc + Math.hypot(px - a.x, py - a.y);
      bx = px;
      by = py;
      ba = Math.atan2(aby, abx);
    }
    acc += Math.hypot(abx, aby);
  }
  return { dist: best, along: bestAlong, x: bx, y: by, angle: ba };
}

export function segmentsIntersect(p1: Pt, p2: Pt, q1: Pt, q2: Pt): boolean {
  const cross = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

export function boundsOf(points: Pt[]): { minX: number; minY: number; maxX: number; maxY: number; cx: number; cy: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}
