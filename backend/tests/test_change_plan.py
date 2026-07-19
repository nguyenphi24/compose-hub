from __future__ import annotations

from unittest.mock import patch


def app_payload(name: str, *, image: str = "nginx:1.27-alpine"):
    return {
        "name": name,
        "environment": "test",
        "description": "Change Plan test",
        "services": [
            {
                "name": "web",
                "image": image,
                "container_port": 80,
                "host_port": 19100,
                "restart_policy": "unless-stopped",
                "environment": {
                    "API_TOKEN": "secret-v1",
                    "APP_MODE": "production",
                    "APP_DOMAIN": "old.example.test",
                    "DATABASE_URL": "postgres://user:db-secret-v1@old-db.test:5432/app?token=hidden",
                },
                "volumes": [{"source": "web_data", "target": "/data"}],
            }
        ],
    }


def create_app(client, name: str):
    with patch("app.port_validation.port_is_available", return_value=True):
        response = client.post("/api/applications", json=app_payload(name))
    assert response.status_code == 201, response.text
    return response.json()


def deploy(client, application_id: int):
    with patch(
        "app.port_validation.port_is_available_for_application", return_value=True
    ), patch(
        "app.doctor_service.port_is_available_for_application", return_value=True
    ), patch("app.release_service.run_compose", return_value="deployed"):
        response = client.post(f"/api/applications/{application_id}/deploy")
    assert response.status_code == 200, response.text
    return response.json()["revision"]


def test_change_plan_describes_first_deploy(client):
    application = create_app(client, "change-plan-first")

    response = client.get(
        f"/api/applications/{application['id']}/change-plan"
    )
    assert response.status_code == 200
    plan = response.json()
    assert plan["first_deploy"] is True
    assert plan["rollback_available"] is False
    assert plan["risk_level"] == "low"
    assert plan["services_added"] == ["web"]
    assert plan["changes"][0]["code"] == "SERVICE_ADDED"


def test_change_plan_detects_recreate_and_data_risk_without_leaking_secrets(client):
    application = create_app(client, "change-plan-risk")
    revision = deploy(client, application["id"])
    updated = app_payload("unused", image="nginx:1.28-alpine")
    updated_service = updated["services"][0]
    updated_service["host_port"] = 19101
    updated_service["environment"] = {
        "API_TOKEN": "secret-v2",
        "APP_MODE": "staging",
        "APP_DOMAIN": "new.example.test",
        "DATABASE_URL": "postgres://user:db-secret-v2@new-db.test:5432/app?token=hidden",
    }
    updated_service["volumes"] = []

    with patch(
        "app.port_validation.port_is_available_for_application", return_value=True
    ):
        response = client.patch(
            f"/api/applications/{application['id']}",
            json={"services": [updated_service]},
        )
    assert response.status_code == 200, response.text

    plan_response = client.get(
        f"/api/applications/{application['id']}/change-plan"
    )
    assert plan_response.status_code == 200
    plan = plan_response.json()
    codes = {change["code"] for change in plan["changes"]}
    assert plan["baseline_revision_id"] == revision["id"]
    assert plan["rollback_available"] is True
    assert plan["risk_level"] == "high"
    assert plan["services_recreated"] == ["web"]
    assert {
        "IMAGE_CHANGED",
        "PORTS_CHANGED",
        "DOMAIN_CHANGED",
        "ENVIRONMENT_CHANGED",
        "VOLUMES_CHANGED",
    } <= codes
    assert any(change["data_risk"] for change in plan["changes"])
    serialized = plan_response.text
    assert "secret-v1" not in serialized
    assert "secret-v2" not in serialized
    assert "db-secret-v1" not in serialized
    assert "db-secret-v2" not in serialized
    assert "postgres://old-db.test:5432" in serialized
    assert "API_TOKEN" in serialized


def test_change_plan_uses_rollback_target_as_baseline(client):
    application = create_app(client, "change-plan-rollback")
    revision_one = deploy(client, application["id"])

    service = app_payload("unused", image="nginx:1.28-alpine")["services"][0]
    with patch(
        "app.port_validation.port_is_available_for_application", return_value=True
    ):
        updated = client.patch(
            f"/api/applications/{application['id']}", json={"services": [service]}
        )
    assert updated.status_code == 200
    deploy(client, application["id"])

    with patch("app.release_service.run_compose", return_value="rolled back"):
        rollback = client.post(
            f"/api/applications/{application['id']}/rollback/{revision_one['id']}"
        )
    assert rollback.status_code == 200

    plan = client.get(
        f"/api/applications/{application['id']}/change-plan"
    ).json()
    assert plan["baseline_revision_id"] == revision_one["id"]
    assert plan["changes"][0]["code"] == "IMAGE_CHANGED"
    assert plan["services_recreated"] == ["web"]


def test_deploy_rejects_stale_change_plan(client):
    application = create_app(client, "change-plan-stale")
    plan = client.get(
        f"/api/applications/{application['id']}/change-plan"
    ).json()

    service = app_payload("unused", image="nginx:1.28-alpine")["services"][0]
    with patch(
        "app.port_validation.port_is_available_for_application", return_value=True
    ):
        updated = client.patch(
            f"/api/applications/{application['id']}", json={"services": [service]}
        )
    assert updated.status_code == 200

    rejected = client.post(
        f"/api/applications/{application['id']}/deploy",
        json={"expected_plan_id": plan["plan_id"]},
    )
    assert rejected.status_code == 409
    assert "Change Plan đã cũ" in rejected.json()["detail"]
