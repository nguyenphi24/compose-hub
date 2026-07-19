from __future__ import annotations

import json
import random

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


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
