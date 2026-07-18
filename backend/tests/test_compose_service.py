import json
from unittest.mock import patch

from app.compose_service import build_compose
from app.database import Base
from app.doctor_service import inspect_compose
from app.models import Application, Service
from app.release_service import create_revision, rollback_to_revision
from sqlalchemy import create_engine
from sqlalchemy.orm import Session


def test_build_compose():
    app = Application(name="demo", environment="production", description="")
    app.services = [
        Service(
            name="web",
            image="nginx:alpine",
            container_port=80,
            host_port=8088,
            restart_policy="unless-stopped",
            environment_json=json.dumps({"MODE": "demo"}),
            volumes_json="[]",
        )
    ]

    compose = build_compose(app)

    assert compose["services"]["web"]["image"] == "nginx:alpine"
    assert compose["services"]["web"]["ports"] == ["8088:80"]
    assert compose["services"]["web"]["environment"]["MODE"] == "demo"


def test_compose_doctor_finds_critical_and_warning_rules():
    report = inspect_compose(
        {
            "services": {
                "database": {
                    "image": "postgres:latest",
                    "ports": ["5432:5432"],
                    "privileged": True,
                    "volumes": ["/var/run/docker.sock:/var/run/docker.sock"],
                },
                "web": {"image": "nginx", "ports": ["8080:80"]},
            }
        },
        port_available=lambda port: port != 8080,
    )

    assert report.can_deploy is False
    assert report.critical_count == 4
    codes = {issue.code for issue in report.issues}
    assert {
        "HOST_PORT_CONFLICT",
        "DATABASE_PUBLIC_EXPOSURE",
        "PRIVILEGED_CONTAINER",
        "DOCKER_SOCKET_MOUNT",
    } <= codes
    assert {
        "UNPINNED_IMAGE",
        "MISSING_RESTART_POLICY",
        "DATABASE_WITHOUT_NAMED_VOLUME",
    } <= codes


def test_rollback_uses_saved_compose_snapshot():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        application = Application(name="rollback-demo", environment="production", description="")
        application.services = [
            Service(
                name="web",
                image="nginx:1.27",
                container_port=80,
                host_port=8088,
                restart_policy="unless-stopped",
                environment_json="{}",
                volumes_json="[]",
            )
        ]
        db.add(application)
        db.commit()
        target = create_revision(
            db,
            application,
            action="deploy",
            status="success",
            compose_yaml="name: composehub-rollback-demo\nservices:\n  web:\n    image: nginx:1.26\n",
        )
        db.commit()

        with patch("app.release_service.run_compose", return_value="rolled back"):
            rollback, output = rollback_to_revision(db, application, target)

        assert output == "rolled back"
        assert rollback.status == "success"
        assert rollback.target_revision_id == target.id
        assert application.active_compose_yaml == target.compose_yaml
