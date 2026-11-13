# Neon Drift

An online multiplayer top-down racing game for 2-4 players. Players race neon cars around a futuristic track, collect power-ups and sabotage each other. Every player drives with a **Wokwi-simulated controller** (PSX gamepad or steering wheel), and all players meet on **one public internet server**.

## Team
| Name | Role |
|------|------|
| Batuhan Mert Elma | Game server & networking |
| Muhsin Arsu | Game screen (web client) |
| Rita Gadlela | Wokwi controllers, bridge & docs |

## Docs
- [Game concept](concept.md)
- [Game events](game_events.md)
- [Tech design](tech_design.md)

## How to play
1. Open the game screen in a browser: `https://<username>.github.io/neon-drift/`
2. One player creates a room and shares the 4-letter room code.
3. Each player starts their Wokwi controller project and the bridge (`/bridge`), enters the room code, and presses Ready.
4. Race 3 laps. First across the line wins.

The game server runs online at `wss://neon-drift-server.onrender.com` (placeholder, update after deployment). Nothing else needs to be installed except the Wokwi project and the bridge on the player's computer.

## Run locally

Wokwi controllers and the serial bridge are a separate piece. This repo runs the game without them: the browser sends the same `set_input` / `use_item` commands the bridge will send later.

```bash
npm install
cp .env.example .env   # optional; put BROKER_PASSWORD here, never commit .env
npm run dev
```

- Game screen: `http://localhost:5173`
- Game server: `ws://localhost:8787`

Race rooms start when at least two drivers are ready. Time Attack starts with one. Drive with WASD or the arrow keys. Space uses a held boost or EMP. Shield and oil fire on pickup.

## Wheel bridge

The ESP32 wheel lives in `controller/wheel` (Wokwi, serial on port 4000). `bridge/bridge.py` reads that serial port and drives the car.

1. Create or join a room in the browser and leave the tab open.
2. Copy the room code and your driver name into `bridge/.env` (`ROOM_CODE`, `PLAYER_ID`). `PLAYER_ID` is the name you typed, not a separate account.
3. Start the Wokwi simulation, then `pip install -r bridge/requirements.txt` and `python bridge/bridge.py`.

The bridge sends `connect_controller`, `drive_input` and `use_item`. Hits, boosts and the finish line come back as `controller_feedback` and the sketch flashes the LED and buzzes. Keyboard still works until the bridge is connected; after that the wheel owns the pedals.

The server publishes finished events (`room_joined`, `lap_completed`, `race_ended`, …) to the course Redpanda broker when `BROKER_URL`, `BROKER_USER` and `BROKER_PASSWORD` are set. Snapshots and session tokens stay off that topic. Wire format is `game_events.md`.
