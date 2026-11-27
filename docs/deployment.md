# Triển khai bằng Docker Compose

Các bước dưới đây đã được chạy thử trên một môi trường riêng (xem [final-verification.md](final-verification.md)).

## Thành phần

| Service | Image / build | Cổng trong container | Cổng host (biến) |
|---|---|---|---|
| `postgres` | `postgres:17-alpine`, volume `<project>_postgres_data` | 5432 | `POSTGRES_PORT` |
| `api` | `apps/api/Dockerfile` | 3001 (cố định) | `API_PORT` |
| `web` | `apps/web/Dockerfile` (Next.js standalone) | 3000 | `WEB_PORT` |

Thứ tự khởi động: `postgres` healthy → `api` chạy `prisma migrate deploy` rồi mới `node dist/main.js` → `api`
healthy (`GET /health` trả 200; mất DB trả 503) → `web`.

## Chạy lần đầu

```powershell
Copy-Item .env.example .env          # rồi điền JWT_SECRET (>= 32 ký tự), sửa cổng nếu trùng
docker compose up -d --build
docker compose ps                    # api: (healthy)
docker compose exec api npx prisma db seed
```

- **Migration**: tự chạy mỗi lần container API khởi động, chỉ áp migration còn thiếu (`No pending migrations`
  nếu không có gì mới). Lỗi kết nối / migration lỗi → container thoát mã ≠ 0, API không phục vụ.
- **Seed**: chỉ chạy tay. Seed dùng `INSERT … ON CONFLICT DO NOTHING` nên chạy lại không ghi đè dữ liệu đang có.
- **URL API của trình duyệt**: `NEXT_PUBLIC_API_URL` được nhúng vào bản build web. Phải là địa chỉ trình duyệt
  truy cập được (vd `http://localhost:3001`), không phải `http://api:3001`. Đổi giá trị → `up -d --build`.
- **JWT_SECRET** thiếu hoặc ngắn → API dừng ngay khi khởi động với thông báo rõ.
- **OTP quên mật khẩu**: container chạy `NODE_ENV=production` nên không in OTP; chức năng trả thông báo
  "chưa cấu hình kênh gửi mã". OTP qua console chỉ dùng khi chạy API local với `AUTH_DEMO_OTP_LOG=true`.

## Dừng / chạy lại

```powershell
docker compose stop                  # dừng, giữ dữ liệu
docker compose up -d                 # chạy lại (thêm --build nếu code thay đổi)
docker compose logs -f api           # xem log API (migrate, lỗi)
```

Dữ liệu nằm trong volume và còn nguyên sau `stop` / `up --build`.
**`docker compose down -v` xóa volume = mất toàn bộ dữ liệu** – chỉ dùng khi chủ động làm lại từ đầu.

## Chạy môi trường thứ hai song song (vd để thử, không ảnh hưởng bản demo)

Tạo một file env riêng (ngoài repo) với `CONTAINER_PREFIX`, `POSTGRES_PORT`, `API_PORT`, `WEB_PORT`,
`NEXT_PUBLIC_API_URL`, `JWT_SECRET` khác, rồi dùng tên project khác:

```powershell
docker compose -p ooad_bookstore_verify --env-file <đường-dẫn>\verify.env up -d --build
docker compose -p ooad_bookstore_verify --env-file <đường-dẫn>\verify.env exec api npx prisma db seed
# Dọn môi trường thử (CHỈ project này):
docker compose -p ooad_bookstore_verify --env-file <đường-dẫn>\verify.env down -v
```

Project, container, network và volume đều mang tên riêng nên không đụng tới bản demo (`ooad_bookstore`).

## Sự cố thường gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| `port is already allocated` | Cổng host đã bị dùng (vd PostgreSQL cài sẵn ở 5432) → đổi `*_PORT` trong `.env`. |
| API restart liên tục, log báo `JWT_SECRET` | Chưa điền `JWT_SECRET` trong `.env` root. |
| API dừng, log `P1000` / `P1001` | Sai tài khoản DB hoặc Postgres chưa sẵn sàng – kiểm tra `POSTGRES_*`. |
| Web mở được nhưng báo "Không kết nối được máy chủ" | `NEXT_PUBLIC_API_URL` không trỏ đúng cổng host của API → sửa và build lại web. |
