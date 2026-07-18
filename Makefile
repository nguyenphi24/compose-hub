.PHONY: dev-backend dev-frontend up down test

dev-backend:
	cd backend && uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

up:
	docker compose up --build

down:
	docker compose down

test:
	cd backend && .venv/bin/python -m pytest -q
