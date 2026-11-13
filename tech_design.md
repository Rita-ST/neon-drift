# Technical Design – Neon Drift

## 1. Project Overview

Neon Drift is an online multiplayer top-down racing game for 2–4 players.

The system combines three main technologies:

1. A browser-based racing game.
2. A central online multiplayer server.
3. Wokwi-simulated microcontroller controllers.

Players use simulated controllers to drive their cars, activate power-ups and interact with other racers.

All players connect to one public internet server. The system does not use a LAN-based multiplayer server.

The server is authoritative: it manages the official race state, player movement, collisions, checkpoints, power-ups and scores.

---

## 2. Proposed Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| Game engine | Phaser 3 | 2D racing game and rendering |
| Frontend | HTML5, CSS, TypeScript | Browser interface |
| Build tool | Vite | Frontend development and builds |
| Backend | Node.js + TypeScript | Multiplayer game server |
| Networking | WebSockets using `ws` | Real-time communication |
| Microcontroller | Arduino Uno | Controller input processing |
| Simulation | Wokwi | Simulates controller hardware |
| Bridge | Node.js or Python | Connects Wokwi serial output to the internet |
| Database | SQLite | Time Attack leaderboard |
| Frontend hosting | GitHub Pages | Public game screen |
| Backend hosting | Render | Public multiplayer server |
| CI/CD | GitHub Actions | Automated testing and deployment |

### Why these technologies?

- Phaser provides a framework for 2D game development without needing to build the rendering system from scratch.
- Node.js allows the server and bridge to use JavaScript or TypeScript.
- WebSockets provide continuous two-way communication between players and the server.
- Wokwi allows the team to demonstrate embedded controller functionality without requiring physical hardware.
- GitHub Pages and Render provide separate hosting for the game screen and multiplayer backend.

---

## 3. System Architecture

Neon Drift uses a client-server architecture.

Every player connects to the same public game server through the internet.

### Architecture Diagram

```text
 PLAYER 1 COMPUTER                 PLAYER 2 COMPUTER
+---------------------+           +---------------------+
|                     |           |                     |
| Wokwi Arduino Uno   |           | Wokwi Arduino Uno   |
|      Controller     |           |      Controller     |
|          |          |           |          |          |
|       Serial        |           |       Serial        |
|          |          |           |          |          |
|    Local Bridge     |           |    Local Bridge     |
|          |          |           |          |          |
+----------|----------+           +----------|----------+
           |                                 |
           +---------------+-----------------+
                           |
                     INTERNET
                           |
                  WSS CONNECTIONS
                           |
              +-------------------------+
              |                         |
              |   NEON DRIFT SERVER     |
              |                         |
              |      Node.js            |
              |      WebSockets         |
              |                         |
              |  - Room management      |
              |  - Player management    |
              |  - Game physics         |
              |  - Collision detection  |
              |  - Checkpoints          |
              |  - Power-up handling    |
              |  - Scoring              |
              |                         |
              +------------+------------+
                           |
                     GAME UPDATES
                           |
                 +---------+---------+
                 |                   |
           PLAYER 1 BROWSER    PLAYER 2 BROWSER
                 |                   |
               Phaser              Phaser
                 |                   |
             Game Screen         Game Screen
```

### Main Components

**A. Game Client**

The game client runs in the player's browser.

Responsibilities:
- Display the track and racing cars.
- Display the lobby and room code.
- Show player names and selected cars.
- Render movement and animations.
- Display lap counts, scores and leaderboards.
- Display power-ups and race results.
- Show connection status and server ping.

**B. Game Server**

The server is the central authority of the game.

Responsibilities:
- Create and manage multiplayer rooms.
- Allow 2–4 players to join.
- Assign player IDs and session tokens.
- Receive controller inputs.
- Calculate car movement and physics.
- Detect collisions and checkpoint completion.
- Manage power-ups and special abilities.
- Calculate lap times and final scores.
- Broadcast game updates to all players.

**C. Controller Bridge**

Each player runs a bridge application on their computer.

Responsibilities:
- Read controller information from Wokwi serial output.
- Convert serial data into structured JSON.
- Connect to the public server using WSS.
- Send player inputs to the correct game session.
- Receive feedback events from the server.
- Forward feedback commands to the controller.

The bridge is only a communication link. It does not calculate game physics or determine race results.

---

## 4. Controller Design

Each player controls their car using a Wokwi-simulated Arduino Uno.

Two controller designs are proposed.

### Option A: PSX-style Gamepad

The controller uses a gamepad-style interface.

| Input | Action |
|---|---|
| D-pad left/right or left stick | Steering |
| R2 | Acceleration |
| L2 | Braking |
| X | Activate power-up |

