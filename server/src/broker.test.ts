import assert from "node:assert/strict";
import test from "node:test";
import type { ServerMessage } from "@neon/shared";
import { toBrokerValue } from "./broker.js";

test("broker payload keeps the event type and drops session tokens", () => {
  const hidden: ServerMessage = {
    kind: "event",
    type: "session_opened",
    ts: 10,
    data: { playerId: "p1", token: "secret" },
  };
  assert.equal(toBrokerValue(hidden), null);

  const joined: ServerMessage = {
    kind: "event",
    type: "room_joined",
    ts: 20,
    data: { playerId: "p1", playerName: "Ada", roomCode: "ABCD", token: "nope" },
  };
  const value = toBrokerValue(joined);
  assert.equal(value?.type, "room_joined");
  assert.equal(value?.player, "Ada");
  const data = value?.data as Record<string, unknown>;
  assert.equal(data.token, undefined);
  assert.equal(data.roomCode, "ABCD");
});

test("snapshots are not published", () => {
  const snap: ServerMessage = { kind: "snapshot", type: "state_snapshot", ts: 1, data: { players: [] } };
  assert.equal(toBrokerValue(snap), null);
});
