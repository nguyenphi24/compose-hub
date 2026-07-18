import json

from app.compose_service import build_compose
from app.models import Application, Service


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
