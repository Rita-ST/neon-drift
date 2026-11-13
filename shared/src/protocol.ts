import type { CarId } from "./cars.js";

export const ITEM_TYPES = ["boost", "shield", "emp", "oil"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];
export type HeldItem = "boost" | "emp";
export type GameMode = "race" | "time_attack";
export type RoomStatus = "lobby" | "countdown" | "racing" | "finished";

export type CommandType =
  | "connect"
  | "create_room"
  | "join_room"
  | "leave_room"
  | "select_car"
  | "set_ready"
  | "vote_rematch"
  | "attach_controller"
  | "set_input"
  | "use_item"
  | "ping";

export type Command = {
  kind: "command";
  type: CommandType;
  cmdId: string;
  ts: number;
  data: Record<string, unknown>;
};

export type ServerMessage = {
  kind: "event" | "snapshot";
  type: string;
  ts: number;
  causedBy?: string;
  data?: unknown;
};

export type SnapshotPlayer = {
  id: string;
  name: string;
  carId: CarId;
  x: number;
  y: number;
  angle: number;
  speed: number;
  lap: number;
  checkpoint: number;
  place: number;
  finished: boolean;
  item: HeldItem | null;
  boost: boolean;
  shield: boolean;
  invisible: boolean;
  parked: boolean;
  slow: boolean;
  spinning: boolean;
  bestLapMs: number | null;
};

export type SnapshotItem = { id: string; type: ItemType; x: number; y: number };
export type SnapshotOil = { id: string; x: number; y: number };

export type StateSnapshot = {
  roomCode: string;
  trackId: number;
  mode: GameMode;
  status: RoomStatus;
  tick: number;
  startTs: number | null;
  endsAt: number | null;
  serverNow: number;
  countdown: number | null;
  players: SnapshotPlayer[];
  items: SnapshotItem[];
  oils: SnapshotOil[];
};

export type LobbyPlayer = {
  playerId: string;
  playerName: string;
  carId: CarId;
  ready: boolean;
  connected: boolean;
  totalPoints: number;
};

export type RoomState = {
  players: LobbyPlayer[];
  trackId: number;
  mode: GameMode;
  status: RoomStatus;
  maxPlayers: number;
  hostId: string;
  roomCode: string;
};

export type RaceResult = {
  playerId: string;
  playerName: string;
  position: number;
  totalTimeMs: number | null;
  bestLapMs: number | null;
  points: number;
  totalPoints: number;
  finished: boolean;
  fastestLap: boolean;
};

export type LeaderboardRow = {
  player_name: string;
  track_id: number;
  lap_time_ms: number;
  mode: string;
  created_at: string;
};

const COMMANDS = new Set<string>([
  "connect",
  "create_room",
  "join_room",
  "leave_room",
  "select_car",
  "set_ready",
  "vote_rematch",
  "attach_controller",
  "set_input",
  "use_item",
  "ping",
]);

export function parseCommand(raw: string): { ok: true; command: Command } | { ok: false; error: string; cmdId?: string } {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, error: "BAD_MESSAGE" };
  }
  if (!body || typeof body !== "object") return { ok: false, error: "BAD_MESSAGE" };
  const rec = body as Record<string, unknown>;
  const cmdId = typeof rec.cmdId === "string" ? rec.cmdId.slice(0, 40) : undefined;
  if (rec.kind !== "command" || typeof rec.type !== "string" || !COMMANDS.has(rec.type)) {
    return { ok: false, error: "BAD_MESSAGE", cmdId };
  }
  const data = rec.data && typeof rec.data === "object" && !Array.isArray(rec.data) ? (rec.data as Record<string, unknown>) : {};
  return {
    ok: true,
    command: {
      kind: "command",
      type: rec.type as CommandType,
      cmdId: cmdId || `c-${Date.now()}`,
      ts: typeof rec.ts === "number" ? rec.ts : Date.now(),
      data,
    },
  };
}
