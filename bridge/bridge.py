
import os
import json
import threading

import serial
import websocket
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SERVER_URL = os.getenv("GAME_SERVER_URL", "ws://localhost:8787")
ROOM_CODE = os.getenv("ROOM_CODE", "")
# PLAYER_ID is the driver name typed in the browser, or the server player id.
PLAYER_ID = os.getenv("PLAYER_NAME") or os.getenv("PLAYER_ID") or ""
SERIAL_URL = os.getenv(
    "SERIAL_URL",
    "rfc2217://localhost:4000"
)

if not ROOM_CODE or not PLAYER_ID:
    raise RuntimeError("Set ROOM_CODE and PLAYER_ID (the driver name) in bridge/.env")

running = True
sequence = 0
previous_item = 0

def handle_server_messages(ws, controller):
    """Receive feedback from the game server."""
    while running:
        try:
            message = ws.recv()
            data = json.loads(message)

            msg_type = data.get("type")
            payload = data.get("data") if isinstance(data.get("data"), dict) else {}

            if msg_type == "controller_feedback":
                event = data.get("event", "")

                controller.write(
                    (json.dumps({
                        "type": "feedback",
                        "event": event
                    }) + "\n").encode()
                )

                print("Controller feedback:", event)
            elif msg_type == "controller_attached":
                print("Wheel linked to", payload.get("playerName", PLAYER_ID))
            elif msg_type == "command_rejected":
                print("Server rejected:", payload.get("code"), payload.get("message"))

        except websocket.WebSocketTimeoutException:
            continue
        except Exception as error:
            print("Server receive error:", error)
            break


def main():
    global sequence, previous_item, running

    print("Connecting to Wokwi controller...")

    controller = serial.serial_for_url(
        SERIAL_URL,
        baudrate=115200,
        timeout=1
    )

    print(f"Linking {PLAYER_ID} to room {ROOM_CODE} at {SERVER_URL}")
    print("Connecting to game server...")

    ws = websocket.create_connection(
        SERVER_URL,
        timeout=10
    )

    # Provisional gateway connection protocol.
    ws.send(json.dumps({
        "command": "connect_controller",
        "payload": {
            "room_code": ROOM_CODE,
            "player_id": PLAYER_ID
        }
    }))

    print("Connected. Waiting for controller input...")

    ws.settimeout(0.1)

    feedback_thread = threading.Thread(
        target=handle_server_messages,
        args=(ws, controller),
        daemon=True
    )
    feedback_thread.start()

    try:
        while True:
            line = controller.readline().decode(
                "utf-8",
                errors="ignore"
            ).strip()

            if not line:
                continue

            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue

            if data.get("type") != "controller_input":
                continue

            sequence += 1

            # Send continuous driving input.
            ws.send(json.dumps({
                "command": "drive_input",
                "payload": {
                    "player_id": PLAYER_ID,
                    "sequence": sequence,
                    "steer": data["steer"],
                    "throttle": data["throttle"],
                    "brake": data["brake"]
                }
            }))

            # Send item command only on button press.
            item_pressed = int(data.get("use_item", 0))

            if item_pressed and not previous_item:
                ws.send(json.dumps({
                    "command": "use_item",
                    "payload": {
                        "player_id": PLAYER_ID
                    }
                }))

            previous_item = item_pressed

    except KeyboardInterrupt:
        print("\nStopping bridge...")

    finally:
        running = False
        controller.close()
        ws.close()


if __name__ == "__main__":
    main()
