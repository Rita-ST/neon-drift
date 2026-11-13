import type { ServerMessage } from "@neon/shared";

const SKIP = new Set(["state_snapshot", "pong", "command_rejected", "session_opened"]);

export function toBrokerValue(message: ServerMessage): Record<string, unknown> | null {
  if (message.kind !== "event" || SKIP.has(message.type)) return null;
  const data =
    message.data && typeof message.data === "object" && !Array.isArray(message.data)
      ? { ...(message.data as Record<string, unknown>) }
      : {};
  delete data.token;
  const player = typeof data.playerName === "string" ? data.playerName : undefined;
  return {
    type: message.type,
    kind: "event",
    ts: message.ts,
    player,
    data,
  };
}

export function publishEvent(message: ServerMessage) {
  const value = toBrokerValue(message);
  const password = process.env.BROKER_PASSWORD;
  const base = process.env.BROKER_URL;
  if (!value || !password || !base) return;
  const user = process.env.BROKER_USER || "team3";
  const topic = process.env.BROKER_TOPIC || "team3.events";
  const url = `${base.replace(/\/$/, "")}/topics/${topic}`;
  const auth = Buffer.from(`${user}:${password}`).toString("base64");
  void fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/vnd.kafka.json.v2+json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ records: [{ value }] }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(`broker ${message.type} -> ${res.status} ${text.slice(0, 160)}`);
      }
    })
    .catch((err: unknown) => {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`broker ${message.type} failed: ${reason}`);
    });
}
