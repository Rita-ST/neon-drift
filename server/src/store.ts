import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { LeaderboardRow } from "@neon/shared";

let db: DatabaseSync | null = null;

function database(): DatabaseSync {
  if (db) return db;
  const file = process.env.LEADERBOARD_PATH || path.resolve("data", "leaderboard.sqlite");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS laps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL,
      track_id INTEGER NOT NULL,
      lap_time_ms INTEGER NOT NULL,
      mode TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  return db;
}

export function recordLap(playerName: string, trackId: number, lapTimeMs: number, mode: string) {
  database()
    .prepare(
      `INSERT INTO laps (player_name, track_id, lap_time_ms, mode, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(playerName, trackId, Math.round(lapTimeMs), mode, new Date().toISOString());
}

export function topLaps(trackId: number, limit = 10): LeaderboardRow[] {
  return database()
    .prepare(
      `SELECT player_name, track_id, lap_time_ms, mode, created_at
       FROM laps WHERE track_id = ? ORDER BY lap_time_ms ASC LIMIT ?`,
    )
    .all(trackId, limit) as unknown as LeaderboardRow[];
}

export function closeStore() {
  db?.close();
  db = null;
}
