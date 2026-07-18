from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import patch


def create_application(client, name: str, *, image: str = "nginx:alpine", host_port: int = 19080):
    with patch("app.main.port_is_available", return_value=True):
        response = client.post(
            "/api/applications",
            json={
                "name": name,
                "environment": "test",
                "description": "Safe Release API test",
                "services": [
                    {
                        "name": "web",
                        "image": image,
                        "container_port": 80 if "postgres" not in image else 5432,
                        "host_port": host_port,
                        "restart_policy": "unless-stopped",
                        "environment": {},
                        "volumes": [],
                    }
                ],
            },
        )
    assert response.status_code == 201, response.text
    return response.json()


def test_deploy_success_creates_snapshot(client):
    application = create_application(client, "release-success")

    with patch("app.doctor_service.port_is_available_for_application", return_value=True), patch(
        "app.release_service.run_compose", return_value="deployed"
    ):
        response = client.post(f"/api/applications/{application['id']}/deploy")

    assert response.status_code == 200
    assert response.json()["revision"]["status"] == "success"
    revisions = client.get(f"/api/applications/{application['id']}/revisions").json()
    assert len(revisions) == 1
    assert revisions[0]["status"] == "success"
    assert revisions[0]["doctor_report"]["can_deploy"] is True


def test_doctor_critical_blocks_deploy_and_records_revision(client):
    application = create_application(
        client, "release-blocked", image="postgres:15-alpine", host_port=19432
    )

    with patch("app.doctor_service.port_is_available_for_application", return_value=True):
        response = client.post(f"/api/applications/{application['id']}/deploy")

    assert response.status_code == 422
    revisions = client.get(f"/api/applications/{application['id']}/revisions").json()
    assert len(revisions) == 1
    assert revisions[0]["status"] == "blocked"
    assert revisions[0]["doctor_report"]["critical_count"] >= 1


def test_docker_failure_records_failed_revision(client):
    application = create_application(client, "release-failed")

    with patch("app.doctor_service.port_is_available_for_application", return_value=True), patch(
        "app.release_service.run_compose", side_effect=RuntimeError("Docker daemon failed")
    ):
        response = client.post(f"/api/applications/{application['id']}/deploy")

    assert response.status_code == 500
    revisions = client.get(f"/api/applications/{application['id']}/revisions").json()
    assert revisions[0]["status"] == "failed"
    assert "Docker daemon failed" in revisions[0]["output"]


def test_rollback_only_accepts_own_successful_revision(client):
    application = create_application(client, "release-rollback")
    other_application = create_application(client, "release-other", host_port=19081)

    with patch("app.doctor_service.port_is_available_for_application", return_value=True), patch(
        "app.release_service.run_compose", return_value="deployed"
    ):
        deploy = client.post(f"/api/applications/{application['id']}/deploy")
        target_revision_id = deploy.json()["revision"]["id"]
        rollback = client.post(
            f"/api/applications/{application['id']}/rollback/{target_revision_id}"
        )

    assert rollback.status_code == 200
    assert rollback.json()["action"] == "rollback"
    wrong_application = client.post(
        f"/api/applications/{other_application['id']}/rollback/{target_revision_id}"
    )
    assert wrong_application.status_code == 404


def test_concurrent_deploy_returns_conflict_instead_of_docker_name_error(client):
    application = create_application(client, "release-concurrent")
    compose_started = Event()
    allow_compose_to_finish = Event()

    def slow_compose(*_args):
        compose_started.set()
        assert allow_compose_to_finish.wait(timeout=3)
        return "deployed"

    with patch("app.doctor_service.port_is_available_for_application", return_value=True), patch(
        "app.release_service.run_compose", side_effect=slow_compose
    ):
        with ThreadPoolExecutor(max_workers=1) as executor:
            first_deploy = executor.submit(
                lambda: client.post(f"/api/applications/{application['id']}/deploy")
            )
            assert compose_started.wait(timeout=3)
            second_deploy = client.post(f"/api/applications/{application['id']}/deploy")
            allow_compose_to_finish.set()
            first_response = first_deploy.result(timeout=3)

    assert first_response.status_code == 200
    assert second_deploy.status_code == 409
    assert "Deploy hoặc Rollback" in second_deploy.json()["detail"]
