import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { WebSocket } from "ws";
import type { ServerMessage } from "@neon/shared";

test.describe("game server", { concurrency: 1 }, () => {
  test("two players reach the grid, and a solo time attack car moves", async () => {
    process.env.LEADERBOARD_PATH = path.join(mkdtempSync(path.join(tmpdir(), "neon-")), "board.sqlite");
    delete process.env.BROKER_PASSWORD;
    const { startServer } = await import("./server.js");
    const server = await startServer(0);
    try {
      const ada = await open(server.port);
      const bea = await open(server.port);
      send(ada.ws, "connect", { playerName: "Ada" });
      send(bea.ws, "connect", { playerName: "Bea" });
      await ada.wait((msg) => msg.type === "session_opened");
      await bea.wait((msg) => msg.type === "session_opened");

      send(ada.ws, "create_room", { trackId: 1, maxPlayers: 4, mode: "race" });
      const created = await ada.wait((msg) => msg.type === "room_created");
      const roomCode = (created.data as { roomCode: string }).roomCode;
      assert.match(roomCode, /^[A-Z]{4}$/);

      send(bea.ws, "join_room", { roomCode: "ZZZZ" });
      const missing = await bea.wait((msg) => msg.type === "command_rejected");
      assert.equal((missing.data as { code: string }).code, "ROOM_NOT_FOUND");

      send(bea.ws, "join_room", { roomCode });
      await ada.wait((msg) => msg.type === "room_joined" && (msg.data as { playerName?: string }).playerName === "Bea");
      send(ada.ws, "select_car", { carId: "pixel" });
      send(ada.ws, "set_ready", { ready: true });
      await delay(400);
      assert.equal(ada.messages.some((msg) => msg.type === "race_started"), false);

      send(bea.ws, "select_car", { carId: "bulk" });
      send(bea.ws, "set_ready", { ready: true });
      await ada.wait((msg) => msg.type === "countdown_ticked");
      ada.ws.close();
      bea.ws.close();

      const cy = await open(server.port);
      send(cy.ws, "connect", { playerName: "Cy" });
      await cy.wait((msg) => msg.type === "session_opened");
      send(cy.ws, "create_room", { trackId: 2, maxPlayers: 1, mode: "time_attack" });
      await cy.wait((msg) => msg.type === "room_created");
      send(cy.ws, "set_ready", { ready: true });
      await cy.wait((msg) => msg.type === "race_started", 6000);
      send(cy.ws, "use_item", { seq: 1 });
      const rejected = await cy.wait((msg) => msg.type === "command_rejected");
      assert.equal((rejected.data as { code: string }).code, "NO_ITEM");
      const before = await cy.wait((msg) => msg.type === "state_snapshot");
      const startedAt = (before.data as { players: { x: number }[] }).players[0].x;
      send(cy.ws, "set_input", { seq: 2, steer: 0, throttle: 1, brake: 0 });
      const moved = await cy.wait((msg) => {
        if (msg.type !== "state_snapshot") return false;
        const player = (msg.data as { players: { x: number; speed: number }[] }).players[0];
        return player.speed > 40 || Math.abs(player.x - startedAt) > 20;
      }, 3000);
      assert.ok(moved);
      cy.ws.close();
    } finally {
      await server.close();
    }
  });

  test("the wheel bridge protocol attaches and drives", async () => {
    process.env.LEADERBOARD_PATH = path.join(mkdtempSync(path.join(tmpdir(), "neon-")), "board.sqlite");
    delete process.env.BROKER_PASSWORD;
    const { startServer } = await import("./server.js");
    const server = await startServer(0);
    try {
      const ada = await open(server.port);
      const wheel = await open(server.port);
      send(ada.ws, "connect", { playerName: "Ada" });
      await ada.wait((msg) => msg.type === "session_opened");
      send(ada.ws, "create_room", { trackId: 1, maxPlayers: 1, mode: "time_attack" });
      const created = await ada.wait((msg) => msg.type === "room_created");
      const roomCode = (created.data as { roomCode: string }).roomCode;
      send(ada.ws, "set_ready", { ready: true });
      await ada.wait((msg) => msg.type === "race_started", 6000);

      wheel.ws.send(JSON.stringify({
        command: "connect_controller",
        payload: { room_code: roomCode, player_id: "Ada" },
      }));
      const linked = await ada.wait((msg) => msg.type === "controller_attached");
      assert.equal((linked.data as { deviceType: string }).deviceType, "wheel");

      wheel.ws.send(JSON.stringify({
        command: "drive_input",
        payload: { player_id: "Ada", sequence: 1, steer: 0, throttle: 1, brake: 0 },
      }));
      const moved = await ada.wait((msg) => {
        if (msg.type !== "state_snapshot") return false;
        const player = (msg.data as { players: { speed: number }[] }).players[0];
        return player.speed > 40;
      }, 3000);
      assert.ok(moved);

      wheel.ws.send(JSON.stringify({
        command: "use_item",
        payload: { player_id: "Ada" },
      }));
      const rejected = await wheel.wait((msg) => msg.type === "command_rejected");
      assert.equal((rejected.data as { code: string }).code, "NO_ITEM");
      ada.ws.close();
      wheel.ws.close();
    } finally {
      await server.close();
    }
  });
});

let seq = 0;

function send(ws: WebSocket, type: string, data: Record<string, unknown>) {
  seq += 1;
  ws.send(JSON.stringify({ kind: "command", type, cmdId: `t-${seq}`, ts: Date.now(), data }));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function open(port: number) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
  const messages: ServerMessage[] = [];
  ws.on("message", (buf) => {
    messages.push(JSON.parse(buf.toString()) as ServerMessage);
  });
  return {
    ws,
    messages,
    wait(pred: (msg: ServerMessage) => boolean, ms = 2500) {
      return new Promise<ServerMessage>((resolve, reject) => {
        const started = Date.now();
        const timer = setInterval(() => {
          const found = messages.find(pred);
          if (found) {
            clearInterval(timer);
            resolve(found);
          } else if (Date.now() - started > ms) {
            clearInterval(timer);
            reject(new Error(`timeout waiting, saw ${messages.map((msg) => msg.type).join(" ")}`));
          }
        }, 20);
      });
    },
  };
}
