import {
  CARS,
  LAPS,
  clamp,
  poseAt,
  projectPoint,
  segmentsIntersect,
  type CarId,
  type HeldItem,
  type ItemType,
  type Pt,
  type Track,
} from "@neon/shared";

export type SimCar = {
  id: string;
  name: string;
  carId: CarId;
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  lap: number;
  nextGate: number;
  lapStartMs: number;
  bestLapMs: number | null;
  finished: boolean;
  finishTimeMs: number | null;
  item: HeldItem | null;
  boostUntil: number;
  shield: boolean;
  invisibleUntil: number;
  empUntil: number;
  spinUntil: number;
  parked: boolean;
  input: { steer: number; throttle: number; brake: number };
  hitUntil: Map<string, number>;
};

export type WorldItem = { id: string; type: ItemType; x: number; y: number };
export type OilSlick = { id: string; x: number; y: number; until: number; ownerId: string };

export type SimEvent =
  | { type: "checkpoint_passed"; playerId: string; playerName: string; checkpointId: number; lap: number }
  | { type: "lap_completed"; playerId: string; playerName: string; lap: number; lapTimeMs: number }
  | { type: "player_finished"; playerId: string; playerName: string; totalTimeMs: number }
  | { type: "item_spawned"; itemId: string; itemType: ItemType; x: number; y: number }
  | { type: "item_picked_up"; itemId: string; playerId: string; playerName: string; itemType: ItemType }
  | { type: "item_used"; playerId: string; playerName: string; itemType: HeldItem | "shield" | "oil"; targetId?: string }
  | { type: "car_hit"; playerId: string; playerName: string; source: string; effect: string; durationMs: number }
  | { type: "haptic_triggered"; playerId: string; pattern: "hit" | "boost" | "finish" };

export type SimWorld = {
  track: Track;
  cars: SimCar[];
  items: WorldItem[];
  oils: OilSlick[];
  status: "lobby" | "countdown" | "racing" | "finished";
  startTs: number | null;
  nextItemAt: number;
  idSeq: number;
};

const PICKUP_RADIUS = 34;
const CAR_RADIUS = 18;
const OIL_RADIUS = 30;
const ITEM_LIFETIME = 4;

export function freshCar(id: string, name: string, carId: CarId, track: Track, slot: number, now: number): SimCar {
  const placed = placeOnGrid(track, slot);
  return {
    id,
    name,
    carId,
    x: placed.x,
    y: placed.y,
    angle: placed.angle,
    vx: 0,
    vy: 0,
    lap: 0,
    nextGate: 0,
    lapStartMs: now,
    bestLapMs: null,
    finished: false,
    finishTimeMs: null,
    item: null,
    boostUntil: 0,
    shield: false,
    invisibleUntil: 0,
    empUntil: 0,
    spinUntil: 0,
    parked: false,
    input: { steer: 0, throttle: 0, brake: 0 },
    hitUntil: new Map(),
  };
}

export function placeOnGrid(track: Track, slot: number): { x: number; y: number; angle: number } {
  const pose = poseAt(track.points, track.length, track.spawnAlong);
  const nx = -Math.sin(pose.angle);
  const ny = Math.cos(pose.angle);
  const offset = (slot - 1.5) * 36;
  return { x: pose.x + nx * offset, y: pose.y + ny * offset, angle: pose.angle };
}

export function resetGrid(world: SimWorld, now: number) {
  world.cars.forEach((car, index) => {
    const placed = placeOnGrid(world.track, index);
    car.x = placed.x;
    car.y = placed.y;
    car.angle = placed.angle;
    car.vx = 0;
    car.vy = 0;
    car.lap = 0;
    car.nextGate = 0;
    car.lapStartMs = now;
    car.bestLapMs = null;
    car.finished = false;
    car.finishTimeMs = null;
    car.item = null;
    car.boostUntil = 0;
    car.shield = false;
    car.invisibleUntil = 0;
    car.empUntil = 0;
    car.spinUntil = 0;
    car.parked = false;
    car.input = { steer: 0, throttle: 0, brake: 0 };
    car.hitUntil.clear();
  });
  world.items = [];
  world.oils = [];
  world.nextItemAt = now;
}

