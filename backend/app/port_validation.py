from __future__ import annotations

from collections.abc import Iterable
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from .compose_service import port_is_available, port_is_available_for_application
from .models import Application, Service


class HasHostPort(Protocol):
    host_port: int | None


class PortValidationError(ValueError):
    def __init__(self, detail: str, status_code: int = 409):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def validate_host_ports(
    db: Session,
    services: Iterable[HasHostPort],
    *,
    current_application: Application | None = None,
) -> None:
    """Validate host ports against the application inventory and Docker host."""

    requested_ports = [service.host_port for service in services if service.host_port]
    if len(requested_ports) != len(set(requested_ports)):
        raise PortValidationError(
            "Có host port bị trùng trong application.", status_code=400
        )

    if not requested_ports:
        return

    statement = select(Service).where(Service.host_port.in_(requested_ports))
    if current_application is not None:
        statement = statement.where(
            Service.application_id != current_application.id
        )
    reserved = db.scalars(statement).first()
    if reserved is not None:
        raise PortValidationError(
            f"Port {reserved.host_port} đã được application "
            f"'{reserved.application.name}' sử dụng."
        )

    for port in requested_ports:
        available = (
            port_is_available_for_application(current_application, port)
            if current_application is not None
            else port_is_available(port)
        )
        if not available:
            raise PortValidationError(
                f"Port {port} đang được sử dụng trên Docker host."
            )
