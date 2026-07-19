from __future__ import annotations

import json
import secrets
from typing import Any

from app.compose_service import compose_text
from app.models import Application, Service

TEMPLATES = {
    "nginx": {
        "id": "nginx",
        "name": "Nginx Web Server",
        "description": "Máy chủ web Nginx cơ bản, phục vụ trang tĩnh hoặc làm reverse proxy.",
        "variables": [
            {
                "key": "host_port",
                "label": "Cổng Host",
                "type": "int",
                "default": 80,
                "required": True,
                "description": "Cổng trên máy host trỏ tới cổng 80 của container",
            }
        ],
    },
    "postgres": {
        "id": "postgres",
        "name": "PostgreSQL Database",
        "description": "Hệ quản trị cơ sở dữ liệu quan hệ PostgreSQL với named volume.",
        "variables": [
            {
                "key": "host_port",
                "label": "Cổng Host",
                "type": "int",
                "default": 5432,
                "required": True,
                "description": "Cổng trên máy host trỏ tới cổng 5432 của container DB",
            },
            {
                "key": "db_user",
                "label": "Tên người dùng DB",
                "type": "string",
                "default": "postgres",
                "required": True,
                "description": "Tên tài khoản quản trị PostgreSQL",
            },
            {
                "key": "db_password",
                "label": "Mật khẩu DB",
                "type": "password",
                "default": "",
                "required": False,
                "description": "Mật khẩu kết nối. Để trống để tự động sinh mật khẩu ngẫu nhiên an toàn.",
            },
            {
                "key": "db_name",
                "label": "Tên Database",
                "type": "string",
                "default": "postgres",
                "required": True,
                "description": "Tên cơ sở dữ liệu mặc định ban đầu",
            },
        ],
    },
    "n8n-postgres": {
        "id": "n8n-postgres",
        "name": "n8n + PostgreSQL",
        "description": "Hệ thống tự động hóa workflow n8n đi kèm DB PostgreSQL (cổng database được ẩn để bảo mật).",
        "variables": [
            {
                "key": "n8n_host_port",
                "label": "Cổng Host n8n",
                "type": "int",
                "default": 5678,
                "required": True,
                "description": "Cổng trên máy host để truy cập giao diện n8n",
            },
            {
                "key": "db_password",
                "label": "Mật khẩu DB",
                "type": "password",
                "default": "",
                "required": False,
                "description": "Mật khẩu kết nối PostgreSQL. Để trống để tự động sinh mật khẩu ngẫu nhiên an toàn.",
            },
        ],
    },
}


def generate_secure_password(length: int = 16) -> str:
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def render_template_services(
    template_id: str, app_name: str, variables: dict[str, Any]
) -> list[Service]:
    template_def = TEMPLATES.get(template_id)
    if not template_def:
        raise ValueError(f"Không tìm thấy template '{template_id}'")

    resolved: dict[str, Any] = {}
    for var in template_def["variables"]:
        key = var["key"]
        val = variables.get(key)

        # Handle empty/missing values
        if val is None or val == "":
            if var["type"] == "password":
                val = generate_secure_password()
            else:
                val = var.get("default")
        else:
            if var["type"] == "int":
                try:
                    val = int(val)
                except ValueError:
                    raise ValueError(f"Giá trị của '{var['label']}' phải là một số nguyên.")
            elif var["type"] in ("string", "password"):
                val = str(val)

        resolved[key] = val

    services: list[Service] = []

    if template_id == "nginx":
        services.append(
            Service(
                name="web",
                image="nginx:alpine",
                container_port=80,
                host_port=resolved["host_port"],
                restart_policy="unless-stopped",
                environment_json="{}",
                volumes_json="[]",
            )
        )

    elif template_id == "postgres":
        services.append(
            Service(
                name="db",
                image="postgres:15-alpine",
                container_port=5432,
                host_port=resolved["host_port"],
                restart_policy="unless-stopped",
                environment_json=json.dumps(
                    {
                        "POSTGRES_USER": resolved["db_user"],
                        "POSTGRES_PASSWORD": resolved["db_password"],
                        "POSTGRES_DB": resolved["db_name"],
                    }
                ),
                volumes_json=json.dumps(
                    [{"source": f"{app_name}_postgres_data", "target": "/var/lib/postgresql/data"}]
                ),
            )
        )

    elif template_id == "n8n-postgres":
        # PostgreSQL DB (cổng DB không được expose ra ngoài)
        services.append(
            Service(
                name="db",
                image="postgres:15-alpine",
                container_port=5432,
                host_port=None,
                restart_policy="unless-stopped",
                environment_json=json.dumps(
                    {
                        "POSTGRES_USER": "n8n",
                        "POSTGRES_PASSWORD": resolved["db_password"],
                        "POSTGRES_DB": "n8n",
                    }
                ),
                volumes_json=json.dumps(
                    [{"source": f"{app_name}_db_data", "target": "/var/lib/postgresql/data"}]
                ),
            )
        )

        # n8n container
        services.append(
            Service(
                name="n8n",
                image="n8nio/n8n:1.30.0",
                container_port=5678,
                host_port=resolved["n8n_host_port"],
                restart_policy="unless-stopped",
                environment_json=json.dumps(
                    {
                        "DB_TYPE": "postgresdb",
                        "DB_POSTGRESDB_HOST": "db",
                        "DB_POSTGRESDB_PORT": "5432",
                        "DB_POSTGRESDB_DATABASE": "n8n",
                        "DB_POSTGRESDB_USER": "n8n",
                        "DB_POSTGRESDB_PASSWORD": resolved["db_password"],
                    }
                ),
                volumes_json=json.dumps(
                    [{"source": f"{app_name}_n8n_data", "target": "/home/node/.n8n"}]
                ),
            )
        )

    return services


def preview_template_compose(
    template_id: str, app_name: str, variables: dict[str, Any]
) -> str:
    temp_app = Application(
        name=app_name or "preview-app",
        environment="production",
        description="",
    )
    temp_app.services = render_template_services(template_id, temp_app.name, variables)
    return compose_text(temp_app)
