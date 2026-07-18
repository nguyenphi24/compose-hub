from __future__ import annotations

import json
import os
import socket
import subprocess
from pathlib import Path
from typing import Any

import docker
import yaml
from docker.errors import DockerException

from .models import Application

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "applications"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def get_app_dir(application: Application) -> Path:
    app_dir = DATA_DIR / application.name
    app_dir.mkdir(parents=True, exist_ok=True)
    return app_dir


def build_compose(application: Application) -> dict[str, Any]:
    services: dict[str, Any] = {}
    volumes: dict[str, Any] = {}

    for service in application.services:
        definition: dict[str, Any] = {
            "image": service.image,
            "restart": service.restart_policy,
            "labels": {
                "com.composehub.application": application.name,
                "com.composehub.service": service.name,
            },
        }

        if service.host_port and service.container_port:
            definition["ports"] = [f"{service.host_port}:{service.container_port}"]

        env = json.loads(service.environment_json or "{}")
        if env:
            definition["environment"] = env

        mounts = json.loads(service.volumes_json or "[]")
        if mounts:
            definition["volumes"] = [
                f"{mount['source']}:{mount['target']}" for mount in mounts
            ]
            for mount in mounts:
                source = mount["source"]
                if not source.startswith("/") and not source.startswith("."):
                    volumes[source] = {}

        services[service.name] = definition

    result: dict[str, Any] = {
        "name": f"composehub-{application.name}",
        "services": services,
    }
    if volumes:
        result["volumes"] = volumes
    return result


def write_compose(application: Application) -> Path:
    path = get_app_dir(application) / "compose.yaml"
    path.write_text(
        yaml.safe_dump(build_compose(application), sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    return path


def compose_text(application: Application) -> str:
    return yaml.safe_dump(
        build_compose(application),
        sort_keys=False,
        allow_unicode=True,
    )


def run_compose(application: Application, command: list[str]) -> str:
    compose_path = write_compose(application)
    process = subprocess.run(
        ["docker", "compose", "-f", str(compose_path), *command],
        cwd=compose_path.parent,
        capture_output=True,
        text=True,
        timeout=180,
    )
    output = "\n".join(part for part in [process.stdout, process.stderr] if part).strip()
    if process.returncode != 0:
        raise RuntimeError(output or "docker compose command failed")
    return output


def docker_client():
    return docker.from_env()


def server_info() -> dict[str, Any]:
    try:
        client = docker_client()
        info = client.info()
        return {
            "online": True,
            "name": info.get("Name"),
            "docker_version": client.version().get("Version"),
            "containers": info.get("Containers"),
            "containers_running": info.get("ContainersRunning"),
            "images": info.get("Images"),
            "cpus": info.get("NCPU"),
            "memory_bytes": info.get("MemTotal"),
        }
    except DockerException as exc:
        return {"online": False, "error": str(exc)}


def port_is_available(port: int) -> bool:
    try:
        client = docker_client()
        for container in client.containers.list():
            ports = container.attrs.get("NetworkSettings", {}).get("Ports", {})
            for bindings in ports.values():
                for binding in bindings or []:
                    if int(binding.get("HostPort", -1)) == port:
                        return False
    except DockerException:
        pass

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex(("127.0.0.1", port)) != 0


def application_status(application: Application) -> list[dict[str, Any]]:
    try:
        client = docker_client()
        containers = client.containers.list(
            all=True,
            filters={"label": f"com.composehub.application={application.name}"},
        )
        return [
            {
                "id": container.short_id,
                "name": container.name,
                "status": container.status,
                "image": container.image.tags[0] if container.image.tags else container.image.short_id,
            }
            for container in containers
        ]
    except DockerException as exc:
        raise RuntimeError(str(exc)) from exc


def application_logs(application: Application, tail: int = 200) -> str:
    try:
        client = docker_client()
        containers = client.containers.list(
            all=True,
            filters={"label": f"com.composehub.application={application.name}"},
        )
        sections = []
        for container in containers:
            logs = container.logs(tail=tail, timestamps=True).decode("utf-8", errors="replace")
            sections.append(f"===== {container.name} =====\n{logs}")
        return "\n".join(sections) if sections else "Chưa có container nào."
    except DockerException as exc:
        raise RuntimeError(str(exc)) from exc
