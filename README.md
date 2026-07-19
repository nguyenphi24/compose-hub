# ComposeHub

> Open-source change control and recovery for Docker Compose applications.

ComposeHub manages the lifecycle of Docker Compose applications on a single
host. It focuses on understanding deployment risk, preserving release history,
and recovering to a known-good revision without requiring routine SSH access.

Current release: **v0.2.0 — Change Plan**

## Implemented features

- Application create, edit, clone and delete.
- Manual service builder with environment variables and volume mounts.
- Blueprints for Nginx, PostgreSQL and n8n + PostgreSQL.
- Generated `compose.yaml` preview and exportable Compose configuration.
- Shared host-port validation across manual, blueprint, clone and deploy flows.
- Container status, logs, deploy and stop operations.
- Compose Doctor with Critical, Warning and Info findings.
- Immutable release snapshots, timeline and one-click rollback.
- Concurrent deploy/rollback protection.
- Change Plan comparing desired configuration with the last successful release.
- Detection of service, image, port, domain/URL, environment, restart-policy and
  volume changes.
- Low/Medium/High risk classification and explicit data-risk warnings.
- Deploy confirmation gate with stale-plan fingerprint protection.

ComposeHub intentionally manages applications instead of exposing every Docker
container, image, network and volume as unrelated resources.

## Release workflow

Development progresses one version at a time:

```text
Scope version
→ implement vertical features
→ backend tests + frontend build
→ Docker smoke test when runtime behavior changes
→ update documentation
→ merge dev into main
→ create release tag
→ open the next version
```

The next version does not start until the current version passes its release
gate. See [task.md](task.md) for current progress and [public roadmap](docs/ROADMAP.md)
for planned releases.

## Architecture

```text
React + Vite
      │ REST API
      ▼
FastAPI + SQLite
      │
      ├── Compose generator and static risk analysis
      ├── Release snapshots and rollback
      ├── docker compose commands
      └── Docker Engine API
              │
              ▼
      /var/run/docker.sock
```

## Getting started

### Requirements

- Docker Engine
- Docker Compose v2
- Node.js 20+ and Python 3.11+ for local development

### Run with Docker Compose

```bash
git clone https://github.com/tpcodelabs/composehub.git
cd composehub
docker compose up --build -d
```

Open `http://localhost:5173`.

### Local development

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

### Tests

```bash
python -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements-dev.txt
make test
npm --prefix frontend run build
```

Backend tests use an isolated temporary SQLite database and Compose data
directory. They do not require a Docker daemon.

## Safe deploy flow

```text
Create or edit application
→ Compose Doctor
→ Change Plan
→ confirm deployment risk
→ Deploy
→ inspect status, logs and release timeline
→ Rollback when required
```

Change Plan never returns secret values. Sensitive environment changes expose
only key names, while URLs containing credentials are reduced to safe endpoint
information.

## Security warning

The backend mounts the Docker socket. Access to `/var/run/docker.sock` is close
to administrative access to the Docker host.

- Do not expose the current UI directly to the public Internet.
- Use localhost, a trusted private network or a VPN.
- Authentication and RBAC are not implemented in the current release.
- Review Compose Doctor findings before every deployment.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | API health |
| GET | `/api/server` | Docker host information |
| GET/POST | `/api/applications` | List or create applications |
| GET/PATCH/DELETE | `/api/applications/{id}` | Application lifecycle |
| GET | `/api/applications/{id}/compose` | Generated Compose YAML |
| POST | `/api/applications/{id}/doctor` | Static safety analysis |
| GET | `/api/applications/{id}/change-plan` | Deployment diff and risk |
| POST | `/api/applications/{id}/deploy` | Gated deployment |
| POST | `/api/applications/{id}/stop` | Stop application |
| GET | `/api/applications/{id}/status` | Container status |
| GET | `/api/applications/{id}/logs` | Container logs |
| GET | `/api/applications/{id}/revisions` | Release history |
| POST | `/api/applications/{id}/rollback/{revision_id}` | Rollback |
| GET | `/api/templates` | Blueprint catalog |
| POST | `/api/applications/from-template` | Create from blueprint |
| POST | `/api/applications/{id}/clone` | Clone application |

## Contributing

Issues and pull requests are welcome. New work should target the active version
in `task.md` and include tests proportional to its risk.

## License

MIT
