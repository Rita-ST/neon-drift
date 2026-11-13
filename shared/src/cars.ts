export const CAR_IDS = ["volt", "pixel", "bulk", "ghost"] as const;
export type CarId = (typeof CAR_IDS)[number];

export type CarStats = {
  id: CarId;
  name: string;
  blurb: string;
  maxSpeed: number;
  accel: number;
  brake: number;
  turn: number;
  grip: number;
  boostMul: number;
  boostMs: number;
  damageTaken: number;
  invisMs: number;
};

export const CARS: Record<CarId, CarStats> = {
  volt: {
    id: "volt",
    name: "Volt",
    blurb: "High speed, long boost",
    maxSpeed: 340,
    accel: 260,
    brake: 460,
    turn: 2.05,
    grip: 6,
    boostMul: 1.45,
    boostMs: 2800,
    damageTaken: 1,
    invisMs: 0,
  },
  pixel: {
    id: "pixel",
    name: "Pixel",
    blurb: "Tighter drift",
    maxSpeed: 285,
    accel: 300,
    brake: 520,
    turn: 3.25,
    grip: 14,
    boostMul: 1.22,
    boostMs: 2000,
    damageTaken: 1,
    invisMs: 0,
  },
  bulk: {
    id: "bulk",
    name: "Bulk",
    blurb: "Takes less damage",
    maxSpeed: 235,
    accel: 190,
    brake: 360,
    turn: 2.25,
    grip: 9,
    boostMul: 1.18,
    boostMs: 2000,
    damageTaken: 0.35,
    invisMs: 0,
  },
  ghost: {
    id: "ghost",
    name: "Ghost",
    blurb: "Short invisibility on pickup",
    maxSpeed: 290,
    accel: 250,
    brake: 430,
    turn: 2.5,
    grip: 8,
    boostMul: 1.28,
    boostMs: 2000,
    damageTaken: 1,
    invisMs: 1600,
  },
};

export function isCarId(value: unknown): value is CarId {
  return typeof value === "string" && (CAR_IDS as readonly string[]).includes(value);
}
