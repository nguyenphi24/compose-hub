from __future__ import annotations

import json
import yaml

from app.template_service import (
    generate_secure_password,
    render_template_services,
    preview_template_compose,
)


def test_generate_secure_password():
    pwd1 = generate_secure_password()
    pwd2 = generate_secure_password()
    assert len(pwd1) == 16
    assert pwd1 != pwd2
    assert pwd1.isalnum()


def test_render_template_services_nginx():
    services = render_template_services("nginx", "my-nginx", {"host_port": 8080})
    assert len(services) == 1
    web = services[0]
    assert web.name == "web"
    assert web.image == "nginx:alpine"
    assert web.container_port == 80
    assert web.host_port == 8080
    assert web.restart_policy == "unless-stopped"


def test_render_template_services_postgres_autogen_password():
    services = render_template_services(
        "postgres", "my-pg", {"host_port": 5432, "db_user": "admin", "db_name": "mydb"}
    )
    assert len(services) == 1
    db = services[0]
    assert db.name == "db"
    assert db.image == "postgres:15-alpine"
    assert db.host_port == 5432
    env = json.loads(db.environment_json)
    assert env["POSTGRES_USER"] == "admin"
    assert env["POSTGRES_DB"] == "mydb"
    assert len(env["POSTGRES_PASSWORD"]) == 16


def test_render_template_services_n8n_postgres():
    services = render_template_services(
        "n8n-postgres", "my-n8n", {"n8n_host_port": 8000}
    )
    assert len(services) == 2
    
    db_service = next(s for s in services if s.name == "db")
    assert db_service.host_port is None  # PostgreSQL not published
    assert db_service.image == "postgres:15-alpine"
    db_env = json.loads(db_service.environment_json)
    assert db_env["POSTGRES_USER"] == "n8n"
    assert len(db_env["POSTGRES_PASSWORD"]) == 16

    n8n_service = next(s for s in services if s.name == "n8n")
    assert n8n_service.host_port == 8000
    assert n8n_service.image == "n8nio/n8n:1.30.0"
    n8n_env = json.loads(n8n_service.environment_json)
    assert n8n_env["DB_TYPE"] == "postgresdb"
    assert n8n_env["DB_POSTGRESDB_HOST"] == "db"
    assert n8n_env["DB_POSTGRESDB_PASSWORD"] == db_env["POSTGRES_PASSWORD"]


def test_preview_template_compose():
    compose_yaml = preview_template_compose("nginx", "test-nginx", {"host_port": 9000})
    parsed = yaml.safe_load(compose_yaml)
    assert parsed["name"] == "composehub-test-nginx"
    assert parsed["services"]["web"]["image"] == "nginx:alpine"
    assert parsed["services"]["web"]["ports"] == ["9000:80"]


def test_api_get_templates(client):
    response = client.get("/api/templates")
    assert response.status_code == 200
    templates = response.json()
    assert len(templates) == 3
    assert any(t["id"] == "nginx" for t in templates)
    assert any(t["id"] == "postgres" for t in templates)
    assert any(t["id"] == "n8n-postgres" for t in templates)


def test_api_preview_template(client):
    response = client.post(
        "/api/templates/preview",
        json={"template_id": "nginx", "app_name": "test-app", "variables": {"host_port": 7000}},
    )
    assert response.status_code == 200
    data = response.json()
    assert "compose" in data
    assert "7000:80" in data["compose"]


def test_api_create_from_template_and_clone(client, monkeypatch):
    monkeypatch.setattr("app.port_validation.port_is_available", lambda _port: True)
    # 1. Create App from template
    app_name = "test-app-from-template"

    response = client.post(
        "/api/applications/from-template",
        json={
            "template_id": "nginx",
            "name": app_name,
            "environment": "staging",
            "description": "App built from Nginx template",
            "variables": {"host_port": 8100},
        },
    )
    assert response.status_code == 201
    created_app = response.json()
    assert created_app["name"] == app_name
    assert created_app["environment"] == "staging"
    assert len(created_app["services"]) == 1
    assert created_app["services"][0]["host_port"] == 8100
    
    app_id = created_app["id"]

    # 2. Clone the App
    clone_name = f"clone-{app_name}"
    clone_response = client.post(
        f"/api/applications/{app_id}/clone",
        json={"name": clone_name, "host_ports": {"web": 8101}},
    )
    assert clone_response.status_code == 201
    cloned_app = clone_response.json()
    assert cloned_app["name"] == clone_name
    assert cloned_app["environment"] == "staging"
    assert len(cloned_app["services"]) == 1
    assert cloned_app["services"][0]["host_port"] == 8101


def test_blueprint_rejects_port_reserved_by_an_application(client, monkeypatch):
    monkeypatch.setattr("app.port_validation.port_is_available", lambda _port: True)
    payload = {
        "template_id": "nginx",
        "environment": "production",
        "description": "",
        "variables": {"host_port": 8200},
    }

    first = client.post(
        "/api/applications/from-template",
        json={**payload, "name": "port-owner"},
    )
    assert first.status_code == 201

    conflict = client.post(
        "/api/applications/from-template",
        json={**payload, "name": "port-conflict"},
    )
    assert conflict.status_code == 409
    assert "8200" in conflict.json()["detail"]
    assert "port-owner" in conflict.json()["detail"]


def test_clone_requires_new_public_ports_and_rejects_conflict(client, monkeypatch):
    monkeypatch.setattr("app.port_validation.port_is_available", lambda _port: True)
    source = client.post(
        "/api/applications/from-template",
        json={
            "template_id": "nginx",
            "name": "clone-source",
            "variables": {"host_port": 8300},
        },
    )
    assert source.status_code == 201
    source_id = source.json()["id"]

    missing = client.post(
        f"/api/applications/{source_id}/clone",
        json={"name": "clone-missing-port"},
    )
    assert missing.status_code == 400
    assert "web" in missing.json()["detail"]

    conflict = client.post(
        f"/api/applications/{source_id}/clone",
        json={"name": "clone-conflict", "host_ports": {"web": 8300}},
    )
    assert conflict.status_code == 409
    assert "8300" in conflict.json()["detail"]