export function progressOf(car: SimCar, track: Track): number {
  const finish = track.gates[track.gates.length - 1];
  const length = track.length;
  const since = (along: number) => (along - finish.along + length) % length;
  const next = track.gates[car.nextGate];
  const nextDist = !next || next.finish ? length : since(next.along);
  const lastDist = () => {
    if (car.nextGate === 0) return car.lap === 0 ? since(track.spawnAlong) : 0;
    return since(track.gates[car.nextGate - 1].along);
  };
  const projected = projectPoint(track.points, car.x, car.y);
  let credited = lastDist();
  if (projected.dist <= track.width * 0.85) {
    const driven = since(projected.along);
    credited = driven <= nextDist + 25 ? Math.min(driven, nextDist) : lastDist();
  }
  return car.lap * length + credited;
}

export function collectGates(car: SimCar, track: Track, prev: Pt, next: Pt, now: number, raceStart: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let guard = 0; guard < track.gates.length && !car.finished; guard++) {
    const gate = track.gates[car.nextGate];
    if (!gate) break;
    if (!segmentsIntersect(prev, next, { x: gate.ax, y: gate.ay }, { x: gate.bx, y: gate.by })) break;
    car.nextGate += 1;
    events.push({
      type: "checkpoint_passed",
      playerId: car.id,
      playerName: car.name,
      checkpointId: gate.id,
      lap: car.lap + 1,
    });
    if (!gate.finish) continue;
    const lapTimeMs = Math.max(0, now - car.lapStartMs);
    car.bestLapMs = car.bestLapMs == null ? lapTimeMs : Math.min(car.bestLapMs, lapTimeMs);
    car.lap += 1;
    car.lapStartMs = now;
    car.nextGate = 0;
    events.push({ type: "lap_completed", playerId: car.id, playerName: car.name, lap: car.lap, lapTimeMs });
    if (car.lap >= LAPS) {
      car.finished = true;
      car.finishTimeMs = now - raceStart;
      car.vx = 0;
      car.vy = 0;
      events.push({
        type: "player_finished",
        playerId: car.id,
        playerName: car.name,
        totalTimeMs: car.finishTimeMs,
      });
    }
  }
  return events;
}

function nextId(world: SimWorld, prefix: string) {
  world.idSeq += 1;
  return `${prefix}${world.idSeq}`;
}

function spawnItems(world: SimWorld, now: number, events: SimEvent[]) {
  if (world.status !== "racing") return;
  if (world.items.length >= ITEM_LIFETIME || now < world.nextItemAt) return;
  const track = world.track;
  for (let attempt = 0; attempt < 8 && world.items.length < ITEM_LIFETIME; attempt++) {
    const along = track.length * (0.12 + Math.random() * 0.8);
    const pose = poseAt(track.points, track.length, along);
    const crowded = world.items.some((item) => Math.hypot(item.x - pose.x, item.y - pose.y) < 220);
    const nearCar = world.cars.some((car) => Math.hypot(car.x - pose.x, car.y - pose.y) < 160);
    if (crowded || nearCar) continue;
    const type = (["boost", "shield", "emp", "oil"] as const)[Math.floor(Math.random() * 4)];
    const item = { id: nextId(world, "i"), type, x: pose.x, y: pose.y };
    world.items.push(item);
    events.push({ type: "item_spawned", itemId: item.id, itemType: item.type, x: item.x, y: item.y });
  }
  world.nextItemAt = now + 3500;
}

