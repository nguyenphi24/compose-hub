# ComposeHub release tracker

## Release policy

Chỉ triển khai một version tại một thời điểm. Version hiện tại phải qua đủ release
gate trước khi mở scope version tiếp theo.

Trạng thái version:

```text
Planned → In progress → Verification → Released
```

Release gate bắt buộc:

- [ ] Scope và tiêu chí hoàn thành đã được chốt.
- [ ] Feature hoạt động end-to-end qua API và UI nếu có giao diện.
- [ ] Backend test suite pass.
- [ ] Frontend production build pass.
- [ ] Docker smoke test pass nếu thay đổi hành vi runtime/deploy.
- [ ] README và roadmap phản ánh đúng tính năng đã implement.
- [ ] Commit đã merge từ `dev` vào `main`.
- [ ] Release tag đã được tạo và push.

## v0.1.0 — Single Host Safe Release

**Status:** Released

- [x] Application CRUD và Manual Builder.
- [x] Nginx, PostgreSQL và n8n + PostgreSQL Blueprints.
- [x] Compose preview và host-port validation dùng chung.
- [x] Compose Doctor và Critical deploy blocking.
- [x] Release snapshot, timeline và rollback.
- [x] Container status, logs, stop và deploy concurrency lock.
- [x] Backend tests, frontend build và Docker smoke test.
- [x] Tag `v0.1.0`.

## v0.2.0 — Change Plan

**Status:** Released

- [x] So sánh desired Compose với release thành công gần nhất.
- [x] Phát hiện service add/remove/recreate.
- [x] Phát hiện image, port, domain/URL, environment key, restart policy và volume change.
- [x] Low/Medium/High risk và data-risk warning.
- [x] Hiển thị baseline revision và rollback availability.
- [x] Deploy confirmation UI.
- [x] Stale-plan fingerprint trả 409 nếu config/baseline thay đổi.
- [x] Không trả secret values trong Change Plan.
- [x] 27 backend tests và frontend production build pass.
- [x] Tag `v0.2.0`.

## v0.3.0 — Distribution Foundation

**Status:** In progress

### Scope

- [x] Installer chạy bằng một lệnh `curl | sh`.
- [x] Tự resolve GitHub release mới nhất hoặc pin bằng `COMPOSEHUB_VERSION`.
- [x] Kiểm tra Docker Engine và Docker Compose v2 trước khi cài.
- [x] Tách source theo version và giữ application data trong thư mục dùng chung.
- [x] Chạy lại installer để upgrade mà không xóa data.
- [x] Cho phép cấu hình install directory, web port và API port.
- [x] API chỉ bind localhost theo mặc định.
- [x] UI hỗ trợ Tiếng Việt và English, lưu lựa chọn trên trình duyệt.
- [ ] Smoke test installer trên máy sạch từ tag release candidate.
- [ ] Xác minh upgrade từ `v0.2.0` sang release candidate giữ nguyên data.

### Release gate

- [ ] Toàn bộ scope được implement hoặc mục bị loại có quyết định ghi lại.
- [ ] Backend test suite và frontend build pass.
- [ ] One-line installer và upgrade được Docker smoke test.
- [ ] README phản ánh đúng lệnh install, cấu hình và giới hạn bảo mật.
- [ ] Merge `dev → main` và push tag `v0.3.0`.

## Later versions

Chưa mở implementation cho đến khi `v0.3.0` Released.

- **v0.4.0 — Recovery Capsule:** manifest phục hồi, image digest, secret references và volume inventory.
- **v0.5.0 — Safe Clone Environment:** port/domain remap và data mode có kiểm soát.
- **Later — Published Images:** multi-architecture images và update/rollback command không cần local build.
- Authentication/RBAC phải có trước Container Console hoặc public deployment.

## Product rules

- ComposeHub quản lý vòng đời application, không sao chép Docker resource UI của Portainer.
- Docker Compose luôn là định dạng có thể export; không khóa người dùng vào DSL riêng.
- Không ghi tính năng vào README như đã có trước khi code và release gate pass.
- Docker socket và container console được xem là quyền quản trị host.
