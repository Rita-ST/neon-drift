# Game Events

Transport: WebSocket over TLS (`wss://`) to the online server. Messages are JSON: `{ "type": "<event>", "ts": <ms>, "data": {...} }`.
Direction: **C→S** client, controller or bridge to server; **S→C** server to clients.

## Connection & lobby
| Event | Dir | Payload | Description |
|-------|-----|---------|-------------|
| `connect` | C→S | `{ playerName, token? }` | Open session; token allows rejoin |
| `welcome` | S→C | `{ playerId, token }` | Session accepted |
| `create_room` | C→S | `{ trackId, maxPlayers }` | Create room |
| `room_created` | S→C | `{ roomCode }` | Room code returned |
| `join_room` | C→S | `{ roomCode }` | Join existing room |
| `room_state` | S→C | `{ players[], trackId, status }` | Lobby snapshot on any change |
| `select_car` | C→S | `{ carId }` | Pick a car |
| `set_ready` | C→S | `{ ready }` | Toggle ready |
| `leave_room` | C→S | `{}` | Leave lobby or race |
| `error` | S→C | `{ code, message }` | ROOM_FULL, ROOM_NOT_FOUND, ... |

## Controller
| Event | Dir | Payload | Description |
|-------|-----|---------|-------------|
| `controller_attach` | C→S | `{ deviceType: "psx"\|"wheel", roomCode, playerName }` | Bridge links a Wokwi controller to a player |
| `input` | C→S | `{ seq, steer: -1..1, throttle: 0..1, brake: 0..1 }` | 30 Hz, only on change (+ 5 Hz heartbeat) |
| `use_item` | C→S | `{ seq }` | Activate held power-up |
| `haptic` | S→C | `{ pattern: "hit"\|"boost"\|"finish" }` | Buzzer / LED pattern on the controller |
| `ping` / `pong` | both | `{ ts }` | Latency measurement |

## Race lifecycle
| Event | Dir | Payload | Description |
|-------|-----|---------|-------------|
| `race_countdown` | S→C | `{ seconds }` | 3-2-1 |
| `race_start` | S→C | `{ startTs }` | Driving enabled |
| `checkpoint_passed` | S→C | `{ playerId, checkpointId, lap }` | Validated by server |
| `lap_completed` | S→C | `{ playerId, lap, lapTimeMs }` | |
| `player_finished` | S→C | `{ playerId, position, totalTimeMs }` | |
| `race_end` | S→C | `{ results[] }` | Final standings and points |
| `rematch_vote` | C→S | `{ vote }` | |

## World state
| Event | Dir | Payload | Description |
|-------|-----|---------|-------------|
| `state_snapshot` | S→C | `{ tick, cars[{id,x,y,angle,speed,shield}], lastProcessedSeq }` | 20 Hz authoritative state |
| `item_spawned` | S→C | `{ itemId, type, x, y }` | Pickup appears |
| `item_picked_up` | S→C | `{ itemId, playerId, type }` | |
| `item_used` | S→C | `{ playerId, type, targetId? }` | |
| `car_hit` | S→C | `{ playerId, source, effect, durationMs }` | Slow, spin, ... |
| `player_disconnected` | S→C | `{ playerId }` | |
| `player_reconnected` | S→C | `{ playerId }` | |
