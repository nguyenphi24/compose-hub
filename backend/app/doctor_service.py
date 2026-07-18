from __future__ import annotations

from collections.abc import Callable
from typing import Any

from .compose_service import current_compose, port_is_available_for_application
from .models import Application
from .schemas import DoctorIssue, DoctorReport

DATABASE_IMAGE_HINTS = (
    "postgres",
    "mysql",
    "mariadb",
    "mongo",
    "redis",
    "cassandra",
    "elasticsearch",
)


def _ports(service: dict[str, Any]) -> list[int]:
    result: list[int] = []
    for value in service.get("ports") or []:
        if isinstance(value, dict):
            published = value.get("published")
            if published is not None:
                try:
                    result.append(int(published))
                except (TypeError, ValueError):
                    pass
            continue
        if not isinstance(value, str):
            continue
        value_without_protocol = value.split("/", 1)[0]
        segments = value_without_protocol.rsplit(":", 2)
        if len(segments) < 2:
            continue
        try:
            result.append(int(segments[-2]))
        except ValueError:
            continue
    return result


def _volume_source(value: Any) -> str | None:
    if isinstance(value, dict):
        source = value.get("source")
        return str(source) if source else None
    if isinstance(value, str) and ":" in value:
        return value.split(":", 1)[0]
    return None


def _is_named_volume(source: str | None) -> bool:
    return bool(source) and not source.startswith(("/", "./", "../", "~/"))


def _is_database(service: dict[str, Any]) -> bool:
    image = str(service.get("image", "")).lower()
    return any(hint in image for hint in DATABASE_IMAGE_HINTS)


def _uses_latest(image: str) -> bool:
    if "@" in image:
        return False
    image_name = image.rsplit("/", 1)[-1]
    return ":" not in image_name or image_name.endswith(":latest")


def inspect_compose(
    compose: dict[str, Any],
    *,
    port_available: Callable[[int], bool] | None = None,
) -> DoctorReport:
    """Inspect standard Compose syntax without changing a running application."""

    check_port = port_available or (lambda _: True)
    issues: list[DoctorIssue] = []
    services = compose.get("services") or {}
    public_services: list[str] = []
    declared_volumes: set[str] = set((compose.get("volumes") or {}).keys())

    for name, raw_service in services.items():
        if not isinstance(raw_service, dict):
            continue
        service = raw_service
        image = str(service.get("image", ""))
        host_ports = _ports(service)
        if host_ports:
            public_services.append(f"{name} ({', '.join(map(str, host_ports))})")
        for port in host_ports:
            if not check_port(port):
                issues.append(
                    DoctorIssue(
                        code="HOST_PORT_CONFLICT",
                        severity="critical",
                        title=f"Port {port} đang được sử dụng",
                        detail="Docker host đang có service khác chiếm host port này.",
                        service=name,
                        recommendation="Chọn host port khác hoặc dừng service đang dùng port.",
                    )
                )

        if _is_database(service) and host_ports:
            issues.append(
                DoctorIssue(
                    code="DATABASE_PUBLIC_EXPOSURE",
                    severity="critical",
                    title="Database đang được public ra Internet",
                    detail=f"Service {name} publish host port {', '.join(map(str, host_ports))}.",
                    service=name,
                    recommendation="Bỏ host port và để application kết nối qua Docker network nội bộ.",
                )
            )

        if service.get("privileged") is True:
            issues.append(
                DoctorIssue(
                    code="PRIVILEGED_CONTAINER",
                    severity="critical",
                    title="Container đang chạy privileged",
                    detail="Chế độ privileged cấp quyền gần tương đương host cho container.",
                    service=name,
                    recommendation="Bỏ privileged hoặc chỉ cấp capability thật sự cần thiết.",
                )
            )

        sources = [_volume_source(value) for value in service.get("volumes") or []]
        if any(source == "/var/run/docker.sock" for source in sources):
            issues.append(
                DoctorIssue(
                    code="DOCKER_SOCKET_MOUNT",
                    severity="critical",
                    title="Container mount Docker socket",
                    detail="Container có thể điều khiển Docker Engine của host.",
                    service=name,
                    recommendation="Chỉ dùng socket trong môi trường tin cậy và tách service quản trị.",
                )
            )

        if _uses_latest(image):
            issues.append(
                DoctorIssue(
                    code="UNPINNED_IMAGE",
                    severity="warning",
                    title="Image chưa được pin version",
                    detail=f"Image '{image}' dùng tag latest hoặc không có tag.",
                    service=name,
                    recommendation="Dùng tag version cụ thể hoặc image digest để release có thể lặp lại.",
                )
            )

        if str(service.get("restart", "")).lower() in {"", "no", "false"}:
            issues.append(
                DoctorIssue(
                    code="MISSING_RESTART_POLICY",
                    severity="warning",
                    title="Service thiếu restart policy",
                    detail="Container sẽ không tự khởi động lại sau khi lỗi hoặc host reboot.",
                    service=name,
                    recommendation="Dùng restart: unless-stopped hoặc always.",
                )
            )

        if _is_database(service):
            named_sources = [source for source in sources if _is_named_volume(source)]
            if not named_sources or not any(source in declared_volumes for source in named_sources):
                issues.append(
                    DoctorIssue(
                        code="DATABASE_WITHOUT_NAMED_VOLUME",
                        severity="warning",
                        title="Database chưa dùng named volume",
                        detail="Dữ liệu database có thể bị mất khi container được tạo lại.",
                        service=name,
                        recommendation="Gắn named volume cho thư mục dữ liệu của database.",
                    )
                )

        if host_ports and not service.get("healthcheck"):
            issues.append(
                DoctorIssue(
                    code="PUBLIC_SERVICE_WITHOUT_HEALTHCHECK",
                    severity="warning",
                    title="Service public chưa có healthcheck",
                    detail="ComposeHub không thể xác nhận service đã sẵn sàng phục vụ traffic.",
                    service=name,
                    recommendation="Thêm healthcheck vào Compose trước khi release production.",
                )
            )

    topology = f"{len(services)} service"
    if public_services:
        topology += f"; public: {', '.join(public_services)}"
    else:
        topology += "; không có service public"
    topology += f"; {len(declared_volumes)} named volume; {len(compose.get('networks') or {})} network khai báo"
    issues.append(
        DoctorIssue(
            code="TOPOLOGY_SUMMARY",
            severity="info",
            title="Tóm tắt deployment",
            detail=topology,
        )
    )

    critical_count = sum(issue.severity == "critical" for issue in issues)
    warning_count = sum(issue.severity == "warning" for issue in issues)
    info_count = sum(issue.severity == "info" for issue in issues)
    return DoctorReport(
        can_deploy=critical_count == 0,
        critical_count=critical_count,
        warning_count=warning_count,
        info_count=info_count,
        issues=issues,
    )


def inspect_application(application: Application) -> DoctorReport:
    return inspect_compose(
        current_compose(application),
        port_available=lambda port: port_is_available_for_application(application, port),
    )
