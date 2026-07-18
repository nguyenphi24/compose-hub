# Kế hoạch MVP 8 giờ — ComposeHub Safe Deploy

## Mục tiêu cuối ngày

Có một sản phẩm single-host chạy được với câu chuyện demo rõ ràng:

```text
Chọn Blueprint / tạo Application
→ xem Compose
→ Compose Doctor kiểm tra rủi ro
→ Deploy
→ xem trạng thái + log
→ xem release
→ rollback khi cần
```

Mỗi developer làm trọn một **vertical feature**: API, UI, test và demo. Không chia Backend/Frontend và không ai phải chờ feature của người còn lại.

## Scope chốt

### Feature 1 — App Blueprint (Dev01)

**Mục tiêu:** tạo ứng dụng chạy được trong dưới một phút.

- Template Gallery: `Nginx`, `Postgres`, `n8n + Postgres`.
- Form chỉ hiển thị biến cần cấu hình; tự sinh password an toàn khi phù hợp.
- Tạo Application từ template.
- Clone Application hiện có.
- Xem `compose.yaml` trước khi tạo/deploy.
- Unit test: template sinh Compose hợp lệ và có các biến bắt buộc.

API thuộc feature:

```text
GET  /api/templates
POST /api/applications/from-template
POST /api/applications/{id}/clone
```

### Feature 2 — Safe Release (Dev02)

**Mục tiêu:** biết rủi ro trước deploy và luôn có đường quay lại release ổn định.

- Compose Doctor trả về `Critical`, `Warning`, `Info`.
- Snapshot Compose tạo trước mỗi lần deploy.
- Release timeline: thời điểm, action, trạng thái, Compose snapshot.
- Rollback một chạm về revision đã lưu.
- Trạng thái container và logs ở trang Application.
- Unit test: Doctor rules, tạo revision và rollback command.

Rule bắt buộc của Compose Doctor:

1. Host port bị chiếm (`Critical`).
2. Database bị publish ra Internet (`Critical`).
3. `privileged: true` hoặc mount Docker socket (`Critical`).
4. Dùng image tag `latest` (`Warning`).
5. Database không có named volume (`Warning`).
6. Thiếu restart policy (`Warning`).
7. Service public thiếu healthcheck (`Warning`).
8. Tóm tắt service, port, network và volume sẽ public/tạo mới (`Info`).

Chỉ `Critical` chặn deploy trong MVP. Các cảnh báo khác hiển thị để người dùng tự quyết định.

API thuộc feature:

```text
POST /api/applications/{id}/doctor
GET  /api/applications/{id}/revisions
POST /api/applications/{id}/rollback/{revision_id}
```

## Quy ước làm song song

### Hợp đồng chung — 20 phút đầu

Cả hai chốt và ghi vào `docs/API_CONTRACT.md`:

- Dạng `Application`, lỗi API và response wrapper.
- Quy ước `revision_id`, severity của Doctor và format timestamp.
- Endpoint hiện có tiếp tục tương thích.

Sau đó frontend dùng fixture khớp hợp đồng; không chờ endpoint thật.

### Ownership file

| Khu vực | Owner |
|---|---|
| `backend/app/template_service.py`, `backend/app/template_routes.py` | Dev01 |
| `frontend/src/pages/NewApplication.tsx`, `frontend/src/components/Template*` | Dev01 |
| `backend/app/doctor_service.py`, `backend/app/release_service.py`, `backend/app/safety_routes.py` | Dev02 |
| `frontend/src/components/DoctorReport.tsx`, `ReleaseTimeline.tsx`, `RollbackDialog.tsx` | Dev02 |
| `backend/app/main.py`, `frontend/src/App.tsx`, API shared types | Chỉ sửa trong lượt integration đã thống nhất |

Dev02 sở hữu phần Safe Release và không chờ Dev01 hoàn thành template để bắt đầu.

## Timeline

| Thời gian | Dev01 — App Blueprint | Dev02 — Safe Release |
|---|---|---|
| 00:00–00:20 | Chạy skeleton, chốt API contract và ownership chung | Chạy skeleton, chốt API contract và ownership chung |
| 00:20–02:00 | Template definitions, Template Gallery, fixture | Doctor engine 8 rules, endpoint, Doctor Report với fixture |
| 02:00–03:30 | Tạo app từ template, form biến, Compose preview | Revision model/migration, release snapshot, Release Timeline |
| 03:30–04:30 | Clone app, unit tests template | Rollback service/endpoint, confirm dialog, unit tests |
| 04:30–05:15 | Nối API thật, xử lý lỗi | Nối snapshot vào deploy, xử lý lỗi |
| 05:15–06:00 | Integration cùng Dev02 | Integration cùng Dev01 |
| 06:00–07:00 | Test toàn bộ luồng, sửa lỗi demo | Test toàn bộ luồng, sửa lỗi demo |
| 07:00–08:00 | README, script và quay demo | README, script và quay demo |

## Integration checklist

- [ ] Register router của hai feature.
- [ ] Không đổi contract endpoint hiện có nếu không cần thiết.
- [ ] Deploy chỉ chạy khi Doctor không có `Critical`.
- [ ] Revision được lưu trước deploy, kể cả khi deploy thất bại.
- [ ] Rollback sử dụng Compose snapshot đã lưu, không dùng state trên UI.
- [ ] Template `n8n + Postgres` sinh named volume và không public cổng Postgres mặc định.

## Kịch bản demo 4 phút

1. Dashboard cho thấy Docker host đang online.
2. Chọn Blueprint `n8n + Postgres`, điền tên application và tạo app.
3. Mở Compose preview để thấy hai service, named volume và network.
4. Chạy Compose Doctor; chỉ ra public exposure hoặc `latest` nếu cố tình thêm cấu hình rủi ro.
5. Sửa lỗi `Critical`, deploy thành công.
6. Xem status và logs.
7. Đổi một cấu hình, deploy revision mới.
8. Mở Release Timeline và rollback về revision chạy ổn định.

## Ngoài scope 8 giờ

- Multi-server Agent và cluster.
- Git deploy, webhook, Docker registry và build từ source.
- Reverse proxy, domain và SSL.
- Authentication, RBAC, audit log.
- Backup/restore volume thật, secret vault và monitoring lịch sử.
- Kubernetes, AI assistant và plugin system.

## Tiêu chí hoàn thành

- [ ] Tạo được app không cần SSH, bằng form hoặc blueprint.
- [ ] Template `Nginx` hoặc `n8n + Postgres` deploy thành công.
- [ ] Compose Doctor hiển thị đủ 8 rule và chặn `Critical`.
- [ ] Có container status, logs và stop application.
- [ ] Mỗi deploy tạo một release/revision.
- [ ] Rollback về revision trước hoạt động trên demo `Nginx`.
- [ ] Hai feature có test riêng và README phản ánh đúng scope.
