import threading
from typing import Any, Dict, Optional

from laptop.esp32_client import ESP32Client


class ESP32Service:
    def __init__(self):
        self.client = ESP32Client()
        self._lock = threading.Lock()
        self.last_result: Optional[Dict[str, Any]] = None

    def ping(self):
        try:
            return self.client.ping()
        except Exception as exc:
            return self._failed_result(None, type(exc).__name__)

    def send_status(self, status: str):
        with self._lock:
            try:
                result = self.client.send_status(status)
            except Exception as exc:
                result = self._failed_result(status, type(exc).__name__)
            self.last_result = result
            return result

    def reset(self):
        return self.send_status("RESET")

    @staticmethod
    def _failed_result(command, error):
        return {
            "connected": False,
            "command": command,
            "commandDelivered": False,
            "httpStatus": None,
            "response": None,
            "error": error,
        }


esp32_service = ESP32Service()
