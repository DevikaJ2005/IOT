from fastapi import APIRouter

from backend.supabase_service import SupabaseService

router = APIRouter()
service = SupabaseService()


@router.get("/analytics")
async def get_analytics():
    return service.get_analytics()
