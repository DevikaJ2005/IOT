"""
Face detection and recognition. Uses the pre-trained models bundled with
the face_recognition library, so there's no training step - enrollment
just generates and stores an encoding for each new person.
"""
import face_recognition
import numpy as np
from laptop import config


class FaceEngine:
    def __init__(self):
        self.known_names = []
        self.known_encodings = []

    def refresh_known_faces(self, names, encodings):
        self.known_names = names
        self.known_encodings = encodings

    def encode_frame(self, frame):
        """Returns [(encoding, (top, right, bottom, left)), ...] for every face in the frame."""
        # ``[:, :, ::-1]`` is a view with a negative channel stride.  Recent
        # dlib bindings reject that view when computing face descriptors, so
        # make a uint8, C-contiguous RGB image before passing it on.
        rgb_frame = self._rgb_image(frame)
        locations = face_recognition.face_locations(rgb_frame)
        encodings = face_recognition.face_encodings(rgb_frame, locations)
        return list(zip(encodings, locations))

    def identify(self, encoding):
        """Compares one encoding against all known ones. Returns (name, is_match)."""
        if not self.known_encodings:
            return None, False
        distances = face_recognition.face_distance(self.known_encodings, encoding)
        best_index = int(np.argmin(distances))
        if distances[best_index] <= config.FACE_MATCH_TOLERANCE:
            return self.known_names[best_index], True
        return None, False

    def encode_single_image(self, frame):
        """Used during enrollment - expects exactly one face in the frame."""
        rgb_frame = self._rgb_image(frame)
        locations = face_recognition.face_locations(rgb_frame)
        if len(locations) != 1:
            return None
        encodings = face_recognition.face_encodings(rgb_frame, locations)
        return encodings[0] if len(encodings) == 1 else None

    def detect_face_count(self, frame):
        """Return the number of faces found in a camera frame."""
        return len(face_recognition.face_locations(self._rgb_image(frame)))

    @staticmethod
    def _rgb_image(frame):
        """Convert an OpenCV BGR frame to the layout dlib accepts."""
        if frame is None or frame.ndim != 3 or frame.shape[2] < 3:
            raise ValueError("Camera did not return a valid color image.")
        return np.ascontiguousarray(frame[:, :, :3][:, :, ::-1], dtype=np.uint8)
