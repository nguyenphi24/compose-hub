# Solo backlog — ComposeHub v0.1

## Mục tiêu gần nhất

Hoàn thành **v0.1 Single Host MVP**: một người dùng có thể tạo, sửa, xóa, kiểm tra, deploy, xem logs và rollback Docker Compose application qua UI mà không cần SSH.

Không mở rộng sang multi-server, Git deploy, reverse proxy/SSL, RBAC, backup thật hoặc Kubernetes trước khi các việc P0 hoàn tất.

## Đã hoàn thành

- [x] Application CRUD: create, list, detail, update, delete; có UI chỉnh sửa và xác nhận xóa.
- [x] Manual Builder: image, port, restart policy, environment variables, volume mounts và Compose preview.
- [x] Blueprint: Nginx, PostgreSQL, n8n + PostgreSQL; preview và clone application.
- [x] Compose Doctor: port conflict, database public, privileged/socket mount, image tag, volume, restart policy và healthcheck.
- [x] Safe Release: release snapshot, timeline, rollback và khóa thao tác deploy/rollback đồng thời.
- [x] Test runner: `make test` dùng SQLite/data tạm thời, không cần Docker daemon.
- [x] Backend coverage cho CRUD, Blueprint và Safe Release API.

## P0 — Chốt v0.1

### 1. Chuẩn hóa port validation cho mọi luồng

- [x] Tách một service validate host port dùng chung cho manual create, update, blueprint create và clone.
- [x] Blueprint create trả 409 dễ hiểu nếu port đã bị dùng.
- [x] Khi Clone app có service public, UI bắt nhập host port mới cho từng service public; backend validate các giá trị đó.
- [x] Không cho clone/deploy một app trùng host port với app khác.
- [x] Thêm test API cho Manual/Blueprint/Clone port conflict.

**Done khi:** không còn đường UI/API nào tạo được application deployable với host port trùng; thông báo luôn nêu port bị chiếm.

### 2. Smoke test trên Docker thật

- [x] Tạo Nginx thủ công, dùng environment variable và named volume, sau đó Doctor → Deploy → Status → Logs → Stop.
- [x] Tạo n8n + PostgreSQL từ Blueprint, deploy rồi kiểm tra volume/database không public.
- [x] Deploy thêm revision và rollback về revision trước.
- [x] Thử Doctor với PostgreSQL public port để xác nhận deploy bị chặn.
- [x] Ghi kết quả smoke test và giới hạn cleanup trong README.

**Done khi:** cả hai demo chạy thành công trên Docker host, không có lỗi container-name conflict hay port conflict khó hiểu.

### 3. Release polish

- [x] Kiểm tra UI tại chiều rộng 375px; dashboard và thao tác chính render một cột, không bị che khuất.
- [x] README có lệnh chạy/test chính xác, cảnh báo rõ Docker socket tương đương quyền quản trị host và chỉ nên mở UI qua localhost/VPN/mạng tin cậy.
- [x] Bỏ `frontend/tsconfig.tsbuildinfo` khỏi Git tracking; file đã nằm trong `.gitignore`.
- [x] Tag release `v0.1.0` sau khi toàn bộ P0 pass.

## P1 — Sau v0.1: tạo khác biệt

Doctor và Release là nền tảng, không phải lợi thế duy nhất so với Portainer. Ưu tiên một hướng rõ ràng thay vì thêm Docker resource manager.

### Change Control & Recovery

- [ ] Change Plan: so sánh Compose đang chạy với cấu hình mới, cho biết service nào recreate, port/domain nào thay đổi, volume nào rủi ro và rollback có sẵn hay không.
- [ ] Recovery Capsule: export Compose snapshot, image digest, secret references và manifest volume backup để khôi phục application có kiểm soát.
- [ ] Safe Clone Environment: clone production sang staging/dev với port/domain mới và lựa chọn dữ liệu rỗng/sanitized/restore từ backup.

## Nguyên tắc sản phẩm

- ComposeHub quản lý **vòng đời application**, không cạnh tranh bằng màn hình quản lý container/image/network rời rạc như Portainer.
- Container Console chỉ thêm sau khi có auth hoặc UI giới hạn localhost/VPN; Docker socket + console gần tương đương quyền shell vào host.
- Mọi tính năng mới phải giữ Docker Compose là định dạng export được, không khóa người dùng vào DSL riêng.