The team must verify the availability and compatibility of the required gamepad component before finalizing this option.

### Option B: Steering Wheel

The steering wheel is built using an Arduino Uno, potentiometer and push buttons.

| Component | Function |
|---|---|
| Potentiometer | Steering |
| Button A | Acceleration |
| Button B | Braking |
| Button C | Activate power-up |
| LED | Visual feedback |
| Buzzer | Sound feedback |

The potentiometer provides an analog value from 0 to 1023. The firmware converts this into a normalized steering value between -1.0 and 1.0.

### Controller Feedback

The controller also receives feedback from the server.

| Event | Controller Response |
|---|---|
| Boost activated | Short LED flash and buzzer beep |
| Player hit | Warning LED and buzzer |
| Player finishes | Longer LED flash and victory sound |
| Shield activated | Two short flashes |

This makes the controller interactive in both directions: it sends player inputs and receives game feedback.

---

## 5. Controller Communication

Arduino Uno does not have built-in WiFi, so the proposed design uses serial communication and a local bridge.

### Communication Process

1. The player starts the Wokwi simulation using Wokwi for VS Code.
2. The Arduino reads joystick, potentiometer and button inputs.
3. The firmware prints JSON messages through its serial interface.
4. The local bridge reads the serial data.
5. The bridge forwards the inputs to the public multiplayer server.
6. The server processes the input and updates the race.
7. The server sends feedback events back through the bridge.
8. The bridge writes feedback commands to the controller's serial interface.

Wokwi for VS Code supports serial forwarding through an RFC2217 TCP server. The proposed local configuration uses port 4000.

Example `wokwi.toml`:

```toml
[wokwi]
version = 1
rfc2217ServerPort = 4000
```

The bridge can connect using Python PySerial or an equivalent Node.js serial library.

**Important:** This local serial connection is only for controller communication. Multiplayer gameplay always takes place through the public internet server.

---

## 6. Controller Data Format

The controller sends input values as JSON messages.

Example:

```json
{
  "steer": -0.4,
  "throttle": 1.0,
  "brake": 0.0,
  "use_item": false
}
```

The bridge attaches the player's session and room information before forwarding the input to the server.

Example server message:

```json
{
  "type": "PLAYER_INPUT",
  "roomCode": "ABCD",
  "playerId": "player_01",
  "sequence": 105,
  "steer": -0.4,
  "throttle": 1.0,
  "brake": 0.0,
  "use_item": false
}
```

Values:

- `steer`: -1.0 to 1.0.
- `throttle`: 0.0 to 1.0.
- `brake`: 0.0 to 1.0.
- `use_item`: Boolean.
- `sequence`: Increasing input sequence number used to identify and process inputs.

The server validates all input values before using them.

---

## 7. Multiplayer Networking

The system uses WebSockets for continuous communication.

There are two main types of connections:

1. Browser-to-server connections for game screens.
2. Controller-bridge-to-server connections for controller inputs.

### Room Management

- A player creates a room.
- The server generates a random four-letter room code.
- Other players enter the code to join.
- Each room supports a maximum of four players.
- Players select their cars and indicate readiness.
- The server starts the race when the room is ready.

The controller bridge is paired with the correct player using a temporary pairing code generated by the server, rather than relying on the room code alone.

### Game Synchronization

Proposed initial networking targets:

| Operation | Rate |
|---|---:|
| Server simulation | 60 Hz target |
| Controller input | 30 Hz |
| Game state snapshots | 20 Hz |
| Heartbeat | Every 2 seconds |

The server calculates the official game state.

The browser uses:

- Client-side prediction for the player's own car.
- Server reconciliation using processed input sequence numbers.
- Interpolation for other players' cars.

This helps make movement appear smooth even when network latency is present.

---

## 8. Game State and Events

The server manages the shared game state, including:

- Player positions.
- Car speeds and steering.
- Current lap and checkpoint.
- Power-up availability.
- Player scores.
- Race timer.
- Player connection status.
- Race results.

Example game state snapshot:

```json
{
  "type": "STATE_SNAPSHOT",
  "roomCode": "ABCD",
  "tick": 1200,
  "players": [
    {
      "id": "player_01",
      "x": 240,
      "y": 150,
      "speed": 65,
      "lap": 2,
      "score": 10
    }
  ]
}
```

The server broadcasts snapshots to all players in the same room.

The full event definitions and payload structures are documented in `game_events.md`.

---

## 9. Server Authority and Game Rules

The server is responsible for all important gameplay calculations.

### Server-controlled operations

- Car movement and physics.
- Collision detection.
- Power-up collection and activation.
- Checkpoint validation.
- Lap completion.
- Race finishing order.
- Final scores.

