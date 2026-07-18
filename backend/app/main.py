from __future__ import annotations

import json

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .compose_service import (
    application_logs,
    application_status,
    compose_text,
    port_is_available,
    run_compose,
    server_info,
    write_compose,
)
from .database import Base, engine, get_db
from .models import Application, Service
from .schemas import ApplicationCreate, ApplicationRead
from .template_routes import template_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ComposeHub API", version="0.1.0")
app.include_router(template_router)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/server")
def get_server():
    return server_info()


@app.get("/api/applications", response_model=list[ApplicationRead])
def list_applications(db: Session = Depends(get_db)):
    return db.scalars(select(Application).order_by(Application.created_at.desc())).all()


@app.post("/api/applications", response_model=ApplicationRead, status_code=201)
def create_application(payload: ApplicationCreate, db: Session = Depends(get_db)):
    requested_ports = [service.host_port for service in payload.services if service.host_port]
    if len(requested_ports) != len(set(requested_ports)):
        raise HTTPException(status_code=400, detail="Có host port bị trùng trong application.")

    for port in requested_ports:
        if not port_is_available(port):
            raise HTTPException(
                status_code=409,
                detail=f"Port {port} đang được sử dụng trên Docker host.",
            )

    application = Application(
        name=payload.name,
        environment=payload.environment,
        description=payload.description,
    )
    for item in payload.services:
        application.services.append(
            Service(
                name=item.name,
                image=item.image,
                container_port=item.container_port,
                host_port=item.host_port,
                restart_policy=item.restart_policy,
                environment_json=json.dumps(item.environment),
                volumes_json=json.dumps([volume.model_dump() for volume in item.volumes]),
            )
        )

    db.add(application)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Tên application đã tồn tại.") from exc

    db.refresh(application)
    write_compose(application)
    return application


def get_application_or_404(application_id: int, db: Session) -> Application:
    application = db.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Không tìm thấy application.")
    return application


@app.get("/api/applications/{application_id}", response_model=ApplicationRead)
def get_application(application_id: int, db: Session = Depends(get_db)):
    return get_application_or_404(application_id, db)


@app.get("/api/applications/{application_id}/compose")
def get_compose(application_id: int, db: Session = Depends(get_db)):
    application = get_application_or_404(application_id, db)
    return {"compose": compose_text(application)}


@app.post("/api/applications/{application_id}/deploy")
def deploy_application(application_id: int, db: Session = Depends(get_db)):
    application = get_application_or_404(application_id, db)

    for service in application.services:
        if service.host_port and not port_is_available(service.host_port):
            current = application_status(application)
            already_owned = any(
                container.get("status") in {"running", "created", "restarting"} for container in current
            )
            if not already_owned:
                raise HTTPException(
                    status_code=409,
                    detail=f"Port {service.host_port} đang được sử dụng.",
                )

    try:
        output = run_compose(application, ["up", "-d"])
        return {"status": "deployed", "output": output}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/applications/{application_id}/stop")
def stop_application(application_id: int, db: Session = Depends(get_db)):
    application = get_application_or_404(application_id, db)
    try:
        output = run_compose(application, ["down"])
        return {"status": "stopped", "output": output}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/applications/{application_id}/status")
def get_application_status(application_id: int, db: Session = Depends(get_db)):
    application = get_application_or_404(application_id, db)
    try:
        return {"containers": application_status(application)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/applications/{application_id}/logs")
def get_application_logs(application_id: int, db: Session = Depends(get_db)):
    application = get_application_or_404(application_id, db)
    try:
        return {"logs": application_logs(application)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
