# Kiểm tra cuối (Chặng 11) – 27/11/2026

Phạm vi: rà code FE + BE, sửa lỗi thực tế, chạy luồng nghiệp vụ xuyên suốt trên API thật, Docker trên môi trường
mới riêng. Không kết luận "không còn lỗi" – phần chưa kiểm chứng ghi ở cuối.

## Môi trường kiểm tra

- Compose project riêng `ooad_bookstore_verify` (container `ooad_bookstore_verify_*`, volume và network riêng),
  cổng 5544 / 3201 / 3200, `JWT_SECRET` và mật khẩu DB sinh ngẫu nhiên trong file env ngoài repo.
- Không dừng / xóa môi trường demo `ooad_bookstore` (Postgres 5433) và các project Docker khác.
  DB demo được chụp số liệu trước/sau: giữ nguyên (7 sách, 4 hóa đơn, 1 phiếu đổi/trả, 4 tài khoản,
  TK001 `ACTIVE`, `phien_ban` không đổi).
- Môi trường verify đã gỡ sau khi kiểm tra (`down -v` đúng project này + xóa 2 image đã build cho nó).

## Kết quả lịch sử – trước đợt sửa 4 lỗi reviewer

| Kiểm tra | Kết quả |
|---|---|
| API: `tsc --noEmit`, oxlint, `nest build` | Đạt |
| API unit test | 62/62 |
| API e2e (11 file) – chạy trên DB verify, không phải DB demo | 157/157 |
| Web: `tsc --noEmit`, eslint, `next build` | Đạt |
| Docker build 3 image + `up` trên DB mới | Đạt; migration 6/6 áp theo thứ tự trước khi API chạy |
| Seed tay (`docker compose exec api npx prisma db seed`), chạy lại lần 2 | Đạt, không ghi đè |
| Migrate lỗi (sai mật khẩu DB) | Container API thoát mã 1 (`P1000`), không khởi động |
| Thiếu `JWT_SECRET` | API thoát mã 1, thông báo rõ |
| Mất DB khi đang chạy | `/health` trả 503 (unhealthy), tự về 200 khi DB lên lại |
| URL API nhúng trong bundle web | Đúng `http://localhost:3201` (cổng host), CORS cho phép |
| Luồng nghiệp vụ xuyên suốt qua API (script) | 54/54 kiểm tra đạt |
| Dừng toàn bộ stack → build lại → chạy lại, đối chiếu số liệu | 13/13 đạt, `No pending migrations` |

### Luồng nghiệp vụ đã chạy (số tính tay)

Danh mục + 2 sách (tồn 0) + NCC + khách → **nhập** 10×50.000 + 5×30.000 = 650.000, trả trước 200.000
(nợ 450.000, PARTIAL) → **trả nợ** 450.000 (PAID; 2 phiếu chi) → **bán** 3 cuốn × 100.000 − voucher 20.000 = 280.000
(khách +28 điểm) → **trả** 1 cuốn: hoàn 93.333 → **đổi** 1 cuốn sang sách 60.000: hoàn 33.333
(điểm còn 15, chi tiêu 153.334) → **kiểm kê** 9 → 8 → **báo cáo** hôm nay: doanh thu thuần 153.334,
giá vốn thuần 150.000 − 100.000 + 30.000 = 80.000, lợi nhuận gộp 73.334; bán chạy: sách 1 thuần 1 (93.334),
sách 2 thuần 1 (60.000).

Kèm theo: bấm lặp đồng thời (phiếu nhập, phiếu chi, hóa đơn → mỗi loại đúng 1 chứng từ), dữ liệu sai (giá bán 0,
trả trước vượt tổng, trả vượt nợ, trả 0, bán vượt tồn, trả vượt số đã mua, kiểm kê với tồn cũ → 409, thiếu lý do),
sai quyền (SALES tạo sách / phiếu nhập / voucher / xem báo cáo / nhân viên, WAREHOUSE xem hóa đơn → 403),
phiên (không token, token bị sửa, token hết hạn có chữ ký đúng, token sau đăng xuất → 401).

## Lỗi tìm thấy và đã sửa trong chặng

