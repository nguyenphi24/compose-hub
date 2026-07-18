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

    @field_validator("name")
    @classmethod
    def validate_app_name(cls, value: str) -> str:
        normalized = value.strip().lower().replace(" ", "-")
        if not normalized:
            raise ValueError("Tên application không hợp lệ")
        return normalized


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
                host_port=service.host_port,
                restart_policy=service.restart_policy,
                environment_json=service.environment_json,
                volumes_json=service.volumes_json,
            )
        )

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
