import assert from "node:assert/strict";
import test from "node:test";
import { TRACKS, clamp, poseAt, projectPoint, wrapAngle } from "@neon/shared";
import { collectGates, freshCar, stepWorld, type SimWorld } from "./sim.js";

test("a car that follows the centerline completes one lap and no extra", () => {
  const track = TRACKS[0];
  const car = freshCar("p", "Ada", "volt", track, 0, 0);
  let along = track.spawnAlong;
  let prev = poseAt(track.points, track.length, along);
  const end = track.spawnAlong + track.length;
  let guard = 0;
  while (along < end && guard < 8000) {
    guard += 1;
    along = Math.min(end, along + 12);
    const next = poseAt(track.points, track.length, along);
    collectGates(car, track, prev, next, guard * 40, 0);
    prev = next;
    car.x = next.x;
    car.y = next.y;
  }
  assert.equal(car.lap, 1, `lap=${car.lap} next=${car.nextGate} steps=${guard}`);
  assert.equal(car.nextGate, 0);
});

test("cutting across the infield does not award the next checkpoint", () => {
  const track = TRACKS[0];
  const car = freshCar("p", "Ada", "pixel", track, 0, 0);
  const start = poseAt(track.points, track.length, track.spawnAlong);
  const far = { x: track.bounds.cx, y: track.bounds.cy };
  collectGates(car, track, start, far, 1000, 0);
  assert.equal(car.nextGate, 0);
  assert.equal(car.lap, 0);
});

test("a steering bot finishes a lap on Reactor Core", () => {
  const track = TRACKS[1];
  const car = freshCar("bot", "Bot", "pixel", track, 1, 0);
  const world: SimWorld = {
    track,
    cars: [car],
    items: [],
    oils: [],
    status: "racing",
    startTs: 0,
    nextItemAt: Number.POSITIVE_INFINITY,
    idSeq: 0,
  };
  const dt = 1 / 30;
  for (let frame = 0; frame < 30 * 100 && car.lap < 1; frame++) {
    const close = projectPoint(track.points, car.x, car.y);
    const look = poseAt(track.points, track.length, close.along + 200);
    const aim = Math.atan2(look.y - car.y, look.x - car.x);
    car.input.steer = clamp(wrapAngle(aim - car.angle) * 1.8, -1, 1);
    car.input.throttle = Math.abs(wrapAngle(aim - car.angle)) > 1.05 ? 0.4 : 1;
    car.input.brake = 0;
    stepWorld(world, dt, frame * dt * 1000);
  }
  assert.equal(car.lap >= 1, true, `lap=${car.lap} next=${car.nextGate} x=${car.x.toFixed(0)} y=${car.y.toFixed(0)}`);
});
