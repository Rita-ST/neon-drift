import assert from "node:assert/strict";
import test from "node:test";
import { scoreRace } from "./score.js";

test("finishing order scores 10/6 and the fastest lap adds one", () => {
  const results = scoreRace(
    [
      { playerId: "a", playerName: "Ada", finished: true, totalTimeMs: 90_000, bestLapMs: 30_000, progress: 3 },
      { playerId: "b", playerName: "Bea", finished: true, totalTimeMs: 95_000, bestLapMs: 28_000, progress: 3 },
      { playerId: "c", playerName: "Cy", finished: false, totalTimeMs: null, bestLapMs: 40_000, progress: 1.2 },
    ],
    { a: 6 },
  );
  assert.deepEqual(
    results.map((row) => [row.playerId, row.position, row.points, row.totalPoints, row.fastestLap]),
    [
      ["a", 1, 10, 16, false],
      ["b", 2, 7, 7, true],
      ["c", 3, 3, 3, false],
    ],
  );
});
