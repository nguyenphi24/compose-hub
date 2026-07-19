from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.compose_service import write_compose
from app.database import get_db
from app.models import Application, Service
from app.port_validation import PortValidationError, validate_host_ports
from app.schemas import ApplicationRead
from app.template_service import (
    TEMPLATES,
    preview_template_compose,
    render_template_services,
)

template_router = APIRouter()


class PreviewRequest(BaseModel):
    template_id: str
    app_name: str = "preview-app"
    variables: dict[str, Any] = {}


class CreateFromTemplateRequest(BaseModel):
    template_id: str
    name: str = Field(min_length=1, max_length=100)
    environment: str = "production"
    description: str = ""
    variables: dict[str, Any] = {}

    @field_validator("name")
    @classmethod
    def validate_app_name(cls, value: str) -> str:
        normalized = value.strip().lower().replace(" ", "-")
        if not normalized:
            raise ValueError("Tên application không hợp lệ")
        return normalized


class CloneRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    host_ports: dict[str, int] = Field(default_factory=dict)

    @field_validator("name")
    @classmethod
    def validate_app_name(cls, value: str) -> str:
        normalized = value.strip().lower().replace(" ", "-")
        if not normalized:
            raise ValueError("Tên application không hợp lệ")
        return normalized

    @field_validator("host_ports")
    @classmethod
    def validate_host_ports(cls, value: dict[str, int]) -> dict[str, int]:
        if any(port < 1 or port > 65535 for port in value.values()):
            raise ValueError("Host port phải nằm trong khoảng 1-65535")
        return value


@template_router.get("/api/templates")
def get_templates():
    return list(TEMPLATES.values())


@template_router.post("/api/templates/preview")
def preview_template(payload: PreviewRequest):
    try:
        yaml_content = preview_template_compose(
            payload.template_id, payload.app_name, payload.variables
        )
        return {"compose": yaml_content}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@template_router.post(
    "/api/applications/from-template",
    response_model=ApplicationRead,
    status_code=201,
)
def create_from_template(
    payload: CreateFromTemplateRequest, db: Session = Depends(get_db)
):
    # Check if application name already exists
    existing = db.scalars(
        select(Application).where(Application.name == payload.name)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Tên application đã tồn tại.")

    try:
        services = render_template_services(
            payload.template_id, payload.name, payload.variables
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        validate_host_ports(db, services)
    except PortValidationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    application = Application(
        name=payload.name,
        environment=payload.environment,
        description=payload.description,
    )
    for service in services:
        application.services.append(service)

    db.add(application)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Tên application đã tồn tại."
        ) from exc

    db.refresh(application)
    write_compose(application)
    return application


@template_router.post(
    "/api/applications/{application_id}/clone",
    response_model=ApplicationRead,
    status_code=201,
)
def clone_application(
    application_id: int, payload: CloneRequest, db: Session = Depends(get_db)
):
    source_app = db.get(Application, application_id)
    if not source_app:
        raise HTTPException(
            status_code=404, detail="Không tìm thấy application gốc để clone."
        )

    # Check if cloned name already exists
    existing = db.scalars(
        select(Application).where(Application.name == payload.name)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Tên application đã tồn tại.")

    public_services = [service for service in source_app.services if service.host_port]
    missing_services = [
        service.name for service in public_services if service.name not in payload.host_ports
    ]
    if missing_services:
        raise HTTPException(
            status_code=400,
            detail=(
                "Hãy chọn host port mới cho các service public: "
                + ", ".join(missing_services)
                + "."
            ),
        )

    cloned_app = Application(
        name=payload.name,
        environment=source_app.environment,
        description=f"Cloned từ {source_app.name}. {source_app.description or ''}".strip(),
    )

    for service in source_app.services:
        cloned_app.services.append(
            Service(
                name=service.name,
                image=service.image,
                container_port=service.container_port,
                host_port=(
                    payload.host_ports[service.name]
                    if service.host_port
                    else None
                ),
                restart_policy=service.restart_policy,
                environment_json=service.environment_json,
                volumes_json=service.volumes_json,
            )
        )

    try:
        validate_host_ports(db, cloned_app.services)
    except PortValidationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    db.add(cloned_app)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Tên application đã tồn tại."
        ) from exc

    db.refresh(cloned_app)
    write_compose(cloned_app)
    return cloned_app
