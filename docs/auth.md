# Xác thực & phân quyền (Chặng 2)

Code: `apps/api/src/auth/` · Hash mật khẩu: `apps/api/src/common/password.ts` · Test: `apps/api/test/auth.e2e-spec.ts`

## API

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/auth/login` | công khai | `{ identifier, password }` – tên đăng nhập hoặc email. Trả `{ user, accessToken }` |
| GET | `/auth/me` | đã đăng nhập | Thông tin người dùng đọc lại từ DB (FE gọi khi tải lại trang) |
| POST | `/auth/logout` | đã đăng nhập | Thu hồi **mọi** phiên của tài khoản |
| POST | `/auth/forgot-password` | công khai | `{ email }` – tạo OTP (chế độ demo: in trên console máy chủ) |
| POST | `/auth/reset-password` | công khai | `{ email, otp, newPassword }` |

Mã lỗi: **401** = chưa đăng nhập / token sai, hết hạn hoặc đã bị thu hồi / tài khoản bị khóa (khi đang dùng token);
**403** = đã đăng nhập nhưng không đủ quyền, hoặc đăng nhập vào tài khoản đang khóa / nhân viên đã thôi việc;
**400** = dữ liệu hoặc OTP không hợp lệ; **404** = email không có tài khoản (theo đặc tả QLHT);
**503** = quên mật khẩu khi chưa bật kênh gửi mã.

## Cách hoạt động

- **Mật khẩu**: scrypt (có sẵn trong Node) + salt ngẫu nhiên, lưu `scrypt$<salt>$<hash>` – cùng định dạng với seed.
- **Token**: JWT ký HS256 bằng `JWT_SECRET` (bắt buộc, ≥ 32 ký tự, không có giá trị mặc định trong code),
  hạn `JWT_EXPIRES_MINUTES` (mặc định 480 phút). Nội dung token chỉ gồm `sub` (mã tài khoản) và `ver`.
  Không có refresh token: hết hạn thì đăng nhập lại.
- **Guard toàn cục** (mọi route cần đăng nhập, trừ route `@Public()`):
  1. `AuthGuard` (401): kiểm tra chữ ký + hạn token, rồi **nạp lại tài khoản từ DB** ở mọi request.
     Từ chối nếu tài khoản không tồn tại, bị khóa, nhân viên đã thôi việc, hoặc `ver` ≠ `tai_khoan.phien_ban`.
  2. `RolesGuard` (403): so vai trò **lấy từ DB** với `@Roles(...)` của route. MANAGER luôn được phép.
     Route không gắn `@Roles` → mọi người đã đăng nhập đều dùng được.
  Vai trò, mã nhân viên… do FE gửi lên không bao giờ được dùng để phân quyền
  (ValidationPipe `whitelist` còn loại bỏ các trường thừa).

### Thu hồi phiên bằng `phien_ban`

Mỗi token ghi `ver` = `phien_ban` lúc đăng nhập. Tăng `phien_ban` ⇒ mọi token cũ của tài khoản bị từ chối
ngay ở request tiếp theo. `phien_ban` tăng khi:

| Sự kiện | Ghi chú |
|---|---|
| Đăng xuất | Đăng xuất một nơi = đăng xuất mọi thiết bị (chấp nhận cho demo) |
| Bị khóa do sai mật khẩu 5 lần | Khóa bởi Quản lý (Chặng 10) cũng sẽ tăng |
| Đặt lại mật khẩu qua OTP | |

Ngoài ra trạng thái `LOCKED` / nhân viên `RESIGNED` được kiểm tra trực tiếp ở mỗi request.

### Khóa tài khoản

- Sai mật khẩu liên tiếp → tăng `so_lan_sai_mat_khau` (cập nhật nguyên tử). Lần thứ **5** → `LOCKED` + thu hồi phiên.
- Đăng nhập thành công → bộ đếm về 0.
- Tài khoản khóa không đăng nhập được kể cả đúng mật khẩu, và không dùng được quên mật khẩu.

**Mở khóa:** Quản lý dùng trang *Quản lý hệ thống → Tài khoản* (`POST /system/accounts/:id/unlock`, Chặng 10).
Mở khóa đưa trạng thái về `ACTIVE` và xóa bộ đếm sai, **không** đổi `phien_ban` → token cấp trước khi khóa vẫn vô hiệu,
người dùng phải đăng nhập lại. Không mở khóa tài khoản của nhân viên đã thôi việc.

### Quản lý tài khoản (Chặng 10) – `/system/accounts`, chỉ MANAGER

| Thao tác | Endpoint | Thu hồi token cũ |
|---|---|---|
| Cấp tài khoản cho nhân viên có sẵn (chưa thôi việc, chưa có tài khoản) + mật khẩu khởi tạo | `POST /system/accounts` | – |
| Sửa tên đăng nhập / email khôi phục / vai trò | `PATCH /system/accounts/:id` | khi đổi vai trò |
| Khóa | `POST /system/accounts/:id/lock` | có |
| Mở khóa | `POST /system/accounts/:id/unlock` | không khôi phục phiên cũ |
| Đặt lại mật khẩu (xóa OTP, bộ đếm sai; không mở khóa) | `POST /system/accounts/:id/reset-password` | có |

- Vai trò tài khoản = bộ phận nhân viên: cấp/sửa tài khoản cập nhật `nhan_vien.bo_phan`; đổi bộ phận ở trang Nhân viên
  cập nhật `tai_khoan.vai_tro` và thu hồi token – cùng transaction.
- Không tự khóa, tự đổi vai trò / bộ phận, tự thôi việc. Thao tác làm một tài khoản mất quyền Quản lý hoạt động
  (khóa, đổi vai trò, thôi việc) khóa các dòng Quản lý (`FOR UPDATE`) rồi kiểm tra còn ít nhất một Quản lý khác → 409
  nếu không (`system/manager-guard.ts`); hai Quản lý hạ quyền nhau đồng thời → chỉ một thao tác thành công.
- Response không có hash mật khẩu, OTP, `phien_ban`. Không có API xóa tài khoản.

### Quên mật khẩu (OTP)

- OTP 6 chữ số từ `crypto.randomInt`, **chỉ lưu hash**, hạn **5 phút**, tối đa **5** lần nhập sai (quá thì hủy mã).
- Gửi lại mã ⇒ ghi đè, mã cũ hết hiệu lực. Dùng thành công ⇒ xóa mã (cập nhật có điều kiện, không dùng lại được
  kể cả 2 request đồng thời), đổi mật khẩu, thu hồi mọi phiên.
- **Chưa có dịch vụ email** (giới hạn demo): OTP chỉ được in ra console máy chủ khi `AUTH_DEMO_OTP_LOG=true`
  **và** `NODE_ENV` ≠ `production`. Không bật ⇒ API trả 503. FE hiển thị nguyên thông báo của backend,
  không ghi "đã gửi email".

## Frontend

- `config/api.ts`: `auth: false` → đăng nhập thật; các phân hệ khác vẫn Mock cho tới khi có API.
- Tải lại trang: có token thì gọi `/auth/me`; hợp lệ mới vào hệ thống. Không còn tự đăng nhập Quản lý.
- `http-client`: request có token mà nhận 401 ⇒ xóa token + phát sự kiện `mocbooks:session-expired`
  ⇒ `AuthContext` đặt `user = null`, AppShell hiện "Phiên đăng nhập đã kết thúc".
- Khi dùng auth thật: ẩn nút "Vai trò test", "Chuyển sang Quản lý", khối "Đăng nhập nhanh"; không điền sẵn mật khẩu.
  (Ở chế độ Mock các nút này vẫn hoạt động như cũ.)

## Biến môi trường

| Biến | Nơi đặt | Ghi chú |
|---|---|---|
| `JWT_SECRET` | `apps/api/.env` (chạy local), `.env` root (Docker Compose) | Bắt buộc ≥ 32 ký tự, tự sinh, không commit |
| `JWT_EXPIRES_MINUTES` | như trên | Mặc định 480 |
| `AUTH_DEMO_OTP_LOG` | `apps/api/.env` | `true` chỉ cho demo local |
