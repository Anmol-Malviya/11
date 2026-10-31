from typing import Dict, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
import logging

logger = logging.getLogger("ps16.remote_stream")
router = APIRouter(tags=["Remote Camera"])

# In-memory session registry for paired phone and laptop
class RemoteCameraHub:
    def __init__(self):
        self.laptop_connections: Dict[str, WebSocket] = {}
        self.phone_connections: Dict[str, WebSocket] = {}

    async def register_laptop(self, session_id: str, websocket: WebSocket):
        self.laptop_connections[session_id] = websocket

    async def register_phone(self, session_id: str, websocket: WebSocket):
        self.phone_connections[session_id] = websocket

    def unregister_laptop(self, session_id: str):
        if session_id in self.laptop_connections:
            del self.laptop_connections[session_id]

    def unregister_phone(self, session_id: str):
        if session_id in self.phone_connections:
            del self.phone_connections[session_id]

    async def send_to_laptop(self, session_id: str, data: dict):
        ws = self.laptop_connections.get(session_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                pass

hub = RemoteCameraHub()

@router.websocket("/ws/remote-camera/{session_id}")
async def remote_camera_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    role = None
    try:
        init_data = await websocket.receive_json()
        role = init_data.get("role", "phone") # 'phone' or 'laptop'

        if role == "laptop":
            await hub.register_laptop(session_id, websocket)
            await websocket.send_json({"type": "STATUS", "message": "Laptop listening for mobile camera frames."})
        else:
            await hub.register_phone(session_id, websocket)
            await websocket.send_json({"type": "STATUS", "message": "Phone camera paired successfully!"})
            # Notify laptop that phone connected
            await hub.send_to_laptop(session_id, {"type": "PHONE_CONNECTED"})

        while True:
            msg = await websocket.receive_json()
            msg_type = msg.get("type")

            if msg_type == "FRAME":
                # Forward camera frame and prediction from phone to paired laptop
                await hub.send_to_laptop(session_id, {
                    "type": "REMOTE_FRAME",
                    "image": msg.get("image"),
                    "prediction": msg.get("prediction")
                })
            elif msg_type == "PING":
                await websocket.send_json({"type": "PONG"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"Remote camera websocket error: {e}")
    finally:
        if role == "laptop":
            hub.unregister_laptop(session_id)
        else:
            hub.unregister_phone(session_id)
            await hub.send_to_laptop(session_id, {"type": "PHONE_DISCONNECTED"})
