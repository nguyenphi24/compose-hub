from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class VolumeMount(BaseModel):
    source: str
    target: str


class ServiceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    image: str = Field(min_length=1, max_length=255)
    container_port: int | None = Field(default=None, ge=1, le=65535)
    host_port: int | None = Field(default=None, ge=1, le=65535)
    restart_policy: str = "unless-stopped"
    environment: dict[str, str] = {}
    volumes: list[VolumeMount] = []

    @field_validator("name")
    @classmethod
    def validate_service_name(cls, value: str) -> str:
        normalized = value.strip().lower().replace(" ", "-")
        if not normalized:
            raise ValueError("Tên service không hợp lệ")
        return normalized


class ApplicationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    environment: str = "production"
    description: str = ""
    services: list[ServiceCreate] = Field(min_length=1)

    @field_validator("name")
    @classmethod
    def validate_app_name(cls, value: str) -> str:
        normalized = value.strip().lower().replace(" ", "-")
        if not normalized:
            raise ValueError("Tên application không hợp lệ")
        return normalized


class ServiceRead(ServiceCreate):
    id: int

    model_config = {"from_attributes": True}


class ApplicationRead(BaseModel):
    id: int
    name: str
    environment: str
    description: str
    created_at: datetime
    services: list[ServiceRead]

    model_config = {"from_attributes": True}
