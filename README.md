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
