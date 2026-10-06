import base64
import threading
import time
from typing import Any, Dict, Optional

import cv2
import face_recognition
import numpy as np

from backend.config import FACE_MATCH_TOLERANCE
from backend.esp32_service import esp32_service
from backend.supabase_service import SupabaseService
from laptop.face_engine import FaceEngine


class RecognitionService:
    def __init__(self):
        self.engine = FaceEngine()
        self.supabase = SupabaseService()
        self.esp32 = esp32_service
        self.lock = threading.Lock()
        self.enabled = True
        self.known_names: list[str] = []
        self.known_encodings: list[np.ndarray] = []
        self.last_state: Optional[str] = None
        self.last_logged_state: Optional[str] = None
        self.last_esp32_result: Optional[Dict[str, Any]] = None
        self.last_esp32_attempt_at = 0.0
        self.cache_error: Optional[str] = None
        try:
            self.refresh_cache()
        except Exception as exc:
            self.cache_error = type(exc).__name__

    def refresh_cache(self):
        names, encodings = self.supabase.get_all_encodings()
        self.known_names = names
        self.known_encodings = encodings
        self.engine.refresh_known_faces(names, encodings)
        self.cache_error = None

    def process_frame(self, frame: Any):
        with self.lock:
            try:
                if not self.enabled:
                    return {"status": "STANDBY", "identity": "System Idle", "confidence": 0, "alarm": "OFF", "esp32": self.last_esp32_result or self.esp32.ping()}
                self.refresh_cache()
                results = self.engine.encode_frame(frame)
            except Exception:
                return {"status": "ERROR", "identity": "Recognition Error", "confidence": 0, "alarm": "OFF", "esp32": self.esp32.ping()}

            if not results:
                return self._update_state("NO_FACE", "", 0)

            recognized_names = []
            unknown_faces = 0
            highest_confidence = 0
            selected_name = "Unknown Person"
            status = "UNKNOWN"

            for encoding, _location in results:
                if not self.known_encodings:
                    unknown_faces += 1
                    continue
                distances = face_recognition.face_distance(self.known_encodings, encoding)
                best_index = int(np.argmin(distances))
                best_distance = float(distances[best_index])
                if best_distance <= FACE_MATCH_TOLERANCE:
                    recognized_names.append(self.known_names[best_index])
                    confidence = max(0, min(99, int(round((1 - best_distance) * 100))))
                    highest_confidence = max(highest_confidence, confidence)
                    selected_name = self.known_names[best_index]
                else:
                    unknown_faces += 1

            if recognized_names and unknown_faces == 0:
                status = "AUTHORIZED"
                identity = selected_name
                confidence = highest_confidence
            else:
                status = "UNKNOWN"
                identity = "Unknown Person"
                confidence = max(0, min(99, highest_confidence or 65))

            return self._update_state(status, identity, confidence)

    def _update_state(self, status: str, identity: str, confidence: int):
        if status == "AUTHORIZED" and (not identity or identity.strip().casefold() in {"unknown", "unknown person"}):
            status = "UNKNOWN"
            identity = "Unknown Person"

        state_changed = status != self.last_state
        hardware_command = self.esp32.last_result
        hardware_out_of_sync = hardware_command is not None and hardware_command.get("command") != status
        failed_command_retry_due = (
            hardware_command is not None
            and hardware_command.get("command") == status
            and not hardware_command.get("commandDelivered")
            and time.monotonic() - self.last_esp32_attempt_at >= 3.0
        )
        if state_changed:
            self.last_state = status
        if state_changed or hardware_out_of_sync or failed_command_retry_due:
            self.last_esp32_result = self.esp32.send_status(status)
            self.last_esp32_attempt_at = time.monotonic()
        elif hardware_command is not None:
            self.last_esp32_result = hardware_command

        if status in {"AUTHORIZED", "UNKNOWN"} and self.last_logged_state != status:
            alarm = "ON" if status == "UNKNOWN" else "OFF"
            try:
                self.supabase.log_access(identity, status, alarm)
            except Exception:
                pass
            self.last_logged_state = status
        elif status == "NO_FACE":
            self.last_logged_state = None

        return {
            "status": status,
            "identity": identity if status == "AUTHORIZED" else "Unknown Person" if status == "UNKNOWN" else "",
            "confidence": confidence,
            "alarm": "ON" if status == "UNKNOWN" else "OFF",
            "esp32": self.last_esp32_result or self.esp32.ping(),
            "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        }

    def decode_base64_frame(self, base64_image: str):
        encoded = base64_image.split(",", 1)[1] if "," in base64_image else base64_image
        image_bytes = base64.b64decode(encoded)
        np_array = np.frombuffer(image_bytes, dtype=np.uint8)
        frame = cv2.imdecode(np_array, cv2.IMREAD_COLOR)
        return frame

    def detect_enrollment_faces(self, image_data: str):
        frame = self.decode_base64_frame(image_data)
        if frame is None:
            raise ValueError("A valid camera frame is required.")
        return self.engine.detect_face_count(frame)

    def create_enrollment_encoding(self, image_data: str):
        frame = self.decode_base64_frame(image_data)
        if frame is None:
            raise ValueError("A valid camera frame is required.")
        face_count = self.engine.detect_face_count(frame)
        if face_count != 1:
            return {"success": False, "face_count": face_count}
        encoding = self.engine.encode_single_image(frame)
        if encoding is None or encoding.shape != (128,) or not np.isfinite(encoding).all():
            return {"success": False, "face_count": 1}
        return {"success": True, "face_count": 1, "encoding": encoding.tolist()}

    def save_employee_encoding(self, name: str, encoding_data: Any):
        try:
            encoding = np.asarray(encoding_data, dtype=np.float64)
        except (TypeError, ValueError) as exc:
            raise ValueError("A valid face encoding is required.") from exc
        if encoding.shape != (128,) or not np.isfinite(encoding).all():
            raise ValueError("A valid face encoding is required.")

        self.refresh_cache()
        if self.known_names:
            for known_name, known_encoding in zip(self.known_names, self.known_encodings):
                distances = face_recognition.face_distance([known_encoding], encoding)
                if distances.size and distances[0] <= FACE_MATCH_TOLERANCE:
                    raise ValueError(f"A closely matching face is already registered for {known_name}.")

        response = self.supabase.add_employee(name, encoding)
        if not response or not response.data:
            raise RuntimeError("Supabase did not confirm the employee insertion.")
        self.known_names.append(name)
        self.known_encodings.append(encoding)
        self.engine.refresh_known_faces(self.known_names, self.known_encodings)
        return {"success": True, "message": f"{name} enrolled successfully."}

    def start(self):
        self.enabled = True
        return {"status": "started"}

    def stop(self):
        self.enabled = False
        return {"status": "stopped"}
