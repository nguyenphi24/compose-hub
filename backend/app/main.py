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
    run_compose,
    server_info,
    write_compose,
)
from .change_plan_service import build_change_plan
from .database import get_db, initialize_database
from .doctor_service import inspect_application
from .models import Application, Service
from .port_validation import PortValidationError, validate_host_ports
from .release_service import (
    DeploymentInProgressError,
    create_revision,
    deploy_with_revision,
    serialize_revision,
)
from .safety_routes import router as safety_router
from .template_routes import template_router
from .schemas import ApplicationCreate, ApplicationRead, ApplicationUpdate, DeployRequest

initialize_database()

app = FastAPI(title="ComposeHub API", version="0.2.0")
app.include_router(template_router)
app.include_router(safety_router)

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
    try:
        validate_host_ports(db, payload.services)
    except PortValidationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

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
def deploy_application(
    application_id: int,
    payload: DeployRequest | None = None,
    db: Session = Depends(get_db),
):
    application = get_application_or_404(application_id, db)
    if payload and payload.expected_plan_id:
        current_plan = build_change_plan(db, application)
        if payload.expected_plan_id != current_plan.plan_id:
            raise HTTPException(
                status_code=409,
                detail="Change Plan đã cũ vì cấu hình hoặc baseline release đã thay đổi. Hãy refresh plan trước khi Deploy.",
            )
    try:
        validate_host_ports(
            db, application.services, current_application=application
        )
    except PortValidationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    report = inspect_application(application)
    if not report.can_deploy:
        create_revision(
            db,
            application,
            action="deploy",
            status="blocked",
            compose_yaml=compose_text(application),
            doctor_report=report,
        )
        db.commit()
        raise HTTPException(
            status_code=422,
            detail="Deploy bị chặn bởi Compose Doctor. Hãy xử lý các lỗi Critical trước.",
        )
    try:
        revision, output = deploy_with_revision(db, application, report)
        return {
            "status": "deployed",
            "output": output,
            "revision": serialize_revision(revision).model_dump(mode="json"),
        }
    except DeploymentInProgressError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
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


@app.patch("/api/applications/{application_id}", response_model=ApplicationRead)
def update_application(application_id: int, payload: ApplicationUpdate, db: Session = Depends(get_db)):
    application = get_application_or_404(application_id, db)
    if payload.services is not None:
        try:
            validate_host_ports(
                db, payload.services, current_application=application
            )
        except PortValidationError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    if payload.name is not None:
        # Check duplicate name
        if payload.name != application.name:
            existing = db.scalars(select(Application).where(Application.name == payload.name)).first()
            if existing:
                raise HTTPException(status_code=409, detail="Tên application đã tồn tại.")
        application.name = payload.name
    if payload.environment is not None:
        application.environment = payload.environment
    if payload.description is not None:
        application.description = payload.description
    if payload.services is not None:
        # Replace services
        for svc in list(application.services):
            db.delete(svc)
        db.flush()
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
    # Reset active_compose_yaml so next deploy uses updated services
    application.active_compose_yaml = None
    db.commit()
    db.refresh(application)
    write_compose(application)
    return application


@app.delete("/api/applications/{application_id}", status_code=204)
def delete_application(application_id: int, db: Session = Depends(get_db)):
    import shutil
    from .compose_service import get_app_dir
    application = get_application_or_404(application_id, db)
    # Remove compose directory (does NOT delete Docker volumes)
    try:
        app_dir = get_app_dir(application)
        if app_dir.exists():
            shutil.rmtree(app_dir)
    except Exception:
        pass
    db.delete(application)
    db.commit()
    return None
