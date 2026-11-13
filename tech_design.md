# Tech Design

## Goal
All players connect over the internet to **one public game server**. Each player drives with a **Wokwi-simulated controller**. There is no LAN or localhost mode.

## Tech stack
| Layer | Choice | Why |
|-------|--------|-----|
| Game server | Node.js + `ws` (TypeScript), hosted on Render or Fly.io | Public URL with HTTPS/WSS, simple WebSockets |
| Game screen | HTML5 Canvas + TypeScript + Vite, hosted on GitHub Pages | Runs in any browser, no install |
| Controller | Arduino Uno firmware (C++) simulated in **Wokwi** | Hardware-style input without hardware |
| Controller link | Serial → **bridge** (Node.js, on the player's PC) → `wss://` to server | Uno has no WiFi; bridge connects it to the internet |
| CI/CD | GitHub Actions (lint, tests, auto-deploy `main`) | |

## Architecture
```
 Player 1 PC:  Wokwi Uno ─serial─► Bridge ──wss──┐
 Player 2 PC:  Wokwi Uno ─serial─► Bridge ──wss──┤
 Player 3 PC:  Wokwi Uno ─serial─► Bridge ──wss──┼─► Public Game Server ─► Rooms ─► Game loop
 Game screens (browsers) ──────────────────wss───┘            ▲                      │
                                                              └── state_snapshot ◄───┘
```

- **Authoritative server:** physics, collisions, checkpoints and items run on the server. Controllers only send inputs.
- **Game screen:** renders the race from `state_snapshot` events. Own car uses client prediction (reconciled with `lastProcessedSeq`); other cars are interpolated with a 100 ms buffer.
- **Rooms:** one in-memory room per race, max 4 players.
- **Tick rates:** simulation 60 Hz, snapshots 20 Hz, input 30 Hz.
- **Persistence (optional):** SQLite for the Time Attack leaderboard.

## Online-only deployment
- One public server hosts all rooms; players on different networks join by room code.
- Server URL comes from an environment variable (`SERVER_URL=wss://...`) in the screen and in the bridge.
- `wss://` only (TLS). Server accepts connections only from the official screen domain and from bridges that send a valid `connect` message.
- Free-tier servers may sleep: an uptime pinger calls `/health` every 5 minutes, and the screen shows "connecting to server...".
- Choose the server region closest to the players (e.g. Frankfurt). Ping is measured with `ping`/`pong` and shown on screen.
- Clients and bridges reconnect with exponential backoff and rejoin using the session token.

## Controllers (Wokwi)
Both controllers run on an Arduino Uno in Wokwi. The firmware prints one JSON line per change over serial (115200 baud), e.g. `{"steer":-0.4,"throttle":1,"brake":0}`.

### Option A: PSX (PS2) gamepad
- Part: `wokwi-ps2-gamepad` wired to the Uno (DAT, CMD, SEL, CLK).
- Mapping: D-pad / left stick X → `steer`, R2 → `throttle`, L2 → `brake`, X → `use_item`.
- Polled every 33 ms.

### Option B: Steering wheel
- Potentiometer for steering (ADC 0-1023 → -1..1 with deadzone), pushbuttons for throttle, brake and item.

### Feedback
Server `haptic` events reach the Uno as short serial commands: a buzzer beep and LED blink for hit, boost and finish.

### Bridge
The bridge reads serial lines from the Wokwi simulation (Wokwi VS Code extension forwards serial on `localhost:4000`), converts them to `input` / `use_item` events, and sends them to the online server over `wss://`. It sends `controller_attach` with the room code at startup and relays `haptic` events back to the Uno.

## Repository layout
```
/server       game server
/client       game screen
/controller   Wokwi projects (psx/, wheel/): sketch, diagram.json
/bridge       serial-to-WebSocket bridge
/shared       event type definitions (TypeScript)
```

## Security & robustness
- Server validates input ranges and rate-limits (max 60 msgs/s per player).
- Session token for reconnects; room codes are random 4 letters.
- Heartbeat: connection dropped after 5 s of silence.

## Testing
- Unit tests for physics and checkpoint logic.
- Bot client sending random inputs to simulate 20 rooms.
- Manual test: 4 players on different networks connected to the public server.

## Milestones
1. Server, lobby, rooms and events (week 1)
2. Driving, snapshots and prediction on the game screen (week 2)
3. Wokwi controllers and bridge, power-ups (week 3)
4. Public deployment, 4-player internet test, demo (week 4)
