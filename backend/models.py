from pydantic import BaseModel, Field
from typing import Optional, List, Literal


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class EmployeeCreateRequest(BaseModel):
    name: str = Field(..., min_length=1)


class EmployeeUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1)


class RecognitionFrameRequest(BaseModel):
    image: str
    timestamp: Optional[str] = None


class AccessLogFilter(BaseModel):
    status: Optional[str] = None
    search: Optional[str] = None
    date: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    backend: str
    supabase: str
    esp32: str
    camera: str
    system: str
    timestamp: str
