from __future__ import annotations

import json
from contextlib import contextmanager
from datetime import datetime
from threading import Lock
from collections.abc import Iterator

from sqlalchemy.orm import Session

from .compose_service import compose_text, run_compose
from .models import Application, ReleaseRevision
from .schemas import DoctorReport, ReleaseRevisionRead


class DeploymentInProgressError(RuntimeError):
    """Raised when the same application is already being deployed or rolled back."""


_application_locks: dict[int, Lock] = {}
_application_locks_guard = Lock()


@contextmanager
def deployment_lock(application_id: int) -> Iterator[None]:
    """Allow one Compose-mutating command per application in this API process."""

    with _application_locks_guard:
        lock = _application_locks.setdefault(application_id, Lock())
    if not lock.acquire(blocking=False):
        raise DeploymentInProgressError(
            "Application đang có Deploy hoặc Rollback chạy. Hãy chờ thao tác hiện tại hoàn tất."
        )
    try:
        yield
    finally:
        lock.release()


def create_revision(
    db: Session,
    application: Application,
    *,
    action: str,
    status: str,
    compose_yaml: str,
    doctor_report: DoctorReport | None = None,
    target_revision_id: int | None = None,
) -> ReleaseRevision:
    revision = ReleaseRevision(
        application=application,
        action=action,
        status=status,
        compose_yaml=compose_yaml,
        doctor_report_json=json.dumps(
            doctor_report.model_dump() if doctor_report else {}, ensure_ascii=False
        ),
        target_revision_id=target_revision_id,
    )
    db.add(revision)
    db.flush()
    return revision


def mark_revision(revision: ReleaseRevision, *, status: str, output: str) -> None:
    revision.status = status
    revision.output = output
    revision.completed_at = datetime.utcnow()


def serialize_revision(revision: ReleaseRevision) -> ReleaseRevisionRead:
    try:
        raw_report = json.loads(revision.doctor_report_json or "{}")
        doctor_report = DoctorReport.model_validate(raw_report) if raw_report else None
    except (json.JSONDecodeError, ValueError):
        doctor_report = None
    return ReleaseRevisionRead(
        id=revision.id,
        action=revision.action,
        status=revision.status,
        target_revision_id=revision.target_revision_id,
        output=revision.output,
        created_at=revision.created_at,
        completed_at=revision.completed_at,
        doctor_report=doctor_report,
    )


def deploy_with_revision(
    db: Session, application: Application, doctor_report: DoctorReport
) -> tuple[ReleaseRevision, str]:
    with deployment_lock(application.id):
        revision = create_revision(
            db,
            application,
            action="deploy",
            status="pending",
            compose_yaml=compose_text(application),
            doctor_report=doctor_report,
        )
        db.commit()
        try:
            output = run_compose(application, ["up", "-d"])
        except Exception as exc:
            mark_revision(revision, status="failed", output=str(exc))
            db.commit()
            raise
        mark_revision(revision, status="success", output=output)
        db.commit()
        db.refresh(revision)
        return revision, output


def rollback_to_revision(
    db: Session, application: Application, target: ReleaseRevision
) -> tuple[ReleaseRevision, str]:
    """Activate and deploy an immutable snapshot, restoring the old source on failure."""

    with deployment_lock(application.id):
        previous_compose = compose_text(application)
        previous_active_snapshot = application.active_compose_yaml
        rollback = create_revision(
            db,
            application,
            action="rollback",
            status="pending",
            compose_yaml=previous_compose,
            target_revision_id=target.id,
        )
        application.active_compose_yaml = target.compose_yaml
        db.commit()
        try:
            output = run_compose(application, ["up", "-d"])
        except Exception as exc:
            application.active_compose_yaml = previous_active_snapshot
            mark_revision(rollback, status="failed", output=str(exc))
            db.commit()
            raise
        mark_revision(rollback, status="success", output=output)
        db.commit()
        db.refresh(rollback)
        return rollback, output
