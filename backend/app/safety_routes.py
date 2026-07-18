from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db
from .doctor_service import inspect_application
from .models import Application, ReleaseRevision
from .release_service import rollback_to_revision, serialize_revision
from .schemas import DoctorReport, ReleaseRevisionRead

router = APIRouter(tags=["safe-release"])


def _application_or_404(application_id: int, db: Session) -> Application:
    application = db.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Không tìm thấy application.")
    return application


@router.post("/api/applications/{application_id}/doctor", response_model=DoctorReport)
def run_compose_doctor(application_id: int, db: Session = Depends(get_db)):
    return inspect_application(_application_or_404(application_id, db))


@router.get(
    "/api/applications/{application_id}/revisions",
    response_model=list[ReleaseRevisionRead],
)
def list_revisions(application_id: int, db: Session = Depends(get_db)):
    _application_or_404(application_id, db)
    revisions = db.scalars(
        select(ReleaseRevision)
        .where(ReleaseRevision.application_id == application_id)
        .order_by(ReleaseRevision.created_at.desc(), ReleaseRevision.id.desc())
    ).all()
    return [serialize_revision(revision) for revision in revisions]


@router.post(
    "/api/applications/{application_id}/rollback/{revision_id}",
    response_model=ReleaseRevisionRead,
)
def rollback(application_id: int, revision_id: int, db: Session = Depends(get_db)):
    application = _application_or_404(application_id, db)
    target = db.get(ReleaseRevision, revision_id)
    if not target or target.application_id != application.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy revision của application này.")
    if target.status != "success":
        raise HTTPException(status_code=409, detail="Chỉ có thể rollback về revision thành công.")
    try:
        rollback_revision, _ = rollback_to_revision(db, application, target)
        return serialize_revision(rollback_revision)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
