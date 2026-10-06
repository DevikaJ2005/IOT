from typing import Optional

from fastapi import APIRouter, Query

from backend.supabase_service import SupabaseService

router = APIRouter()
service = SupabaseService()


@router.get("/logs")
async def get_logs(
    status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    date: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    summary: bool = Query(default=False),
):
    logs = service.get_access_logs(limit=limit, status=status, search=search, date_value=date)
    if summary:
        stats = service.get_today_stats()
        stats["logs"] = logs
        return stats
    return logs