| # | Vị trí | Lỗi | Sửa |
|---|---|---|---|
| 1 | `apps/api/Dockerfile` | Container không chạy migration – DB mới không có bảng | CMD chạy `prisma migrate deploy && node dist/main.js` |
| 2 | `docker-compose.yml` | `PORT` trong container = `API_PORT` nhưng cổng map cố định `:3001` → đổi `API_PORT` là hỏng | `PORT` cố định 3001 |
| 3 | `docker-compose.yml` | `container_name` cố định → không chạy được môi trường thứ hai | `${CONTAINER_PREFIX:-ooad_bookstore}_…` (bản demo giữ tên cũ) |
| 4 | `apps/api/.dockerignore` | `tsbuildinfo` lọt vào build context (rủi ro tsc bỏ qua emit) | Loại `*.tsbuildinfo`, `test` |
| 5 | `health.controller.ts` | Mất DB vẫn trả 200 + chuỗi lỗi DB → healthcheck vẫn "healthy" | 503, không trả chi tiết lỗi; unit test hồi quy |
| 6 | `lib/http-client.ts` | Mất kết nối / quá thời gian → lỗi gốc tiếng Anh ("Failed to fetch") | `ApiError` status 0, thông báo tiếng Việt; quá thời gian nhắc kiểm tra trước khi thử lại |
| 7 | 10 trang FE | Tải dữ liệu lúc mở trang không bắt lỗi → bảng trống im lặng | Hiện thông báo lỗi |
| 8 | Form kiểm kê | Xóa ô "thực tế" = 0 → có thể vô tình đưa tồn về 0 | Ô trống bị chặn khi lưu; 0 nhập rõ vẫn hợp lệ |
| 9 | Form nhập hàng | Số lượng/giá ≤ 0, tiền trả ≤ 0 → nút không phản hồi, không báo | Báo lỗi rõ; kiểm tra không vượt nợ |
| 10 | Form sách, CTKM/voucher, nhân viên | Ô số không xóa trống được; thiếu khóa nút khi đang gửi | Ô số cho phép trống (báo thiếu khi lưu), khóa nút khi gửi |
| 11 | Form danh mục | Bấm lặp tạo 2 tác giả / NXB (mã tự sinh) | Khóa khi đang gửi |
| 12 | Biểu đồ báo cáo | Số âm bị vẽ thành 0 | Đường mốc 0, cột âm vẽ xuống dưới |
| 13 | Sidebar / login / hóa đơn / tệp xuất | Lẫn "Mộc Books", dropdown 2 chi nhánh giả | Thống nhất "Nhà sách bé bi – Chi nhánh trung tâm"; bỏ dropdown; tệp xuất có tiền tố `nha-sach-be-bi_` |
| 14 | AppShell | Dòng "Đang chạy chế độ dữ liệu Mock…", nút "Khôi phục dữ liệu mẫu" luôn hiện | Chỉ hiện khi còn module chạy Mock |
| 15 | README, `docs/deployment.md`, `.env.example` | README UTF-16, hướng dẫn thiếu JWT/seed/migrate, biến `API_INTERNAL_URL` không dùng | Viết lại UTF-8 theo cách đã kiểm chứng |
| 16 | In hóa đơn (POS, chi tiết hóa đơn) | Drawer/Modal có `no-print` → bản in ra trang danh sách nền thay vì hóa đơn; không gợi ý tên tệp | `components/invoice/InvoiceReceipt.tsx`: bản in riêng gắn vào `<body>`, CSS chỉ in hóa đơn; tiêu đề in `nha-sach-be-bi_<mã HĐ>`, khôi phục khi `afterprint` |

## Đợt sửa 4 lỗi reviewer và xác nhận bản ZIP – 27/11/2026

Phạm vi đợt này chỉ gồm 4 mục reviewer nêu; giữ nguyên các thay đổi trước đó và dữ liệu DB demo.

