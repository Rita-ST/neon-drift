import { POINTS, type RaceResult } from "@neon/shared";

export type ScoreEntry = {
  playerId: string;
  playerName: string;
  finished: boolean;
  totalTimeMs: number | null;
  bestLapMs: number | null;
  progress: number;
};

export function scoreRace(entries: ScoreEntry[], previous: Record<string, number>): RaceResult[] {
  const ordered = [...entries].sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished && b.finished) return (a.totalTimeMs ?? Number.POSITIVE_INFINITY) - (b.totalTimeMs ?? Number.POSITIVE_INFINITY);
    return b.progress - a.progress;
  });
  let fastest: number | null = null;
  for (const entry of ordered) {
    if (entry.bestLapMs == null) continue;
    fastest = fastest == null ? entry.bestLapMs : Math.min(fastest, entry.bestLapMs);
  }
  return ordered.map((entry, index) => {
    let points = POINTS[index] ?? 0;
    const fastestLap = fastest != null && entry.bestLapMs === fastest;
    if (fastestLap) points += 1;
    const totalPoints = (previous[entry.playerId] ?? 0) + points;
    return {
      playerId: entry.playerId,
      playerName: entry.playerName,
      position: index + 1,
      totalTimeMs: entry.finished ? entry.totalTimeMs : null,
      bestLapMs: entry.bestLapMs,
      points,
      totalPoints,
      finished: entry.finished,
      fastestLap,
    };
  });
}