function applyHit(car: SimCar, source: string, effect: string, durationMs: number, now: number, events: SimEvent[]) {
  const key = `${source}:${effect}`;
  if ((car.hitUntil.get(key) ?? 0) > now) return;
  car.hitUntil.set(key, now + 700);
  if (car.shield) {
    car.shield = false;
    events.push({ type: "car_hit", playerId: car.id, playerName: car.name, source, effect: "shield", durationMs: 0 });
    events.push({ type: "haptic_triggered", playerId: car.id, pattern: "hit" });
    return;
  }
  const stats = CARS[car.carId];
  if (effect === "emp") car.empUntil = Math.max(car.empUntil, now + durationMs);
  if (effect === "oil" || effect === "bump") {
    car.spinUntil = Math.max(car.spinUntil, now + durationMs);
    const kept = 1 - 0.5 * stats.damageTaken;
    car.vx *= kept;
    car.vy *= kept;
  }
  events.push({ type: "car_hit", playerId: car.id, playerName: car.name, source, effect, durationMs });
  events.push({ type: "haptic_triggered", playerId: car.id, pattern: "hit" });
}

function integrate(car: SimCar, track: Track, dt: number, now: number) {
  const stats = CARS[car.carId];
  const boosting = now < car.boostUntil;
  const slowed = now < car.empUntil;
  const spinning = now < car.spinUntil;
  let throttle = clamp(car.input.throttle, 0, 1);
  let brake = clamp(car.input.brake, 0, 1);
  let steer = clamp(car.input.steer, -1, 1);
  if (spinning) {
    throttle *= 0.25;
    steer = 0;
    car.angle += 5.2 * dt;
  }
  const hx = Math.cos(car.angle);
  const hy = Math.sin(car.angle);
  const cap = stats.maxSpeed * (boosting ? stats.boostMul : 1) * (slowed ? 0.42 : 1);
  const accel = stats.accel * (boosting ? 1.4 : 1);
  if (brake > 0) {
    const forward = car.vx * hx + car.vy * hy;
    const cut = Math.min(Math.abs(forward), stats.brake * brake * dt);
    const sign = Math.sign(forward) || 1;
    car.vx -= hx * cut * sign;
    car.vy -= hy * cut * sign;
  }
  if (throttle > 0) {
    car.vx += hx * accel * throttle * dt;
    car.vy += hy * accel * throttle * dt;
  }
  const forward = car.vx * hx + car.vy * hy;
  const latX = car.vx - hx * forward;
  const latY = car.vy - hy * forward;
  const grip = 1 - Math.exp(-stats.grip * dt);
  car.vx -= latX * grip;
  car.vy -= latY * grip;
  const drag = Math.exp(-0.55 * dt);
  car.vx *= drag;
  car.vy *= drag;
  const speed = Math.hypot(car.vx, car.vy);
  if (speed > cap) {
    car.vx *= cap / speed;
    car.vy *= cap / speed;
  }
  const speedFactor = clamp(Math.hypot(car.vx, car.vy) / 90, 0.2, 1);
  car.angle += steer * stats.turn * speedFactor * dt * (forward >= -10 ? 1 : -1);
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const close = projectPoint(track.points, car.x, car.y);
  const edge = track.width * 0.5;
  if (close.dist > edge) {
    const overflow = close.dist - edge;
    const pull = Math.min(overflow, (70 + overflow * 3) * dt);
    const nx = (close.x - car.x) / close.dist;
    const ny = (close.y - car.y) / close.dist;
    car.x += nx * pull;
    car.y += ny * pull;
    const bleed = 1 - Math.min(0.65, (overflow / track.width) * 3) * dt * 3;
    car.vx *= bleed;
    car.vy *= bleed;
  }
}

function pickup(world: SimWorld, car: SimCar, now: number, events: SimEvent[]) {
  for (let i = world.items.length - 1; i >= 0; i--) {
    const item = world.items[i];
    if (Math.hypot(car.x - item.x, car.y - item.y) > PICKUP_RADIUS) continue;
    if ((item.type === "boost" || item.type === "emp") && car.item) continue;
    world.items.splice(i, 1);
    const stats = CARS[car.carId];
    if (stats.invisMs > 0) car.invisibleUntil = now + stats.invisMs;
    events.push({
      type: "item_picked_up",
      itemId: item.id,
      playerId: car.id,
      playerName: car.name,
      itemType: item.type,
    });
    if (item.type === "boost" || item.type === "emp") {
      car.item = item.type;
    } else if (item.type === "shield") {
      car.shield = true;
      events.push({ type: "item_used", playerId: car.id, playerName: car.name, itemType: "shield" });
    } else {
      const pose = poseAt(world.track.points, world.track.length, projectPoint(world.track.points, car.x, car.y).along);
      const bx = Math.cos(pose.angle);
      const by = Math.sin(pose.angle);
      const oil = {
        id: nextId(world, "o"),
        x: car.x - bx * 28,
        y: car.y - by * 28,
        until: now + 8000,
        ownerId: car.id,
      };
      world.oils.push(oil);
      events.push({ type: "item_used", playerId: car.id, playerName: car.name, itemType: "oil" });
    }
  }
}

