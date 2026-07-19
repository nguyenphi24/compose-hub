from __future__ import annotations

import hashlib
import json
from typing import Any
from urllib.parse import urlsplit

import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from .compose_service import build_compose
from .models import Application, ReleaseRevision
from .schemas import ChangePlan, ChangePlanItem


RISK_ORDER = {"low": 0, "medium": 1, "high": 2}


def _load_compose(value: str) -> dict[str, Any]:
    loaded = yaml.safe_load(value) or {}
    return loaded if isinstance(loaded, dict) else {}


def _active_revision(
    db: Session, application: Application
) -> ReleaseRevision | None:
    latest = db.scalars(
        select(ReleaseRevision)
        .where(
            ReleaseRevision.application_id == application.id,
            ReleaseRevision.status == "success",
        )
        .order_by(ReleaseRevision.created_at.desc(), ReleaseRevision.id.desc())
    ).first()
    if latest is None:
        return None
    if latest.action == "rollback" and latest.target_revision_id:
        target = db.get(ReleaseRevision, latest.target_revision_id)
        if target and target.application_id == application.id and target.status == "success":
            return target
    return latest


def _ports(service: dict[str, Any]) -> list[str]:
    result: list[str] = []
    for value in service.get("ports") or []:
        if isinstance(value, dict):
            result.append(json.dumps(value, sort_keys=True))
        else:
            result.append(str(value))
    return sorted(result)


def _volumes(service: dict[str, Any]) -> list[str]:
    result: list[str] = []
    for value in service.get("volumes") or []:
        if isinstance(value, dict):
            result.append(json.dumps(value, sort_keys=True))
        else:
            result.append(str(value))
    return sorted(result)


def _environment(service: dict[str, Any]) -> dict[str, str]:
    raw = service.get("environment") or {}
    if isinstance(raw, dict):
        return {str(key): str(value) for key, value in raw.items()}
    result: dict[str, str] = {}
    for value in raw if isinstance(raw, list) else []:
        key, _, item = str(value).partition("=")
        result[key] = item
    return result


def _is_domain_key(key: str) -> bool:
    normalized = key.upper()
    return (
        "DOMAIN" in normalized
        or normalized in {"HOST", "URL", "ORIGIN"}
        or normalized.endswith(("_HOST", "_URL", "_ORIGIN"))
    )


def _safe_endpoint(value: str | None) -> str:
    if value is None:
        return "—"
    if "://" not in value:
        return value
    parsed = urlsplit(value)
    if not parsed.hostname:
        return "configured URL"
    try:
        parsed_port = parsed.port
    except ValueError:
        parsed_port = None
    port = f":{parsed_port}" if parsed_port else ""
    return f"{parsed.scheme}://{parsed.hostname}{port}"


def _append(
    changes: list[ChangePlanItem],
    *,
    code: str,
    risk: str,
    title: str,
    detail: str,
    service: str | None = None,
    requires_recreate: bool = False,
    data_risk: bool = False,
) -> None:
    changes.append(
        ChangePlanItem(
            code=code,
            risk=risk,
            title=title,
            detail=detail,
            service=service,
            requires_recreate=requires_recreate,
            data_risk=data_risk,
        )
    )


