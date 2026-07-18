# ComposeHub

> Nền tảng mã nguồn mở giúp quản lý và triển khai ứng dụng Docker Compose bằng giao diện Web, giảm nhu cầu SSH trực tiếp vào máy chủ.

## Mục tiêu MVP 8 giờ — Safe Deploy

Bản MVP tập trung vào **một Docker host** và một lời hứa rõ ràng: triển khai Docker Compose nhanh, biết rủi ro trước khi chạy, và có thể quay lại bản ổn định.

Luồng hoàn chỉnh:

```text
Chọn Blueprint / tạo Application
→ xem Compose
→ Compose Doctor kiểm tra rủi ro
→ Deploy
→ xem trạng thái + log
→ xem release
→ rollback khi cần
```

MVP gồm hai feature độc lập, mỗi feature do một developer sở hữu end-to-end:

| Feature | Nội dung |
|---|---|
| **App Blueprint** | Template `Nginx`, `Postgres`, `n8n + Postgres`; form cấu hình; xem Compose; tạo hoặc clone Application. |
| **Safe Release** | Compose Doctor; deploy snapshot; release timeline; rollback một chạm; trạng thái container và logs. |

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

## Compose Doctor

Trước khi deploy, ComposeHub phân loại cấu hình thành `Critical`, `Warning` và `Info`.

- Port host đã bị chiếm.
- Database bị publish ra Internet.
- Container dùng `privileged` hoặc mount Docker socket.
- Image dùng tag `latest`.
- Database không có named volume.
- Service thiếu restart policy hoặc healthcheck.
- Danh sách service, port, network và volume sẽ được public/tạo mới.

Doctor là kiểm tra tĩnh cho MVP; chỉ lỗi `Critical` mới chặn deploy.

## Luồng demo

1. Mở Dashboard và kiểm tra Docker host.
2. Chọn blueprint `n8n + Postgres` hoặc tạo `Nginx`.
3. Điền tên application và các biến bắt buộc.
4. Xem `compose.yaml` được sinh.
5. Chạy Compose Doctor và xử lý cảnh báo/critical.
6. Bấm **Deploy**, sau đó truy cập ứng dụng.
7. Xem container, logs và release timeline.
8. Thay đổi một cấu hình, deploy revision mới rồi rollback về revision ổn định.

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
| GET | `/api/templates` | Danh sách blueprint |
| POST | `/api/applications/from-template` | Tạo Application từ blueprint |
| POST | `/api/applications/{id}/clone` | Clone Application |
| POST | `/api/applications/{id}/doctor` | Chạy kiểm tra Compose Doctor |
| GET | `/api/applications/{id}/revisions` | Danh sách release/revision |
| POST | `/api/applications/{id}/rollback/{revision_id}` | Rollback về revision đã lưu |

## Phân chia công việc trong 8 giờ

Không chia theo Backend/Frontend. Mỗi developer phụ trách trọn một feature gồm API, UI, test và demo:

- **Dev01**: App Blueprint.
- **Dev02**: Safe Release (Compose Doctor, release timeline và rollback).

Chi tiết tại [docs/PLAN_8_HOURS.md](docs/PLAN_8_HOURS.md).

## Scope không làm trong MVP

- Multi-server Agent
- RBAC
- GitOps
- Reverse proxy tự động
- SSL
- Backup/restore
- Monitoring lịch sử
- Secret vault
- Git deploy / webhook

Các phần này được giữ trong roadmap, nhưng không nên đưa vào demo 8 giờ.

## License

MIT
