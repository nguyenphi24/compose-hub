from __future__ import annotations

import json
import random

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def application_payload(name: str, host_port: int | None):
    return {
        "name": name,
        "environment": "production",
        "description": "",
        "services": [
            {
                "name": "web",
                "image": "nginx:alpine",
                "container_port": 80,
                "host_port": host_port,
                "restart_policy": "unless-stopped",
                "environment": {},
                "volumes": [],
            }
        ],
    }


def test_manual_create_and_update_reject_reserved_port(monkeypatch):
    monkeypatch.setattr("app.port_validation.port_is_available", lambda _port: True)
    monkeypatch.setattr(
        "app.port_validation.port_is_available_for_application",
        lambda _application, _port: True,
    )

    owner = client.post(
        "/api/applications", json=application_payload("manual-port-owner", 8400)
    )
    assert owner.status_code == 201

    create_conflict = client.post(
        "/api/applications", json=application_payload("manual-port-conflict", 8400)
    )
    assert create_conflict.status_code == 409
    assert "manual-port-owner" in create_conflict.json()["detail"]

    editable = client.post(
        "/api/applications", json=application_payload("manual-port-edit", 8401)
    )
    assert editable.status_code == 201
    update_conflict = client.patch(
        f"/api/applications/{editable.json()['id']}",
        json={"services": application_payload("unused", 8400)["services"]},
    )
    assert update_conflict.status_code == 409
    assert "8400" in update_conflict.json()["detail"]


def test_application_response_preserves_environment_and_volumes():
    payload = application_payload("serialized-service-config", None)
    payload["services"][0]["environment"] = {"APP_MODE": "smoke"}
    payload["services"][0]["volumes"] = [
        {"source": "serialized_data", "target": "/usr/share/nginx/html"}
    ]

    created = client.post("/api/applications", json=payload)
    assert created.status_code == 201
    service = created.json()["services"][0]
    assert service["environment"] == {"APP_MODE": "smoke"}
    assert service["volumes"] == [
        {"source": "serialized_data", "target": "/usr/share/nginx/html"}
    ]

    fetched = client.get(f"/api/applications/{created.json()['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["services"][0]["environment"] == {"APP_MODE": "smoke"}
    assert fetched.json()["services"][0]["volumes"][0]["source"] == "serialized_data"


def test_create_update_delete_application():
    rand_suffix = random.randint(10000, 99999)
    app_name = f"crud-test-{rand_suffix}"

    # 1. Create
    create_resp = client.post(
        "/api/applications",
        json={
            "name": app_name,
            "environment": "development",
            "description": "Test CRUD",
            "services": [
                {
                    "name": "web",
                    "image": "nginx:alpine",
                    "container_port": 80,
                    "host_port": None,
                    "restart_policy": "unless-stopped",
                    "environment": {},
                    "volumes": [],
                }
            ],
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    app_data = create_resp.json()
    app_id = app_data["id"]
    assert app_data["name"] == app_name
    assert app_data["environment"] == "development"

    # 2. Update description and environment
    patch_resp = client.patch(
        f"/api/applications/{app_id}",
        json={"description": "Updated description", "environment": "staging"},
    )
    assert patch_resp.status_code == 200, patch_resp.text
    patched = patch_resp.json()
    assert patched["description"] == "Updated description"
    assert patched["environment"] == "staging"
    assert patched["name"] == app_name  # name unchanged

    # 3. Update services (replace)
    patch_services_resp = client.patch(
        f"/api/applications/{app_id}",
        json={
            "services": [
                {
                    "name": "web",
                    "image": "nginx:1.27",
                    "container_port": 80,
                    "host_port": None,
                    "restart_policy": "always",
                    "environment": {"NGINX_ENV": "test"},
                    "volumes": [],
                }
            ]
        },
    )
    assert patch_services_resp.status_code == 200, patch_services_resp.text
    updated_services = patch_services_resp.json()["services"]
    assert updated_services[0]["image"] == "nginx:1.27"
    assert updated_services[0]["restart_policy"] == "always"

    # 4. Delete
    delete_resp = client.delete(f"/api/applications/{app_id}")
    assert delete_resp.status_code == 204, delete_resp.text

    # 5. Verify gone
    get_resp = client.get(f"/api/applications/{app_id}")
    assert get_resp.status_code == 404


def test_update_duplicate_name_rejected():
    rand_suffix = random.randint(10000, 99999)
    name_a = f"app-a-{rand_suffix}"
    name_b = f"app-b-{rand_suffix}"

    # Create app A
    resp_a = client.post(
        "/api/applications",
        json={"name": name_a, "environment": "production", "description": "", "services": [{"name": "web", "image": "nginx:alpine", "container_port": None, "host_port": None, "restart_policy": "unless-stopped", "environment": {}, "volumes": []}]},
    )
    assert resp_a.status_code == 201
    id_a = resp_a.json()["id"]

    # Create app B
    resp_b = client.post(
        "/api/applications",
        json={"name": name_b, "environment": "production", "description": "", "services": [{"name": "web", "image": "nginx:alpine", "container_port": None, "host_port": None, "restart_policy": "unless-stopped", "environment": {}, "volumes": []}]},
    )
    assert resp_b.status_code == 201
    id_b = resp_b.json()["id"]

    # Try to rename B to A's name
    rename_resp = client.patch(f"/api/applications/{id_b}", json={"name": name_a})
    assert rename_resp.status_code == 409

    # Cleanup
    client.delete(f"/api/applications/{id_a}")
    client.delete(f"/api/applications/{id_b}")
