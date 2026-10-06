"""
All Supabase communication lives here - the only place face encodings
and access-log events are stored. No images or video ever leave this
file, and nothing is written to the local disk.
"""
from supabase import create_client
import numpy as np
from laptop import config


class CloudClient:
    def __init__(self):
        if not config.SUPABASE_URL or not config.SUPABASE_KEY:
            raise ValueError(
                "Missing SUPABASE_URL / SUPABASE_KEY - fill them in your .env file."
            )
        self.client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)

    def get_all_encodings(self):
        """Fetch every enrolled person's face encoding."""
        response = self.client.table("employees").select("*").execute()
        names, encodings = [], []
        for row in response.data:
            names.append(row["name"])
            encodings.append(np.array(row["encoding"], dtype=np.float64))
        return names, encodings

    def add_employee(self, name, encoding):
        """Enroll a new person - stores only the numeric encoding, no photo."""
        self.client.table("employees").insert({
            "name": name,
            "encoding": encoding.tolist(),
        }).execute()

    def log_access(self, identity, status, alarm):
        """Record one access event (matches the project's logging format)."""
        self.client.table("access_log").insert({
            "identity": identity or "",
            "status": status,
            "alarm": alarm,
        }).execute()

    def get_recent_logs(self, limit=30):
        response = (
            self.client.table("access_log")
            .select("*")
            .order("event_time", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data
