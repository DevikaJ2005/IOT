"""
Sends security status commands to the ESP32 and checks connectivity.
Never raises on a network failure - the app must keep running even if
the board is off or unreachable (NFR-02 / US-04 in the project spec).
"""
import requests
from laptop import config


class ESP32Client:
    VALID_STATES = {"AUTHORIZED", "UNKNOWN", "NO_FACE", "RESET"}

    def __init__(self):
        self.base_url = f"http://{config.ESP32_IP}:{config.ESP32_PORT}"

    def send_status(self, status):
        state = str(status).upper()
        if state not in self.VALID_STATES:
            return self._failed_command(state, connected=False, error="Unsupported ESP32 state.")
        try:
            response = requests.get(
                f"{self.base_url}/status",
                params={"state": state},
                timeout=1.0,
            )
        except requests.RequestException as exc:
            return self._failed_command(state, connected=False, error=type(exc).__name__)

        response_text = response.text.strip()
        delivered = response.status_code == 200 and response_text == "OK"
        return {
            "connected": True,
            "command": state,
            "commandDelivered": delivered,
            "httpStatus": response.status_code,
            "response": response_text,
            "error": None if delivered else "ESP32 did not acknowledge the command.",
        }

    def ping(self):
        try:
            response = requests.get(f"{self.base_url}/ping", timeout=1.0)
        except requests.RequestException as exc:
            return {
                "connected": False,
                "command": None,
                "commandDelivered": False,
                "httpStatus": None,
                "response": None,
                "error": type(exc).__name__,
            }

        response_text = response.text.strip()
        connected = response.status_code == 200 and response_text == "OK"
        return {
            "connected": connected,
            "command": None,
            "commandDelivered": False,
            "httpStatus": response.status_code,
            "response": response_text,
            "error": None if connected else "ESP32 ping was not acknowledged.",
        }

    @staticmethod
    def _failed_command(state, connected, error):
        return {
            "connected": connected,
            "command": state,
            "commandDelivered": False,
            "httpStatus": None,
            "response": None,
            "error": error,
        }
