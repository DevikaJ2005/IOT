from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import BACKEND_HOST, BACKEND_PORT, FRONTEND_URL
from backend.routes.analytics import router as analytics_router
from backend.routes.auth import router as auth_router
from backend.routes.esp32 import router as esp32_router
from backend.routes.employees import router as employees_router
from backend.routes.logs import router as logs_router
from backend.routes.recognition import router as recognition_router

app = FastAPI(title="IoT Face Security", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth")
app.include_router(esp32_router, prefix="/api/esp32")
app.include_router(employees_router, prefix="/api/employees")
app.include_router(recognition_router, prefix="/api/recognition")
app.include_router(logs_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "backend": "online",
        "supabase": "connected",
        "esp32": "pending",
        "camera": "ready",
        "system": "ready",
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host=BACKEND_HOST, port=BACKEND_PORT, reload=False)