export function useHeldItem(world: SimWorld, car: SimCar, now: number): SimEvent[] | "empty" {
  if (!car.item || car.finished || car.parked || world.status !== "racing") return "empty";
  const itemType = car.item;
  car.item = null;
  const events: SimEvent[] = [];
  if (itemType === "boost") {
    car.boostUntil = now + CARS[car.carId].boostMs;
    events.push({ type: "item_used", playerId: car.id, playerName: car.name, itemType });
    events.push({ type: "haptic_triggered", playerId: car.id, pattern: "boost" });
    return events;
  }
  let target: SimCar | null = null;
  let best = Infinity;
  const mine = progressOf(car, world.track);
  for (const other of world.cars) {
    if (other.id === car.id || other.finished || other.parked) continue;
    if (now < other.invisibleUntil) continue;
    let ahead = progressOf(other, world.track) - mine;
    if (ahead <= 8) continue;
    if (ahead < best) {
      best = ahead;
      target = other;
    }
  }
  events.push({
    type: "item_used",
    playerId: car.id,
    playerName: car.name,
    itemType,
    targetId: target?.id,
  });
  if (target) applyHit(target, car.id, "emp", 1500, now, events);
  return events;
}

export function stepWorld(world: SimWorld, dt: number, now: number): SimEvent[] {
  const events: SimEvent[] = [];
  if (world.status !== "racing" && world.status !== "countdown") return events;
  const moving = world.status === "racing";
  for (const car of world.cars) {
    if (!moving || car.finished || car.parked) {
      car.vx = 0;
      car.vy = 0;
      continue;
    }
    const prev = { x: car.x, y: car.y };
    integrate(car, world.track, dt, now);
    if (!Number.isFinite(car.x) || !Number.isFinite(car.y)) {
      const placed = placeOnGrid(world.track, 0);
      car.x = placed.x;
      car.y = placed.y;
      car.vx = 0;
      car.vy = 0;
      continue;
    }
    events.push(...collectGates(car, world.track, prev, { x: car.x, y: car.y }, now, world.startTs ?? now));
    if (!car.finished) pickup(world, car, now, events);
  }
  world.oils = world.oils.filter((oil) => oil.until > now);
  if (moving) {
    for (const car of world.cars) {
      if (car.finished || car.parked || now < car.invisibleUntil) continue;
      for (const oil of world.oils) {
        if (oil.ownerId === car.id) continue;
        if (Math.hypot(car.x - oil.x, car.y - oil.y) > OIL_RADIUS) continue;
        applyHit(car, oil.id, "oil", 650, now, events);
      }
    }
    for (let i = 0; i < world.cars.length; i++) {
      for (let j = i + 1; j < world.cars.length; j++) {
        const a = world.cars[i];
        const b = world.cars[j];
        if (now < a.invisibleUntil || now < b.invisibleUntil) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d >= CAR_RADIUS * 2) continue;
        const nx = dx / d;
        const ny = dy / d;
        const overlap = CAR_RADIUS * 2 - d;
        if (!a.finished && !a.parked) {
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
        }
        if (!b.finished && !b.parked) {
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;
        }
        applyHit(a, b.id, "bump", 400, now, events);
        applyHit(b, a.id, "bump", 400, now, events);
      }
    }
    spawnItems(world, now, events);
  }
  return events;
}

export function carSpeed(car: SimCar): number {
  return Math.hypot(car.vx, car.vy);
}
