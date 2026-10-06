from fastapi import APIRouter, HTTPException

from backend.auth_service import AuthService
from backend.models import LoginRequest

router = APIRouter()
service = AuthService()


@router.post("/login")
async def login(payload: LoginRequest):
    try:
        result = service.login(payload.username, payload.password)
        return {"success": True, **result}
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/logout")
async def logout():
    return {"success": True, "message": "Logged out successfully."}
