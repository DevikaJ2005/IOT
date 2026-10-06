from typing import Any, Dict
import unicodedata

from fastapi import APIRouter, HTTPException

from backend.face_service import RecognitionService
from backend.models import EmployeeCreateRequest, EmployeeUpdateRequest
from backend.supabase_service import SupabaseService

router = APIRouter()
service = SupabaseService()
recognition_service = RecognitionService()


@router.get("")
async def list_employees():
    rows = service.get_all_employees()
    return rows


@router.post("")
async def create_employee(payload: EmployeeCreateRequest):
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=400, detail="Employee name is required.")
    return service.client.client.table("employees").insert({"name": payload.name.strip(), "encoding": []}).execute()


@router.post("/enroll")
async def enroll_employee(payload: dict):
    name = unicodedata.normalize("NFC", str(payload.get("name", "")).strip())
    if len(name) < 2 or not name[0].isalpha() or any(not (char.isalpha() or char in " .'-\u2019") for char in name):
        raise HTTPException(status_code=400, detail="Please enter a valid employee name.")
    encoding = payload.get("encoding")
    if encoding is None:
        raise HTTPException(status_code=400, detail="A valid face encoding is required.")
    try:
        return recognition_service.save_employee_encoding(name, encoding)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unable to save the employee profile.") from exc


@router.post("/enroll/detect")
async def detect_enrollment_faces(payload: dict):
    image = payload.get("image")
    if not image:
        raise HTTPException(status_code=400, detail="A valid camera frame is required.")
    try:
        return {"face_count": recognition_service.detect_enrollment_faces(image)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unable to check the camera frame.") from exc


@router.post("/enroll/encode")
async def create_enrollment_encoding(payload: dict):
    image = payload.get("image")
    if not image:
        raise HTTPException(status_code=400, detail="A valid camera frame is required.")
    try:
        return recognition_service.create_enrollment_encoding(image)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unable to generate a face encoding.") from exc


@router.get("/{employee_id}")
async def get_employee(employee_id: int):
    employee = service.get_employee_by_id(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
    return employee


@router.put("/{employee_id}")
async def update_employee(employee_id: int, payload: EmployeeUpdateRequest):
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=400, detail="Employee name is required.")
    return service.update_employee(employee_id, payload.name.strip())


@router.delete("/{employee_id}")
async def delete_employee(employee_id: int):
    service.delete_employee(employee_id)
    return {"success": True, "message": "Employee deleted successfully."}