Clients are not allowed to directly modify their scores, positions or race results.

The server checks checkpoint order to prevent players from taking shortcuts.

### Race Rules

**Race mode:**
- Three laps per race.
- First player to complete three laps wins.
- Other players have 20 seconds to finish after the first player crosses the line.

**Championship:**
- Three tracks.
- Points awarded according to finishing position.
- Bonus points for the fastest lap.
- Highest cumulative score wins.

**Time Attack:**
- Players compete for the best lap time.
- Valid lap times are stored in the leaderboard.

---

## 10. Online Deployment

The game will be hosted using two separate services.

| Component | Hosting | Address |
|---|---|---|
| Game frontend | GitHub Pages | `https://username.github.io/neon-drift/` |
| Game backend | Render | `wss://neon-drift-server.onrender.com` |
| Controller simulation | Wokwi | Player's computer |
| Controller bridge | Local computer | Player's computer |

The server URL will be configured using an environment variable during the frontend build and bridge configuration.

Only secure WebSocket connections (`wss://`) will be used in production.

### Connection Handling

The system will support:

- Connection status indicators.
- Ping/pong messages to measure latency.
- Automatic reconnection with exponential backoff.
- Session tokens for player recovery.
- Room rejoining after temporary disconnection.

A disconnected player's car remains parked for 10 seconds before being removed.

**Hosting consideration:** The selected backend hosting plan must support persistent WebSocket connections. If a free-tier service sleeps or restarts, the team must account for temporary disconnections and lost in-memory rooms.

---

## 11. Security and Reliability

The server will implement basic security measures.

- Validate all incoming player inputs.
- Limit input messages to a maximum of 60 per second per player.
- Use unique session tokens.
- Generate random room codes.
- Validate controller pairing.
- Prevent players from modifying other players' data.
- Ignore invalid or outdated input sequence numbers.
- Disconnect clients that fail to respond to heartbeats.
- Restrict browser connections to the official game domain.

Browser origin checks are an additional protection, not a replacement for authentication. Controller bridges must also authenticate using their assigned pairing credentials.

---

## 12. Database and Persistence

SQLite is proposed for storing Time Attack leaderboard records.

Example leaderboard fields:

| Field | Description |
|---|---|
| player_id | Unique player identifier |
| player_name | Display name |
| track_id | Track completed |
| lap_time | Recorded lap time |
| date | Record date |

Multiplayer rooms and active races will initially be stored in server memory.

Leaderboard records will be stored persistently in SQLite.

---

## 13. Repository Structure

```text
neon-drift/
│
├── README.md
├── concept.md
├── game_events.md
├── tech_design.md
│
├── server/
│   ├── src/
│   │   ├── rooms/
│   │   ├── physics/
│   │   ├── events/
│   │   ├── networking/
│   │   └── index.ts
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── scenes/
│   │   ├── entities/
│   │   ├── networking/
│   │   └── main.ts
│   └── package.json
│
├── controller/
│   ├── psx/
│   └── wheel/
│
├── bridge/
│   ├── src/
│   └── package.json
│
├── shared/
│   └── events.ts
│
└── .github/
    └── workflows/
```

---

## 14. Testing Strategy

The team will test the system in separate stages.

**Controller testing**
- Test steering values.
- Test acceleration and braking.
- Test power-up buttons.
- Test LED and buzzer feedback.
- Test serial communication with the bridge.

**Server testing**
- Test room creation and joining.
- Test player limits.
- Test input validation.
- Test collisions and checkpoints.
- Test scoring and race completion.

**Multiplayer testing**
- Connect four players simultaneously.
- Connect players from different internet networks.
- Test latency and synchronization.
- Test disconnections and reconnections.
- Test controller pairing.

**Performance testing**
- Use simulated bot clients to test multiple simultaneous rooms.
- Measure server tick stability and message delivery.

---

## 15. Development Milestones

| Week | Main Tasks | Expected Result |
|---|---|---|
| 1 | Server, WebSocket connections, rooms and event definitions | Players can create and join rooms |
| 2 | Phaser game screen, car movement and race mechanics | Playable browser-based racing prototype |
| 3 | Wokwi controllers, serial bridge and power-ups | Controllers can control cars online |
| 4 | Deployment, testing and integration | Four-player multiplayer demonstration |

---

## 16. Conclusion

Neon Drift combines multiplayer game development, embedded systems and real-time internet communication.

The project demonstrates how simulated microcontrollers can be used as interactive game controllers and connected to a shared online multiplayer environment.

The modular architecture allows the thre main components — game client, game server and controller system — to be developed independently and integrated into one complete game.
  