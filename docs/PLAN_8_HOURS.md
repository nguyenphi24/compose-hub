# Kế hoạch 8 giờ

## Mục tiêu cuối ngày

Có một sản phẩm chạy được với luồng:

```text
Tạo Application
→ thêm Service
→ sinh compose.yaml
→ kiểm tra port
→ deploy
→ xem trạng thái
→ xem log
→ stop
```

## Phân chia hai người

### Người A — Backend / Docker

Phụ trách:

- FastAPI
- SQLite
- Data model
- Compose generator
- Port conflict validation
- Deploy / stop
- Docker status
- Logs
- Test backend cơ bản

### Người B — Frontend / UX

Phụ trách:

- Dashboard
- Form tạo application
- Form thêm service
- Trang chi tiết application
- Hiển thị compose.yaml
- Nút deploy / stop
- Bảng container
- Log viewer
- Chuẩn bị demo và screenshot

## Timeline

### Giờ 0–1: Chốt scope và chạy skeleton

**Cả hai**

- Clone repo.
- Chạy backend và frontend.
- Kiểm tra `/api/health`.
- Không thay đổi kiến trúc.
- Chốt duy nhất single-server MVP.

Kết quả:

- Frontend gọi được backend.
- Docker host hiển thị online/offline.

### Giờ 1–3: Tạo Application

**Người A**

- Hoàn thiện model.
- API tạo/list/detail application.
- Sinh compose YAML.
- Validate host port.

**Người B**

- Dashboard.
- Form tạo application.
- Component thêm/xóa service.
- Điều hướng sang trang detail sau khi tạo.

Kết quả:

- Tạo được application bằng UI.
- Xem được compose YAML.

### Giờ 3–5: Deploy thật

**Người A**

- Deploy bằng `docker compose up -d`.
- Stop bằng `docker compose down`.
- Lấy trạng thái container.
- Lấy logs.

**Người B**

- Nút Deploy/Stop.
- Loading và error state.
- Bảng trạng thái container.
- Log viewer.

Kết quả:

- Deploy được `nginx:alpine`.
- Truy cập được host port.

### Giờ 5–6: Port conflict và độ ổn định

**Người A**

- Kiểm tra port đã bị Docker container khác chiếm.
- Chuẩn hóa lỗi trả về.
- Thêm test compose generator.

**Người B**

- Hiển thị lỗi port rõ ràng.
- Thêm refresh status/log.
- Chỉnh UX form.

Kết quả:

- Không deploy nhầm port.
- Lỗi dễ hiểu.

### Giờ 6–7: Hoàn thiện demo

**Cả hai**

- Test lại trên máy demo.
- Tạo application mẫu.
- Chuẩn bị script demo 3 phút.
- Chụp screenshot.
- Viết issue/roadmap.

### Giờ 7–8: Buffer

Chỉ sửa lỗi ảnh hưởng demo.

Không thêm:

- Multi-server
- Login phức tạp
- Reverse proxy
- SSL
- Backup
- AI feature
- Monitoring chart

## Kịch bản demo 3 phút

1. Nêu pain point: một server nhiều app, thường xuyên phải SSH.
2. Dashboard cho thấy Docker host.
3. Tạo `demo-blog`.
4. Thêm `nginx:alpine`, port `8088:80`.
5. ComposeHub sinh compose.yaml.
6. Bấm Deploy.
7. Mở `localhost:8088`.
8. Quay lại xem container và logs.
9. Thử tạo app khác dùng port `8088` để demo cảnh báo conflict.
10. Kết thúc bằng roadmap multi-server Agent.

## Tiêu chí hoàn thành

- [ ] Repo chạy được theo README.
- [ ] Tạo application không cần SSH.
- [ ] Sinh compose hợp lệ.
- [ ] Deploy nginx thành công.
- [ ] Xem được log.
- [ ] Stop được application.
- [ ] Cảnh báo port conflict.
- [ ] Có README và roadmap.
