# Task còn thiếu để chốt v0.1

## Mục tiêu release

Chỉ đánh dấu **v0.1 — Single Host MVP** hoàn thành khi người dùng có thể tạo, sửa, xóa và triển khai một Docker Compose application qua UI; mọi luồng đều có kiểm tra port, trạng thái container và logs.

Các tính năng Safe Release và Blueprint hiện có là phần nâng cấp của MVP, không thay thế các tiêu chí cơ bản bên dưới.

## Dev01 — Application Builder hoàn chỉnh

### 1. Hoàn thiện Application CRUD

- [ ] Thêm `PATCH /api/applications/{id}` để sửa name, environment, description và services.
- [ ] Thêm `DELETE /api/applications/{id}` với xác nhận rõ ràng: chỉ xóa metadata/compose directory; không tự xóa volume Docker trong v0.1.
- [ ] Tạo UI **Chỉnh sửa Application** từ trang detail hoặc route riêng.
- [ ] Thêm nút **Xóa Application**, modal xác nhận và quay về Dashboard sau khi xóa.
- [ ] Viết test create → update → delete.

**Done khi:** sau khi sửa service, `compose.yaml` được cập nhật; app đã deploy có thể deploy lại revision mới; xóa app không còn xuất hiện ở Dashboard.

### 2. Hoàn thiện Manual Service Builder

- [ ] Cho nhập environment variables dạng key/value; bỏ dòng rỗng và báo key trùng.
- [ ] Cho thêm/xóa volume mount `source` → `target`.
- [ ] Validate volume target bắt đầu bằng `/`; cảnh báo bind mount host path.
- [ ] Hiển thị Compose preview trước khi tạo app.
- [ ] Giữ nguyên data khi quay lại chỉnh sửa app.

**Done khi:** tạo thủ công được app `web + postgres`, có environment và named volume; Compose preview khớp với data đã lưu.

### 3. Chuẩn hóa port validation cho Blueprint và Clone

- [ ] Dùng chung một service validate port cho manual create, blueprint create và update.
- [ ] Clone có public port phải buộc người dùng đổi host port, hoặc tạo clone ở trạng thái draft không thể Deploy.
- [ ] Trả lỗi 409 dễ hiểu, nêu rõ port nào đang bị dùng.

**Done khi:** không thể tạo/deploy hai application cùng một host port mà không có thông báo rõ ràng.

## Dev02 — Safe Release hardening và test runner

### 4. Test suite chạy được bằng một lệnh

- [ ] Thêm `backend/requirements-dev.txt` gồm `pytest` và `httpx`.
- [ ] Thêm lệnh test vào `Makefile` hoặc README: `make test` / `python -m pytest`.
- [ ] Tách test database sang SQLite tạm thời, không ghi vào `data/composehub.db`.
- [ ] Đảm bảo test không cần Docker daemon thật; mock `run_compose` và Docker client.

**Done khi:** cài dependencies theo tài liệu rồi chạy toàn bộ backend tests thành công bằng một lệnh.

### 5. Bổ sung test API Safe Release

- [ ] Deploy thành công tạo revision `success` và snapshot Compose.
- [ ] Doctor có Critical tạo revision `blocked` và API trả 422.
- [ ] Lỗi Docker tạo revision `failed` với output lỗi.
- [ ] Rollback chỉ nhận revision `success` của đúng application.
- [ ] Hai request Deploy/Rollback đồng thời: request sau nhận 409 thay vì Docker container-name conflict.

**Done khi:** các state `blocked`, `failed`, `success` và concurrency lock đều có test API.

## Cả hai — Release checklist

- [ ] Chạy backend test suite từ máy sạch theo tài liệu.
- [ ] Chạy `npm run build` trong `frontend`.
- [ ] Demo thực tế: tạo Nginx → Doctor → Deploy → Status/Logs → Stop.
- [ ] Demo thực tế: tạo `n8n + PostgreSQL` → Deploy → Release timeline → Rollback.
- [ ] Kiểm tra UI mobile cơ bản tại độ rộng 375px.
- [ ] Cập nhật `README.md` với test command và giới hạn bảo mật Docker socket.

## Ngoài v0.1

Không mở rộng scope sang Git deploy, authentication/RBAC, reverse proxy/SSL, multi-server, backup/restore hoặc monitoring lịch sử trước khi các checkbox v0.1 hoàn thành.