def build_change_plan(db: Session, application: Application) -> ChangePlan:
    baseline = _active_revision(db, application)
    before = _load_compose(baseline.compose_yaml) if baseline else {"services": {}}
    after = build_compose(application)
    fingerprint_source = yaml.safe_dump(after, sort_keys=True) + (
        f"\nbaseline={baseline.id if baseline else 'none'}"
    )
    plan_id = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()[:16]
    before_services = before.get("services") or {}
    after_services = after.get("services") or {}
    changes: list[ChangePlanItem] = []

    added = sorted(set(after_services) - set(before_services))
    removed = sorted(set(before_services) - set(after_services))
    common = sorted(set(before_services) & set(after_services))

    for name in added:
        _append(
            changes,
            code="SERVICE_ADDED",
            risk="low" if baseline is None else "medium",
            title="Service mới sẽ được tạo",
            detail=f"Service '{name}' chưa có trong release đang chạy.",
            service=name,
        )
    for name in removed:
        has_volumes = bool(_volumes(before_services[name]))
        _append(
            changes,
            code="SERVICE_REMOVED",
            risk="high",
            title="Service sẽ bị gỡ",
            detail=(
                f"Service '{name}' sẽ bị xóa khỏi application."
                + (" Kiểm tra dữ liệu volume trước khi deploy." if has_volumes else "")
            ),
            service=name,
            data_risk=has_volumes,
        )

    recreate_services: set[str] = set()
    for name in common:
        old = before_services[name] if isinstance(before_services[name], dict) else {}
        new = after_services[name] if isinstance(after_services[name], dict) else {}
        if old.get("image") != new.get("image"):
            recreate_services.add(name)
            _append(
                changes,
                code="IMAGE_CHANGED",
                risk="medium",
                title="Image thay đổi",
                detail=f"{old.get('image', '—')} → {new.get('image', '—')}",
                service=name,
                requires_recreate=True,
            )

        old_ports, new_ports = _ports(old), _ports(new)
        if old_ports != new_ports:
            recreate_services.add(name)
            _append(
                changes,
                code="PORTS_CHANGED",
                risk="high" if old_ports else "medium",
                title="Public port thay đổi",
                detail=f"{', '.join(old_ports) or 'không public'} → {', '.join(new_ports) or 'không public'}",
                service=name,
                requires_recreate=True,
            )

        old_env, new_env = _environment(old), _environment(new)
        changed_env = sorted(
            key
            for key in set(old_env) | set(new_env)
            if old_env.get(key) != new_env.get(key)
        )
        changed_domains = [key for key in changed_env if _is_domain_key(key)]
        if changed_domains:
            recreate_services.add(name)
            _append(
                changes,
                code="DOMAIN_CHANGED",
                risk="medium",
                title="Domain/URL thay đổi",
                detail="; ".join(
                    f"{key}: {_safe_endpoint(old_env.get(key))} → {_safe_endpoint(new_env.get(key))}"
                    for key in changed_domains
                ),
                service=name,
                requires_recreate=True,
            )

        changed_env = [key for key in changed_env if key not in changed_domains]
        if changed_env:
            recreate_services.add(name)
            _append(
                changes,
                code="ENVIRONMENT_CHANGED",
                risk="medium",
                title="Environment thay đổi",
                detail="Các key thay đổi: " + ", ".join(changed_env),
                service=name,
                requires_recreate=True,
            )

        old_volumes, new_volumes = _volumes(old), _volumes(new)
        if old_volumes != new_volumes:
            removed_mounts = sorted(set(old_volumes) - set(new_volumes))
            recreate_services.add(name)
            _append(
                changes,
                code="VOLUMES_CHANGED",
                risk="high" if removed_mounts else "medium",
                title="Volume mount thay đổi",
                detail=(
                    "Mount bị bỏ/thay: " + ", ".join(removed_mounts)
                    if removed_mounts
                    else "Có volume mount mới được thêm."
                ),
                service=name,
                requires_recreate=True,
                data_risk=bool(removed_mounts),
            )

        if old.get("restart") != new.get("restart"):
            recreate_services.add(name)
            _append(
                changes,
                code="RESTART_POLICY_CHANGED",
                risk="low",
                title="Restart policy thay đổi",
                detail=f"{old.get('restart', '—')} → {new.get('restart', '—')}",
                service=name,
                requires_recreate=True,
            )

    before_named = set((before.get("volumes") or {}).keys())
    after_named = set((after.get("volumes") or {}).keys())
    removed_named = sorted(before_named - after_named)
    if removed_named:
        _append(
            changes,
            code="NAMED_VOLUMES_REMOVED",
            risk="high",
            title="Named volume không còn trong Compose",
            detail="Kiểm tra dữ liệu trước khi bỏ: " + ", ".join(removed_named),
            data_risk=True,
        )

    risk_level = max(
        (item.risk for item in changes),
        key=lambda value: RISK_ORDER[value],
        default="low",
    )
    if not changes:
        _append(
            changes,
            code="NO_CHANGES",
            risk="low",
            title="Không có thay đổi cấu hình",
            detail="Compose mong muốn giống release thành công gần nhất.",
        )

    return ChangePlan(
        plan_id=plan_id,
        baseline_revision_id=baseline.id if baseline else None,
        first_deploy=baseline is None,
        rollback_available=baseline is not None,
        risk_level=risk_level,
        services_added=added,
        services_removed=removed,
        services_recreated=sorted(recreate_services),
        changes=changes,
    )
