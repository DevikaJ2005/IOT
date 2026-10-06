from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from backend.face_service import RecognitionService
from backend.models import RecognitionFrameRequest

router = APIRouter()
service = RecognitionService()


@router.post("/start")
async def start_recognition():
    return service.start()


@router.post("/stop")
async def stop_recognition():
    return service.stop()


@router.post("/frame")
async def process_recognition_frame(payload: RecognitionFrameRequest):
    try:
        frame = service.decode_base64_frame(payload.image)
        if frame is None:
            raise ValueError("No valid camera frame was provided.")
        return await run_in_threadpool(service.process_frame, frame)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to process the current frame.") from exc
