"""
Central configuration - loaded from environment variables (.env file).
"""

import os
from dotenv import load_dotenv

load_dotenv()

# Supabase (cloud storage for face encodings + access log - nothing local)
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# ESP32
ESP32_IP = os.getenv("ESP32_IP", "192.168.0.7")
ESP32_PORT = int(os.getenv("ESP32_PORT", "80"))

# Face recognition
FACE_MATCH_TOLERANCE = float(os.getenv("FACE_MATCH_TOLERANCE", "0.6"))
CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", "0"))