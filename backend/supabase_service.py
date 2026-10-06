from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from laptop.cloud_client import CloudClient


class SupabaseService:
    def __init__(self):
        self.client = CloudClient()

    def get_all_employees(self):
        response = self.client.client.table("employees").select("*").execute()
        return response.data

    def get_all_encodings(self) -> Tuple[List[str], List[np.ndarray]]:
        rows = self.get_all_employees()
        names: List[str] = []
        encodings: List[np.ndarray] = []
        for row in rows:
            names.append(row.get("name") or "")
            encodings.append(np.array(row.get("encoding", []), dtype=np.float64))
        return names, encodings

    def get_employee_by_id(self, employee_id: int):
        response = self.client.client.table("employees").select("*").eq("id", employee_id).execute()
        return response.data[0] if response.data else None

    def add_employee(self, name: str, encoding: Any):
        return self.client.client.table("employees").insert({"name": name, "encoding": encoding.tolist()}).execute()

    def update_employee(self, employee_id: int, name: str):
        return self.client.client.table("employees").update({"name": name}).eq("id", employee_id).execute()

    def delete_employee(self, employee_id: int):
        return self.client.client.table("employees").delete().eq("id", employee_id).execute()

    def log_access(self, identity: str, status: str, alarm: str):
        return self.client.client.table("access_log").insert({"identity": identity or "", "status": status, "alarm": alarm}).execute()

    def get_access_logs(self, limit: int = 100, status: Optional[str] = None, search: Optional[str] = None, date_value: Optional[str] = None):
        query = self.client.client.table("access_log").select("*")
        if status and status.upper() != "ALL":
            query = query.eq("status", status.upper())
        if search:
            query = query.ilike("identity", f"%{search}%")
        if date_value:
            start = datetime.fromisoformat(date_value)
            end = start + timedelta(days=1)
            query = query.gte("event_time", start.isoformat()).lt("event_time", end.isoformat())
        response = query.order("event_time", desc=True).limit(limit).execute()
        return response.data

    def get_employee_count(self):
        rows = self.get_all_employees()
        return len(rows)

    def get_today_stats(self):
        today = datetime.utcnow().strftime("%Y-%m-%d")
        logs = self.get_access_logs(limit=1000)
        today_logs = [entry for entry in logs if (entry.get("event_time") or "")[:10] == today]
        authorized = sum(1 for entry in today_logs if entry.get("status") == "AUTHORIZED")
        unknown = sum(1 for entry in today_logs if entry.get("status") == "UNKNOWN")
        total = len(today_logs)
        return {
            "total_employees": self.get_employee_count(),
            "today_authorized": authorized,
            "today_unknown": unknown,
            "today_total_events": total,
            "message": "No access events recorded today." if total == 0 else "",
        }

    def get_analytics(self):
        logs = self.get_access_logs(limit=1000)
        authorized = sum(1 for entry in logs if entry.get("status") == "AUTHORIZED")
        unknown = sum(1 for entry in logs if entry.get("status") == "UNKNOWN")
        by_hour = {f"{index:02d}:00": 0 for index in range(24)}
        for entry in logs:
            ts = entry.get("event_time")
            if not ts:
                continue
            try:
                hour = datetime.fromisoformat(ts.replace("Z", "+00:00")).hour
            except ValueError:
                continue
            by_hour[f"{hour:02d}:00"] += 1
        return {
            "authorized_vs_unknown": {"AUTHORIZED": authorized, "UNKNOWN": unknown},
            "hourly_access": by_hour,
            "daily_activity": {},
            "unknown_trend": {"UNKNOWN": unknown},
            "buzzer_activations": sum(1 for entry in logs if entry.get("alarm") == "ON"),
        }
