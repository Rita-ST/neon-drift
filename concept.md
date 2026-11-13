# Game Concept: Neon Drift

## Pitch
Fast, arcade-style online racing for 2-4 players. Everyone drives a neon car on a shared track hosted on an internet server. Pickups give boosts or let you hit rivals. A race lasts about 3 minutes.

## Game modes
1. **Race:** 3 laps, first to finish wins. Points by finishing position.
2. **Time Attack:** best lap time goes on an online leaderboard.

## Scenarios
- **Lobby:** a player creates a room (4-letter code) or joins one. Players pick a car and press Ready.
- **Race:** 3-2-1 countdown, then free driving. The server checks checkpoints so shortcuts do not count.
- **Finish:** after the first finisher, others have 20 s to complete. Results screen, then rematch or back to lobby.
- **Disconnect:** the car is parked for 10 s, then removed. The player can rejoin with the same session token.

## Characters (cars)
| Car | Speed | Handling | Special |
|-----|-------|----------|---------|
| Volt | High | Low | Longer boost |
| Pixel | Medium | High | Tighter drift |
| Bulk | Low | Medium | Takes less damage |
| Ghost | Medium | Medium | Short invisibility on pickup |

## Power-ups
- **Boost:** speed burst for 2 s.
- **Shield:** absorbs one hit.
- **EMP:** slows the nearest car ahead.
- **Oil:** drops a slick behind you.

## Tracks
1. Downtown Loop (beginner)
2. Reactor Core (tight turns)
3. Skyline Spiral (long straights)

## Controls (Wokwi controllers)
| Controller | Steering | Throttle / Brake | Item |
|------------|----------|------------------|------|
| PSX gamepad | D-pad or left stick | R2 / L2 | X button |
| Steering wheel (potentiometer + buttons) | Potentiometer | Button A / B | Button C |

Each player picks one. The controller also gives feedback: a buzzer and LED react to hits, boosts and finishing.

## Scoring
1st: 10 pts, 2nd: 6, 3rd: 3, 4th: 1. Bonus +1 for the fastest lap. Highest total over 3 tracks wins.
