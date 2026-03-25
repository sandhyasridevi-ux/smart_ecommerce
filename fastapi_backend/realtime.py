import json
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._connections = defaultdict(set)

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self._connections[user_id].add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        sockets = self._connections.get(user_id)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: int, event: str, payload: dict):
        sockets = list(self._connections.get(user_id, set()))
        if not sockets:
            return

        message = json.dumps({"event": event, "payload": payload})
        dead_sockets = []
        for socket in sockets:
            try:
                await socket.send_text(message)
            except Exception:
                dead_sockets.append(socket)

        for socket in dead_sockets:
            self.disconnect(user_id, socket)

    async def send_to_users(self, user_ids: list[int], event: str, payload: dict):
        for user_id in user_ids:
            await self.send_to_user(user_id, event, payload)


realtime_manager = ConnectionManager()
