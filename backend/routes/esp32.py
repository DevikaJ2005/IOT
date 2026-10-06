import asyncio

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from backend.esp32_service import esp32_service

router = APIRouter()
service = esp32_service


@router.get("/status")
async def esp32_status():
    try:
        result = await run_in_threadpool(service.ping)
        return {**result, "status": "CONNECTED" if result["connected"] else "DISCONNECTED"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unable to check ESP32 status.") from exc


@router.post("/ping")
async def ping_esp32():
    result = await run_in_threadpool(service.ping)
    return {
        **result,
        "success": result["connected"],
        "message": "ESP32 connected." if result["connected"] else "ESP32 DISCONNECTED",
    }


@router.post("/status")
async def send_status(payload: dict):
    if "state" not in payload:
        raise HTTPException(status_code=400, detail="Missing state value.")
    state = str(payload["state"]).upper()
    if state not in {"AUTHORIZED", "UNKNOWN", "NO_FACE", "RESET"}:
        raise HTTPException(status_code=400, detail="Unsupported ESP32 state.")
    result = await run_in_threadpool(service.send_status, state)
    return {
        **result,
        "success": result["commandDelivered"],
        "state": state,
        "message": "ESP32 command delivered successfully." if result["commandDelivered"] else "ESP32 command failed.",
    }


@router.post("/reset")
async def reset_alarm():
    result = await run_in_threadpool(service.reset)
    return {
        **result,
        "success": result["commandDelivered"],
        "message": "ESP32 command delivered successfully." if result["commandDelivered"] else "ESP32 command failed.",
    }


@router.post("/test")
async def test_unknown_command():
    result = await run_in_threadpool(service.send_status, "UNKNOWN")
    success = result["commandDelivered"]
    body = {
        "success": success,
        "message": "ESP32 command delivered successfully." if success else "ESP32 command failed.",
        "esp32": result,
    }
    return body if success else JSONResponse(status_code=503, content=body)


@router.post("/test-sequence")
async def test_unknown_authorized_sequence():
    unknown = await run_in_threadpool(service.send_status, "UNKNOWN")
    if unknown["commandDelivered"]:
        await asyncio.sleep(1)
    authorized = await run_in_threadpool(service.send_status, "AUTHORIZED")
    success = unknown["commandDelivered"] and authorized["commandDelivered"]
    body = {
        "success": success,
        "message": "ESP32 commands delivered; verify buzzer sound and stop physically." if success else "ESP32 command failed.",
        "physicalSoundVerified": False,
        "commands": {"UNKNOWN": unknown, "AUTHORIZED": authorized},
    }
    return body if success else JSONResponse(status_code=503, content=body)
