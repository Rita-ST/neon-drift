import { boundsOf, loopLength, poseAt, type Pt } from "./geometry.js";

export type Gate = {
  id: number;
  along: number;
  finish: boolean;
  ax: number;
  ay: number;
  bx: number;
  by: number;
};

export type TrackBounds = { minX: number; minY: number; maxX: number; maxY: number; cx: number; cy: number };

export type Track = {
  id: 1 | 2 | 3;
  name: string;
  width: number;
  points: Pt[];
  length: number;
  gates: Gate[];
  spawnAlong: number;
  bounds: TrackBounds;
};

const GATE_FRACTIONS = [0.22, 0.46, 0.7, 0.96];

function roundedRect(x: number, y: number, w: number, h: number, r: number, step: number): Pt[] {
  const corners = [
    { cx: x + w - r, cy: y + r, a0: -Math.PI / 2, a1: 0 },
    { cx: x + w - r, cy: y + h - r, a0: 0, a1: Math.PI / 2 },
    { cx: x + r, cy: y + h - r, a0: Math.PI / 2, a1: Math.PI },
    { cx: x + r, cy: y + r, a0: Math.PI, a1: Math.PI * 1.5 },
  ];
  const pts: Pt[] = [];
  for (const c of corners) {
    const arcLen = (c.a1 - c.a0) * r;
    const n = Math.max(2, Math.ceil(arcLen / step));
    for (let i = 0; i < n; i++) {
      const t = c.a0 + ((c.a1 - c.a0) * i) / n;
      pts.push({ x: c.cx + Math.cos(t) * r, y: c.cy + Math.sin(t) * r });
    }
  }
  return pts;
}

function dentedEllipse(cx: number, cy: number, rx: number, ry: number, step: number, dentAt: number, dent: number): Pt[] {
  const approx = 2 * Math.PI * Math.max(rx, ry);
  const n = Math.max(24, Math.ceil(approx / step));
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    let delta = Math.atan2(Math.sin(a - dentAt), Math.cos(a - dentAt));
    const pinch = Math.exp(-(delta * delta) / 0.09);
    const scale = 1 - dent * pinch;
    pts.push({ x: cx + Math.cos(a) * rx * scale, y: cy + Math.sin(a) * ry * scale });
  }
  return pts;
}

function makeGate(points: Pt[], length: number, id: number, fraction: number, half: number, finish: boolean): Gate {
  const along = length * fraction;
  const pose = poseAt(points, length, along);
  const nx = -Math.sin(pose.angle);
  const ny = Math.cos(pose.angle);
  return {
    id,
    along,
    finish,
    ax: pose.x + nx * half,
    ay: pose.y + ny * half,
    bx: pose.x - nx * half,
    by: pose.y - ny * half,
  };
}

function build(id: 1 | 2 | 3, name: string, width: number, points: Pt[]): Track {
  const length = loopLength(points);
  const half = width * 0.62;
  const gates = GATE_FRACTIONS.map((fraction, index) =>
    makeGate(points, length, index, fraction, half, index === GATE_FRACTIONS.length - 1),
  );
  return {
    id,
    name,
    width,
    points,
    length,
    gates,
    spawnAlong: length * 0.045,
    bounds: boundsOf(points),
  };
}

export const TRACKS: Track[] = [
  build(1, "Downtown Loop", 150, roundedRect(180, 180, 2600, 1700, 320, 42)),
  build(2, "Reactor Core", 118, dentedEllipse(1100, 1000, 680, 600, 36, 0.15, 0.38)),
  build(3, "Skyline Spiral", 160, dentedEllipse(1700, 820, 1450, 480, 40, Math.PI, 0.12)),
];

export function trackById(id: number): Track | undefined {
  return TRACKS.find((track) => track.id === id);
}

export const LAPS = 3;
export const POINTS = [10, 6, 3, 1] as const;
export const FINISH_GRACE_MS = 20_000;
export const PARK_MS = 10_000;
