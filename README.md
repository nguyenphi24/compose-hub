# ComposeHub

> Nền tảng mã nguồn mở giúp quản lý và triển khai ứng dụng Docker Compose bằng giao diện Web, giảm nhu cầu SSH trực tiếp vào máy chủ.

## Mục tiêu MVP 8 giờ

Bản MVP tập trung vào **một Docker host** và một luồng hoàn chỉnh:

1. Xem trạng thái Docker host.
2. Tạo Application bằng giao diện.
3. Khai báo các service, port, volume và biến môi trường.
4. Sinh `compose.yaml`.
5. Deploy / Stop Application.
6. Xem trạng thái container và log.

ComposeHub quản lý theo **Application**, không quản lý rời rạc từng container.

```text
Application
├── backend
├── database
├── redis
└── worker
```

## Kiến trúc MVP

```text
React + Vite
      │
      │ REST API
      ▼
FastAPI + SQLite
      │
      ├── Sinh compose.yaml
      ├── Gọi docker compose
      └── Đọc Docker Engine
              │
              ▼
      /var/run/docker.sock
```

## Chạy nhanh

### Điều kiện

- Docker Engine
- Docker Compose v2
- Node.js 20+
- Python 3.11+

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Truy cập:

```text
http://localhost:5173
```

Backend mặc định:

```text
http://localhost:8000
```

### Chạy bằng Docker Compose

```bash
docker compose up --build
```

> Backend được mount Docker socket để thao tác với Docker Engine của máy chủ. Chỉ sử dụng trong môi trường tin cậy.

## Luồng demo

1. Mở Dashboard.
2. Kiểm tra Docker host đang online.
3. Chọn **Tạo Application**.
4. Nhập tên application, ví dụ `demo-blog`.
5. Thêm service:
   - `web`: `nginx:alpine`, container port `80`, host port `8088`.
6. Lưu application.
7. Mở trang chi tiết.
8. Xem `compose.yaml` đã được sinh.
9. Bấm **Deploy**.
10. Truy cập `http://localhost:8088`.
11. Xem container và log ngay trong ComposeHub.

## API chính

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/server` | Thông tin Docker host |
| GET | `/api/applications` | Danh sách application |
| POST | `/api/applications` | Tạo application |
| GET | `/api/applications/{id}` | Chi tiết application |
| GET | `/api/applications/{id}/compose` | Xem compose.yaml |
| POST | `/api/applications/{id}/deploy` | Deploy |
| POST | `/api/applications/{id}/stop` | Stop |
| GET | `/api/applications/{id}/status` | Trạng thái container |
| GET | `/api/applications/{id}/logs` | Log |

## Phân chia công việc trong 8 giờ

Xem chi tiết tại [docs/PLAN_8_HOURS.md](docs/PLAN_8_HOURS.md).

## Scope không làm trong MVP

- Multi-server Agent
- RBAC
- GitOps
- Reverse proxy tự động
- SSL
- Backup/restore
- Monitoring lịch sử
- Secret vault
- Rollback revision

Các phần này được giữ trong roadmap, nhưng không nên đưa vào demo 8 giờ.

## License

MIT
