import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer } from "ws";
import { trackById } from "@neon/shared";
import { handleSocket, resetState, tick } from "./hub.js";
import { closeStore, topLaps } from "./store.js";

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function handleHttp(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }
  if (req.method === "GET" && url.pathname === "/leaderboard") {
    const trackId = Number(url.searchParams.get("trackId") || "1");
    if (!trackById(trackId)) {
      sendJson(res, 400, { error: "Unknown track" });
      return;
    }
    sendJson(res, 200, { trackId, rows: topLaps(trackId, 10) });
    return;
  }
  sendJson(res, 404, { error: "Not found" });
}

export async function startServer(port = Number(process.env.PORT) || 8787) {
  const http = createServer(handleHttp);
  const wss = new WebSocketServer({ server: http });
  wss.on("connection", (ws) => handleSocket(ws));
  let last = Date.now();
  const timer = setInterval(() => {
    const now = Date.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tick(dt, now);
  }, 1000 / 30);

  await new Promise<void>((resolve) => {
    http.listen(port, "0.0.0.0", () => resolve());
  });
  const address = http.address();
  const actual = typeof address === "object" && address ? address.port : port;
  const broker = Boolean(process.env.BROKER_PASSWORD && process.env.BROKER_URL);
  console.log(`Neon Drift server on :${actual} (broker ${broker ? "on" : "off"})`);

  return {
    port: actual,
    async close() {
      clearInterval(timer);
      for (const client of wss.clients) client.close();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => http.close(() => resolve()));
      resetState();
      closeStore();
    },
  };
}