| Mức | Lỗi | Sửa và test hồi quy |
|---|---|---|
| P1 | Login kiểm tra hash cũ nhưng có thể ký token với phiên bản mới sau reset đồng thời | UPDATE có điều kiện theo hash/version/trạng thái đã kiểm chứng; chỉ ký version đã xác thực. `auth.service.spec.ts` kiểm tra interleaving và AuthGuard từ chối token cũ. |
| P1 | Giá sách đổi thay đổi sau preview nhưng POST vẫn ghi số tiền mới | FE gửi `expectedRefundAmount` / `expectedExtraPayment`; backend tự tính rồi đối chiếu, lệch trả 409 trước khi ghi phiếu/tồn/điểm. Replay requestKey vẫn trả phiếu đã lưu. `returns.service.spec.ts` kiểm tra giá 35.000 → 50.000, không ghi khi lệch, replay và validation; fixture E2E được cập nhật. |
| P2 | POS không retry được giao dịch chưa rõ kết quả khi preview mới hết tồn/hết lượt voucher | Giữ payload/requestKey đã gửi; nút khôi phục không phụ thuộc preview mới; khóa sửa/xóa đơn chưa rõ kết quả. Harness FE kiểm tra timeout, preview invalid và gửi lại đúng payload. |
| P2 | Báo cáo tồn kho/công nợ nuốt lỗi, cho xuất CSV rỗng | Tải hai nguồn độc lập với loading/error; chặn CSV cho nguồn chưa tải thành công. Harness FE kiểm tra lỗi từng API, chặn xuất và nguồn còn lại vẫn dùng được. |

| Kiểm tra bản sửa mới | Kết quả |
|---|---|
| `apps/api`: `npm test -- --reporter=dot` (unit + harness FE, 14 file) | **75/75 đạt** |
| API: `npx tsc --noEmit -p tsconfig.json`, `npm run lint`, `npm run build` | Đạt |
| Web: `npx tsc --noEmit`, `npm run lint`, `npm run build` | Đạt |
| Reviewer chạy lại các kiểm tra trên từ bản ZIP | Người dùng xác nhận: 75/75 test và type-check/lint/build API/web đều đạt |
| E2E trên DB riêng của bản sửa mới | **Chưa kiểm chứng**; 157/157 phía trên là kết quả lịch sử |
| Thao tác browser thực tế của bản sửa mới | **Chưa kiểm chứng**; harness chỉ kiểm tra state/handler, không thay thế browser/React scheduling/layout |

Lượt chốt repo sau xác nhận reviewer chỉ chuyển gói review ra ngoài repo, dọn cache/file tạm đã xác định và cập nhật
tài liệu; không chạy lại toàn bộ test. Giữ source, test/harness, migrations, seed, fixture/cleanup SQL, `.env` thật và DB demo.
Giữ việc bỏ `apps/api/tsconfig.build.tsbuildinfo` khỏi Git; gói review và build output không thuộc commit.

## Chưa kiểm chứng / còn lại

- **Giao diện trên trình duyệt**: phiên làm việc không có công cụ điều khiển trình duyệt – mọi kiểm tra FE ở trên là
  type-check / lint / build và gọi API; thao tác giao diện cần người dùng thử theo cụm bước trong báo cáo Chặng 11.
- Ghi chú hóa đơn seed `HD-2611-1042` và email nhân viên seed vẫn chứa "Mộc Books" / `@mocbooks.vn` (dữ liệu seed,
  không đổi theo quy ước giữ seed).
- Tên tệp gợi ý khi in: Chrome/Edge "Lưu dưới dạng PDF" lấy theo tiêu đề tài liệu (`nha-sach-be-bi_<mã HĐ>`).
  Driver Windows "Microsoft Print to PDF" tự mở hộp lưu riêng và có thể không điền tên gợi ý – giới hạn của driver,
  chưa kiểm chứng tay. Bản in đã kiểm chứng bằng Chrome headless (CDP) trên bản build production.
- Turbopack giữ CSS cũ trong cache sau khi sửa `globals.css` (cả `next dev` lẫn `next build`) → sau khi kéo code mới,
  nếu CSS không đổi: dừng dev server, xóa `apps/web/.next` rồi chạy lại.
- `GET /` của API vẫn trả "Hello World!" (endpoint mẫu của NestJS, không ảnh hưởng nghiệp vụ).
- Không kiểm thử tải / nhiều người dùng đồng thời ngoài các test tranh chấp đã nêu.
