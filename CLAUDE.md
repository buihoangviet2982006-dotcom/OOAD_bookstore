# CLAUDE.md – OOAD Bookstore

Đồ án môn Phân tích thiết kế hướng đối tượng: phần mềm quản lý nhà sách.
Phần code phục vụ demo: chạy ổn định, đúng nghiệp vụ nhóm đã thiết kế, tích hợp được
frontend, dễ đọc, đủ đơn giản để sinh viên hiểu, bảo trì và vấn đáp.

Hướng dẫn riêng của từng app vẫn giữ nguyên: `apps/api/CLAUDE.md` → `apps/api/AGENTS.md`,
`apps/web/AGENTS.md`. Nếu chúng mâu thuẫn với file này thì theo file này
(ví dụ: **không** link NestJS Observe/telemetry như `apps/api/AGENTS.md` gợi ý).

## Điểm dừng hiện tại (cập nhật 2026-11-27)

- Branch `feature/backend` (tạo từ `origin/frontend`). Người dùng đã yêu cầu chốt toàn bộ phần hoàn thành,
  commit và push branch này sau khi reviewer xác nhận bản ZIP; không force push / merge.
- Chặng 0–10: người dùng đã kiểm tra FE và cleanup xong.
- **Chặng 11 (hoàn thiện & rà soát):** xong phần code, Docker trên môi trường riêng, luồng API xuyên suốt, test
  Lịch sử trước đợt sửa reviewer: unit 62/62, e2e 157/157 trên DB riêng, lint/build API & web đạt.
  Kết quả + lỗi đã sửa: `docs/final-verification.md`.
- **Đợt sửa 4 lỗi reviewer:** đã sửa race login/reset mật khẩu; xác nhận lại tiền đổi sách khi lệch preview;
  POS khôi phục request chưa rõ kết quả bằng payload/requestKey cũ; báo cáo tồn kho/công nợ hiện lỗi và chặn CSV khi chưa tải được.
  Unit test + harness FE **75/75 đạt**; type-check, lint, build API/web đạt. Reviewer đã kiểm tra lại bản ZIP và xác nhận
  các kết quả này. Test/harness mới và fixture E2E cập nhật được giữ trong source.
- **Chưa kiểm chứng trên bản sửa mới:** E2E trên DB riêng và thao tác browser thực tế. Kết quả E2E 157/157 ở trên
  là lịch sử trước đợt sửa, không dùng để khẳng định E2E của bản mới đã đạt.
- Gói review ZIP/hash/diff được chuyển ra ngoài repo khi chốt. Lượt chốt chỉ dọn file đã xác định và cập nhật tài liệu,
  không chạy lại toàn bộ test, không sửa `.env` thật hoặc dữ liệu DB demo.
- FE dùng API thật cho mọi module.
- Môi trường: Postgres Docker `ooad_bookstore_postgres` ở port 5433 (đang chạy); API thường được người dùng chạy
  watch ở port 3001.

## Cách làm việc

- Trao đổi tiếng Việt, ngắn gọn, giữ thuật ngữ kỹ thuật tiếng Anh.
- Chia chặng nhỏ, mỗi chặng có kết quả kiểm tra rõ ràng; dừng sau mỗi chặng để review.
- Tự xử lý lựa chọn kỹ thuật thông thường; hỏi khi thiếu quyết định nghiệp vụ hoặc đổi phạm vi.
- Cần người dùng chạy lệnh: mỗi lần một cụm lệnh ngắn, Windows PowerShell, rồi chờ kết quả.
- Không tự commit / push / merge. Không tự reset Database. Không ghi secret thật vào Git.
- Không tự đăng ký dịch vụ cloud, telemetry, không nâng cấp framework.
- Báo đúng lệnh đã chạy, kết quả và phần chưa kiểm chứng.

## Nguồn đối chiếu (theo thứ tự ưu tiên)

1. Yêu cầu và quyết định mới nhất người dùng xác nhận (mục "Phạm vi demo" bên dưới).
2. Tài liệu nhóm: **bộ Đặc tả Use Case + Relational data model là cơ sở triển khai**; vẫn đối chiếu
   Class / Activity / Sequence / State diagram. Ngày sửa file không đủ chứng minh bản chuẩn.
   Tài liệu nằm ngoài repo (ZIP nhóm cung cấp); **không đưa vào Git, không sửa tài liệu để hợp thức hóa code**.
3. Code frontend: `apps/web/src/types/index.ts`, `config/api.ts`, `lib/http-client.ts`, `services/`, `mocks/`, các trang.

Khi các nguồn mâu thuẫn: chỉ rõ file + nội dung, đề xuất cách đơn giản nhất, hỏi quyết định,
rồi ghi vào mục "Giới hạn demo".

## Kiến trúc & quy ước

- Monorepo: `apps/web` (Next.js 16), `apps/api` (NestJS 12 ESM + Prisma 7 + `@prisma/adapter-pg`), PostgreSQL 17 qua Docker Compose.
- Kiểm tra `package.json`, lockfile và code thực tế trước khi áp dụng hướng dẫn từ template/trí nhớ.
  `apps/api` là ESM: import tương đối có đuôi `.js`; test bằng Vitest (`vi.fn()`).
- Tổ chức theo nghiệp vụ: Module / Controller / Service / DTO. Không microservices, CQRS, event bus,
  Redis, queue, generic repository hay hạ tầng thừa.
- API response bám đúng types FE (mảng trực tiếp, `id` string, các trường join sẵn như `categoryName`);
  được mapping trong backend, không ép schema DB giống response.
- Backend tự kiểm tra dữ liệu, quyền và **tự tính** giá trị nghiệp vụ (tổng tiền, chiết khấu, tồn kho,
  công nợ, người thao tác lấy từ phiên đăng nhập) – không tin số FE gửi.
- Không chép xử lý giản lược của Mock thành nghiệp vụ thật.
- Transaction cho các cập nhật phải thành công cùng nhau: hóa đơn + tồn kho + điểm + voucher;
  phiếu nhập + tồn kho + công nợ; đổi/trả; kiểm kê.
- Lỗi trả về dạng `{ message }` dễ hiểu (FE đọc trường `message`).
- Sửa FE chỉ khi cần tích hợp: nêu file + lý do, giữ giao diện hiện có. Chuyển Mock → API theo từng
  module qua `MODULE_MOCK_OVERRIDES` trong `apps/web/src/config/api.ts`; không tắt Mock toàn bộ khi backend chưa đủ.
- Không dùng nút đổi vai trò / mock token thay xác thực thật.
- Migration + seed demo; build/lint và test vừa đủ cho phần thay đổi (ưu tiên luồng chính và lỗi nghiệp vụ:
  thiếu tồn, số lượng không hợp lệ, trả vượt số còn lại, thanh toán NCC vượt nợ, sai quyền).

## Dữ liệu thử (bắt buộc)

- Dữ liệu tạo ra để kiểm tra phải có **mã nhận diện riêng** (vd tiền tố `E2E`, `E2C`, `E2P`… cho test tự động,
  `TEST…` cho thử thủ công), ghi lại các bản ghi đã tạo và **dọn sau khi kiểm tra**.
- Chỉ xóa đúng dữ liệu thử đã xác định (theo mã/tiền tố); giữ nguyên seed và dữ liệu nhóm.
  Nếu buộc phải sửa tạm dữ liệu seed để thử, ghi lại giá trị cũ và trả về sau khi thử.
- Hướng dẫn kiểm tra thủ công luôn kèm bước dọn dữ liệu.
- Test tự động (e2e) giữ trong code; mỗi file e2e dùng tiền tố riêng, tự dọn trong `beforeAll`/`afterAll`.

## Phạm vi demo đã chốt (review ngày 2026-11-27)

| # | Chủ đề | Quyết định |
|---|---|---|
| 1 | Tài liệu chuẩn | Đặc tả + RDM là cơ sở; mâu thuẫn với các sơ đồ khác phải ghi lại. |
| 2 | Phân quyền | RBAC cố định 3 role `MANAGER`, `SALES`, `WAREHOUSE` (MANAGER được mọi chức năng). Ma trận quyền **chỉ xem**, bỏ nút lưu/chỉnh. |
| 3 | Quên mật khẩu | OTP in ra console server – chỉ ở môi trường demo; có hạn dùng, dùng một lần. FE **không** được báo "đã gửi email". |
| 4 | Backup/Restore | Backup = xuất JSON. Restore **chưa triển khai** → vô hiệu hóa trên FE và ghi rõ; không giữ Mock báo phục hồi thành công. |
| 5 | Khuyến mãi | Mô hình theo FE (PERCENT/FIXED, giảm tối đa, đơn tối thiểu, phạm vi toàn cửa hàng hoặc 1 thể loại; voucher độc lập). Tối đa 1 CTKM + 1 voucher / hóa đơn. Số tiền xem trước trên FE phải khớp backend. |
| 6 | Điểm / hạng KH | Quy tắc FE: 1 điểm / 10.000đ thực trả; hạng theo tổng chi tiêu ≥1.200.000 SILVER, ≥3.500.000 GOLD, ≥8.000.000 DIAMOND. Backend tự tính, bỏ qua `tier` FE gửi. Đổi/trả điều chỉnh theo giá trị thực tế, không trừ điểm lặp. |
| 7 | Đổi / trả | Hoàn theo giá thực bán (đã phân bổ chiết khấu từng dòng); kiểm tra số lượng còn được trả. Hạn **7 ngày** là quy tắc chọn cho demo. |
| 8 | Nhập hàng / công nợ | Thêm hạn thanh toán cho phiếu nhập. **Bắt buộc chọn phiếu nhập** khi thanh toán NCC (sửa FE tối thiểu); không phân bổ FIFO. Không vượt số nợ còn lại. |
| 9 | Sách | Một tác giả / sách; cảnh báo theo tồn tối thiểu. Sách ngừng kinh doanh giữ trạng thái `DISCONTINUED` dù tồn = 0; `OUT_OF_STOCK` suy ra từ tồn kho. |
| 10 | Kiểm kê | Một phiếu áp dụng ngay; chống áp dụng một phiếu nhiều lần; từ chối nếu tồn kho đã thay đổi kể từ lúc mở form (so `systemStock`). Dòng chênh lệch bắt buộc có lý do. |
| 11 | Tài khoản | Tài khoản gắn nhân viên có thật + mật khẩu khởi tạo. Kiểm tra phiên/quyền phía server (tài khoản bị khóa bị từ chối ngay ở request tiếp theo). Khóa sau nhiều lần sai mật khẩu; Manager mở khóa được. |
| 12 | Giá vốn | Lưu giá vốn tại thời điểm bán trên từng dòng hóa đơn. Báo cáo xử lý đổi/trả nhất quán với cách tính doanh thu. |

### Chốt bổ sung (sau Chặng 0)

- **#5 Thứ tự tính khuyến mãi:** CTKM tính trước trên các dòng đủ điều kiện; voucher tính sau trên phần còn lại;
  tổng giảm ≤ tổng tiền hàng. Có endpoint preview cho FE; khi hoàn tất hóa đơn backend kiểm tra và tính lại,
  không tin preview cũ. Cách xét đơn tối thiểu và phân bổ chiết khấu từng dòng: `docs/database.md` › Quy tắc tính tiền.
- **#12 Doanh thu thuần trong kỳ** = Σ hóa đơn hoàn tất trong kỳ (thanh toán cuối) + tiền khách bù khi đổi trong kỳ
  − tiền hoàn khách khi đổi/trả trong kỳ. Không lấy tiền khách đưa làm doanh thu. Khoản đổi/trả ghi riêng trên
  phiếu đổi/trả để không cộng/trừ hai lần. Giá vốn/lợi nhuận đối chiếu tiếp ở chặng báo cáo.

### Chốt bổ sung (sau Chặng 1)

- CTKM: giữ "Tạm dừng / Tiếp tục" theo FE, phân biệt `PAUSED` với `CANCELLED` (hủy/ngưng là trạng thái cuối).
  Schema hiện chỉ có `da_ngung` → bổ sung migration ở **Chặng 5**.
- Seed giữ khách hàng hạng STANDARD, không thêm hóa đơn để nâng hạng.
- Mã chứng từ nghiệp vụ mới (HD, PN, …): chốt khi làm các phân hệ tương ứng.
- Không xử lý install scripts bị npm chặn (prisma, @prisma/engines) khi chưa có lỗi thực tế.

Schema, điểm khác RDM, điều chỉnh seed: `docs/database.md`. Xác thực & thu hồi phiên: `docs/auth.md`.

## Quy ước Auth (Chặng 2)

- Mọi route mặc định cần đăng nhập; route công khai gắn `@Public()`. Giới hạn vai trò bằng `@Roles(...)`
  (MANAGER luôn được phép). Lấy người thao tác bằng `@CurrentUser()` – không dùng id/role do FE gửi.
- 401 = chưa xác thực / phiên không còn hợp lệ; 403 = không đủ quyền.
- Thu hồi phiên: tăng `tai_khoan.phien_ban` (khi khóa tài khoản, đổi/đặt lại mật khẩu, đăng xuất).
- Mở khóa tài khoản trước khi có API quản trị: xem `docs/auth.md`.

## Quy ước Danh mục & Sách (Chặng 3)

- Đọc (`GET /books`, `/categories`, `/authors`, `/publishers`): mọi người đã đăng nhập (SALES cần cho POS).
  Ghi: `@Roles('WAREHOUSE')` (+ MANAGER).
- Mã (id) là khóa chính, không đổi sau khi tạo: thể loại do người dùng nhập; tác giả `TGxxx`, NXB `NXBxxx` tự sinh;
  sách dùng SKU người dùng nhập.
- **Tồn kho không sửa qua CRUD sách**: sách mới tồn 0; chỉ thay đổi qua phiếu nhập, hóa đơn, đổi/trả, kiểm kê.
- Trạng thái sách lưu ACTIVE/DISCONTINUED; `OUT_OF_STOCK` suy ra (`books/book.mapper.ts › bookStatus`).
- Xóa sách: đã có giao dịch hoặc còn tồn → chuyển DISCONTINUED (giữ lịch sử); ngược lại xóa hẳn.
  Xóa thể loại/tác giả/NXB đang có sách (hoặc thể loại đang dùng trong CTKM) → 409.
- Lỗi Prisma còn sót (trùng, khóa ngoại, không tìm thấy) được `PrismaExceptionFilter` đổi sang 409/404.

## Quy ước Khách hàng, NCC, Nhân viên (Chặng 4)

- Quyền: `/customers` SALES (+MANAGER); `/suppliers` WAREHOUSE (+MANAGER); `/employees` chỉ MANAGER (kể cả đọc –
  có lương, thông tin nhân sự).
- Mã tự sinh: `KHxxx`, `NCCxxx`, `NVxxx`. SĐT lưu dạng chữ số liền; khách hàng & nhân viên 10 số, NCC 10–11 số.
  Trùng SĐT (KH, NCC, NV), email (NV), mã số thuế (NCC) → 409.
- Chỉ số **không nhận từ payload**, luôn tính lại: khách hàng (tổng chi tiêu = Σ thanh toán cuối + bù − hoàn,
  số đơn, lần mua cuối, hạng – `customers/loyalty.ts`); NCC (tổng nhập, công nợ, hạn sớm nhất – từ phiếu nhập).
  Điểm tích lũy đọc cột `diem_tich_luy`, chỉ nghiệp vụ bán hàng/đổi trả được cập nhật.
- Khách hàng đã có hóa đơn → **chặn xóa** (409). Cột `khach_hang.dang_hoat_dong` có trong schema nhưng
  **chưa dùng** (chưa có thiết kế vô hiệu hóa).
- NCC: không có API xóa; ngừng hợp tác = `INACTIVE`, giữ lịch sử & công nợ.
- Nhân viên: có tài khoản hoặc chứng từ → "xóa" = chuyển `RESIGNED`. Chuyển `RESIGNED` (qua sửa hoặc xóa)
  khóa tài khoản + tăng `phien_ban` trong cùng transaction. Quay lại `WORKING` **không** tự mở khóa tài khoản.
  Quản lý không tự xóa / tự cho mình thôi việc.
- `nhan_vien.bo_phan` (FE: `role`) là bộ phận; quyền đăng nhập theo `tai_khoan.vai_tro` – từ Chặng 10 luôn đồng bộ
  hai chiều trong cùng transaction (đổi bộ phận → đổi vai trò + thu hồi token).

## Quy ước Khuyến mãi & Voucher (Chặng 5)

- Quyền: MANAGER quản lý CTKM/voucher và xem lịch sử voucher (`/vouchers/usages`). SALES chỉ `GET /promotions`,
  `GET /vouchers` và **chỉ nhận bản ghi đang dùng được** (CTKM `ACTIVE`, voucher `ACTIVE`). WAREHOUSE: 403.
- CTKM lưu `trang_thai` ACTIVE/PAUSED/CANCELLED (migration `promotion_status`). Trạng thái hiển thị
  (`promotions/promotion-status.ts`): CANCELLED → EXPIRED (qua ngày kết thúc) → PAUSED → SCHEDULED → ACTIVE;
  khoảng ngày tính cả hai đầu, "hôm nay" theo giờ cửa hàng (`common/store-time.ts`, Asia/Ho_Chi_Minh).
  PAUSED tiếp tục được; CANCELLED là cuối; CANCELLED/EXPIRED không sửa được.
- Voucher: trạng thái suy ra EXPIRED → PAUSED → USED_UP → SCHEDULED → ACTIVE. Hết hạn chỉ được xem.
  `usageLimit` không nhỏ hơn số đã dùng. `usedCount` & lịch sử chỉ đến từ hóa đơn, không nhận từ payload.
  Bỏ trống mã khi tạo → sinh mã 8 ký tự.
- Validate: PERCENT 1–100, FIXED số nguyên > 0, mức tối đa chỉ cho PERCENT, đơn tối thiểu ≥ 0,
  ngày kết thúc ≥ ngày bắt đầu và ≥ hôm nay, thể loại phạm vi phải tồn tại, mã trùng → 409.
- Tính tiền giảm: `promotions/pricing.ts › calculatePricing` (hàm thuần, có unit test) – Chặng 6 dùng cho preview
  và lập hóa đơn. Quy tắc chi tiết: `docs/database.md` › Quy tắc tính tiền.
- Hóa đơn lưu số tiền giảm riêng → sửa CTKM/voucher không đổi hóa đơn cũ.

## Quy ước Bán hàng & Hóa đơn (Chặng 6)

- `/invoices` (GET, GET :id, POST, POST preview): SALES + MANAGER; WAREHOUSE 403. Người lập = tài khoản đăng nhập.
- Payload chỉ được dùng: mã sách + số lượng, khách, CTKM, voucher, phương thức, tiền khách đưa, ghi chú,
  `requestKey`, `expectedTotal`. Giá, giá vốn, tổng, chiết khấu, cashierId FE gửi bị loại bỏ.
- `sales/invoices.service.ts › evaluateCart` dùng chung cho preview và lập hóa đơn: gộp dòng trùng sách,
  kiểm tra sách tồn tại / đang kinh doanh / đủ tồn, khách tồn tại, CTKM & voucher đang hiệu lực
  (`promotion-status.ts`), tính tiền bằng `calculatePricing`. CTKM/voucher được chọn mà không áp dụng được
  → từ chối (không âm thầm bỏ). Preview trả `valid` + `messages`, không ghi DB.
- Lập hóa đơn trong 1 transaction: hóa đơn (+ `ten_sach`, giá bán, giá vốn, giảm phân bổ từng dòng),
  thanh toán (`TT-<mã HĐ>`; tiền mặt lưu tiền khách đưa), trừ tồn và tăng lượt voucher bằng UPDATE có điều kiện
  (đồng thời không bán vượt tồn / dùng vượt lượt), cộng điểm `pointsFor(tổng)`.
- Mã hóa đơn `HD-ddMM-<n>` với n từ sequence `hoa_don_so_thu_tu` (bắt đầu 2000).
- Chống lặp: `requestKey` → cột unique `hoa_don.ma_yeu_cau`. Gửi lại cùng khóa:
  cùng tài khoản + cùng nội dung nghiệp vụ → trả hóa đơn gốc, không ghi thêm (thành công cả khi tồn/lượt voucher
  đã hết sau giao dịch gốc); khác nội dung → 409 nêu mã hóa đơn và mục khác; khác tài khoản → 409.
  Nội dung so sánh (`sales/checkout-content.ts`): sách/số lượng (gộp dòng, không phụ thuộc thứ tự), khách, CTKM,
  voucher, phương thức, tiền khách đưa (chỉ tiền mặt). Không so giá/tổng/ghi chú/expectedTotal.
  FE giữ giỏ khi lỗi và không tự đổi khóa. `expectedTotal` khác tổng tính lại → 409 (giá/khuyến mãi vừa đổi).
- FE POS: preview debounce 300ms, bỏ response cũ (số thứ tự yêu cầu + so khớp chữ ký giỏ hàng); chỉ cho
  thanh toán khi preview hiện tại `valid`; khóa nút khi gửi; lỗi giữ giỏ + tính lại preview; thành công mới
  đóng đơn tạm (đơn mới có requestKey mới) và tải lại dữ liệu.
- Cờ Mock: `sales` (hóa đơn) đã bật API thật; `returns` (đổi/trả) tách riêng, vẫn Mock.

## Quy ước Đổi / trả (Chặng 7)

- `/returns` (GET, POST, POST preview): SALES + MANAGER; WAREHOUSE 403. Người xử lý = tài khoản đăng nhập.
  Payload chỉ dùng: hóa đơn, loại, sách + số lượng + tình trạng, sách đổi, lý do, `requestKey`;
  đơn giá / tiền hoàn / chênh lệch / handledBy FE gửi bị loại bỏ.
- **Hạn 7 ngày** (`returns/refund.ts`): ngày lập hóa đơn theo lịch Việt Nam + 7 ngày, được đổi/trả đến hết ngày đó
  (hóa đơn 20/11 lúc 23:59 → hạn hết 27/11; 00:30 ngày 21 giờ VN tính là ngày 21).
- **Giá trị sách trả** tính lũy kế trên tiền thực trả đã lưu của dòng gốc (số lượng × đơn giá − `giam_gia`):
  lần này = floor(thực trả × (đã trả + q) / số mua) − floor(thực trả × đã trả / số mua) → nhiều lần không vượt,
  trả hết hoàn đúng toàn bộ. Lưu `chi_tiet_doi_tra.gia_tri_tra` (đồng) + `don_gia_hoan` (hiển thị).
- Đổi hàng: sách mới đang kinh doanh, đủ tồn (tính cả cuốn cùng mã vừa nhận lại); giá = giá bán hiện tại,
  không áp khuyến mãi; số lượng đổi = tổng số lượng trả. Chênh lệch > 0 → `tien_khach_bu`, < 0 → `tien_hoan_tra`
  (lưu riêng). Chưa hỗ trợ đổi/trả dây chuyền (sách đổi ra không trả lại được qua phiếu này).
- 1 transaction: khóa hóa đơn gốc `SELECT … FOR UPDATE` (các phiếu cùng hóa đơn chạy lần lượt), lưu phiếu,
  cộng tồn sách nhận lại (không đổi trạng thái → sách ngừng kinh doanh vẫn ngừng), trừ tồn sách đổi ra có điều kiện,
  trạng thái hóa đơn PARTIAL_RETURN / RETURNED, điểm = pointsFor(thực trả hóa đơn sau) − pointsFor(trước) (không âm).
  Chi tiêu / hạng khách tự tính lại từ hóa đơn + phiếu.
- Mã phiếu `DT-ddMM-<n>` (sequence `phieu_doi_tra_so_thu_tu`, từ 3000). Chống lặp như hóa đơn: cùng khóa + cùng
  nội dung (hóa đơn, loại, sách/số lượng, sách đổi) → phiếu cũ; khác nội dung / khác người → 409.
- `GET /invoices` trả thêm `items[].returnedQuantity` và `returnDeadline` cho form đổi/trả.
- Kiểm tra thủ công: `docs/manual-tests/returns-fixture.sql` / `returns-cleanup.sql`.

## Quy ước Nhập hàng & Thanh toán NCC (Chặng 8)

- `/imports` (GET, POST), `/supplier-payments` (GET, POST): WAREHOUSE + MANAGER; SALES 403.
  Người lập / người ghi nhận = tài khoản đăng nhập. Tổng tiền, công nợ, createdBy, recordedBy FE gửi bị bỏ qua.
- Phiếu nhập: NCC tồn tại và `ACTIVE`; sách tồn tại; số lượng nguyên dương, giá nhập > 0; dòng trùng sách cùng giá
  → gộp, khác giá → 400. Trả trước ≤ tổng; còn nợ thì bắt buộc hạn ≥ hôm nay.
  1 transaction: phiếu + chi tiết, cộng tồn, `sach.gia_nhap` = giá lô mới (không đổi giá vốn đã lưu trên hóa đơn cũ,
  không đổi trạng thái sách), trả trước → đúng 1 phiếu chi (không `ma_yeu_cau`) và `da_thanh_toan` = khoản đó.
- Thanh toán: bắt buộc phiếu nhập, phiếu phải thuộc NCC đã chọn; số tiền > 0 và ≤ nợ còn lại; NCC `INACTIVE` vẫn trả
  được nợ cũ. Cộng `da_thanh_toan` bằng UPDATE có điều kiện (`da_thanh_toan + số tiền ≤ tong_tien`) → đồng thời không
  vượt nợ; CHECK DB là lớp chặn cuối. `da_thanh_toan` luôn = Σ phiếu chi.
- Trạng thái nợ (`purchasing/debt-status.ts`): hết nợ → PAID (kể cả qua hạn); còn nợ & hôm nay > hạn → OVERDUE;
  đã trả một phần → PARTIAL; chưa trả → UNPAID. Công nợ NCC (`/suppliers`) suy ra từ cùng dữ liệu.
- Mã `PN-ddMM-<n>`, `PC-ddMM-<n>` từ sequence (`common/document-code.ts`, dùng chung với HD, DT).
  Chống lặp: `ma_yeu_cau` unique trên phiếu nhập và phiếu chi; nội dung so sánh – phiếu nhập: NCC, sách×số lượng@giá,
  trả trước (Σ phiếu chi không khóa của phiếu), hạn (khi còn nợ); thanh toán: NCC, phiếu, số tiền, phương thức.
- FE: form thanh toán bắt buộc chọn phiếu nhập còn nợ (số tiền mặc định = nợ còn lại); form lập phiếu chỉ NCC ACTIVE.
- Kiểm tra thủ công: `docs/manual-tests/imports-fixture.sql` / `imports-cleanup.sql`.

## Quy ước Kiểm kê (Chặng 9)

- `/inventory/adjustments` (GET, POST): WAREHOUSE + MANAGER; SALES 403. Người lập = tài khoản đăng nhập.
  Một phiếu áp dụng ngay (không nháp / duyệt); response `status` luôn `APPLIED`.
- Mỗi dòng: `bookId`, `systemStock` (tồn FE thấy lúc mở form), `actualStock` (nguyên ≥ 0), `reason`.
  Không trùng sách trong phiếu; dòng có chênh lệch bắt buộc lý do; `diff` / createdBy FE gửi bị bỏ qua.
- 1 transaction: khóa dòng sách `SELECT … FOR UPDATE` (theo thứ tự mã sách, tránh deadlock) → tồn hiện tại khác
  `systemStock` → 409 (không ghi đè giao dịch mới, cả phiếu không áp dụng) → lưu phiếu + chi tiết (tồn hệ thống
  lấy từ DB) → tồn = số thực tế. Không đổi trạng thái sách. Mã `KK-ddMM-<n>` (sequence `phieu_kiem_ke_so_thu_tu`).
- Chống lặp: `ma_yeu_cau` unique; nội dung so sánh: sách + tồn lúc mở form + số thực tế (không so lý do / ghi chú).
- FE: mở form thì tải lại tồn mới nhất; lỗi 409 → giữ số đã nhập, tải lại tồn để kiểm kê lại.
- Kiểm tra thủ công: `docs/manual-tests/stock-fixture.sql` / `stock-cleanup.sql`.
- **Chống lặp – áp dụng chung cho hóa đơn, đổi/trả, nhập hàng, thanh toán, kiểm kê:** khi tạo chứng từ lỗi vì bất
  kỳ lý do gì, kiểm tra lại `requestKey`; nếu đã được lưu (request song song cùng khóa vừa ghi) → trả chứng từ đó
  (cùng nội dung) hoặc 409 (khác nội dung). Tránh trường hợp request lặp đến sau báo "hết tồn / đã trả hết / vượt nợ".

## Quy ước Báo cáo, Tài khoản, Hệ thống (Chặng 10)

- `/reports/revenue`, `/reports/bestsellers` (`?from=YYYY-MM-DD&to=YYYY-MM-DD`): **chỉ MANAGER**. Công thức doanh thu thuần,
  giá vốn thuần, lợi nhuận gộp, kỳ theo giờ VN, kỳ trước: `docs/database.md` › Quy tắc tính tiền. Hàm thuần
  `reports/revenue.ts` (unit test số tính tay). Tối đa 366 ngày.
- `/dashboard/summary`: mọi vai trò, **backend chọn chỉ số theo vai trò** – MANAGER: doanh thu thuần, số HĐ, sách bán
  thuần, khách mới; SALES: hóa đơn / sách / phiếu đổi trả của chính mình, khách mới (không có doanh thu cửa hàng);
  WAREHOUSE: phiếu nhập, số sách nhập, phiếu kiểm kê, đầu sách dưới định mức (hiện tại). Mỗi chỉ số có kỳ trước
  (cùng số ngày liền trước) và chuỗi theo ngày; FE tính % và vẽ sparkline từ số thật, không còn số/đường mẫu.
- Báo cáo tồn kho & công nợ NCC = số liệu hiện tại (`/books`, `/suppliers`); giá trị tồn ước tính theo giá nhập gần nhất.
- Tài khoản `/system/accounts` (chỉ MANAGER): quy tắc ở `docs/auth.md` › Quản lý tài khoản. Bộ phận nhân viên ↔ vai trò
  đồng bộ cả hai chiều (cũng trong `employees.service.ts`). Mã tài khoản `TKxxx`.
- `/system/permissions`: ma trận chỉ xem sinh từ `system/permissions.ts` (MANAGER được mọi thao tác **có API**;
  thao tác không có API = không cho ai). E2E gọi thật endpoint đại diện từng module × vai trò để đối chiếu cột "Xem".
  Đổi quyền thật phải sửa `@Roles` **và** bảng này (test sẽ báo lệch).
- `/system/backups`: xuất JSON các bảng nghiệp vụ trong 1 transaction REPEATABLE READ + ghi `ban_sao_luu` (lịch sử,
  mã `SLxxxx`). Tài khoản chỉ xuất tên đăng nhập / email / vai trò / trạng thái – không hash, OTP, `phien_ban`, token.
  `meta.scope` ghi rõ phạm vi và "chưa hỗ trợ phục hồi". **Không có endpoint restore**; FE vô hiệu hóa ô phục hồi.
- Chế độ Mock không giả lập báo cáo / tài khoản / sao lưu (service báo "chỉ khả dụng khi kết nối API thật");
  đã xóa chuỗi doanh thu mẫu `REVENUE_SERIES_7D`.
- Kiểm tra thủ công: `docs/manual-tests/reports-fixture.sql` / `reports-cleanup.sql`.

## Checklist Chặng 11 (hoàn thiện) – đã làm, chi tiết `docs/final-verification.md`

- [x] Bỏ dòng "Đang chạy chế độ dữ liệu Mock…" và nút "Khôi phục dữ liệu mẫu" khi chạy API thật (`anyModuleUsesMock()`).
- [x] Chức năng trong phạm vi dùng DB thật; tải dữ liệu lỗi → báo lỗi (không bảng trống im lặng); mất kết nối →
  `ApiError` status 0 thông báo tiếng Việt. Phục hồi vẫn vô hiệu hóa.
- [x] Tên / thông tin nhà sách: `config/brand.ts` (một cửa hàng, khớp `STORE_NAME`/`STORE_BRANCH` backend); bỏ dropdown
  chi nhánh; tệp xuất CSV/JSON có tiền tố `nha-sach-be-bi_`.
- [x] Docker: API chạy `prisma migrate deploy` trước khi phục vụ (lỗi → dừng), `/health` 503 khi mất DB, seed chạy tay,
  `CONTAINER_PREFIX` cho môi trường song song; README + `docs/deployment.md` viết lại (UTF-8).
- [x] Rà soát cuối: lint/build/test, giới hạn demo trong README.

## Quy ước hoàn thiện (Chặng 11)

- Ô nhập số trên FE dùng `NumberInput` (`lib/format.ts`): cho phép xóa trống, số 0 hợp lệ, ô trống báo thiếu khi lưu.
- Form ghi dữ liệu khóa nút khi đang gửi; lỗi giữ nguyên form; thành công mới tải lại.
- **E2E chạy trên DB riêng** (đặt `DATABASE_URL` trỏ DB thử): test hệ thống tạm khóa TK001 → không chạy trên DB demo
  đang dùng.

## Điểm còn mở / ghi chú cho chặng sau

- Chưa có chiết khấu theo dòng trên phiếu nhập (giới hạn demo); trang NCC đọc phiếu nhập thật từ Chặng 8.
- Nhân viên `ON_LEAVE` vẫn đăng nhập được (chỉ `RESIGNED` bị chặn) – giữ như Chặng 2, chưa có quyết định khác.
- Đặt lại mật khẩu cho chính mình cũng thu hồi phiên của mình → bị đăng xuất (chấp nhận).
- Hóa đơn seed `HD-2611-1042` trong DB hiện tại được phân bổ theo quy tắc cũ (21.728 / 28.272); seed mới
  sinh 21.729 / 28.271. Cả hai hợp lệ; quyết định giữ nguyên, không chạy UPDATE. Đổi/trả dùng số đã lưu.
- Cột `khach_hang.dang_hoat_dong` chưa dùng (chưa có thiết kế vô hiệu hóa khách hàng).
- Chống lặp hóa đơn: nếu request đã tạo hóa đơn nhưng FE không nhận phản hồi rồi người dùng **sửa giỏ** và gửi lại
  cùng đơn tạm → 409 nêu mã hóa đơn đã lập; người dùng kiểm tra trang Hóa đơn và mở đơn tạm mới.

## Giới hạn demo (để nhóm biết khi trình bày)

Các điểm dưới đây là giới hạn triển khai, **không** phải sửa tài liệu nghiệp vụ:

- Phân quyền cố định theo 3 vai trò; không cấu hình quyền động (Class diagram có `VaiTro.danhSachQuyen`).
- OTP quên mật khẩu không gửi email thật (in console môi trường demo).
- Chưa có phục hồi dữ liệu (Restore); chỉ có xuất JSON dữ liệu nghiệp vụ (không gồm dữ liệu xác thực) để lưu trữ / đối chiếu.
- Báo cáo: giá trị tồn kho ước tính theo giá nhập gần nhất (không theo lô / bình quân); kỳ báo cáo tối đa 366 ngày.
- Khuyến mãi: không combo, không khuyến mãi theo từng đầu sách, không kiểm tra trùng khuyến mãi theo đầu sách.
- Sách chỉ một tác giả (Class diagram vẽ n‑n); không ngưỡng tồn tối đa.
- Phiếu nhập không có chiết khấu theo dòng.
- Kiểm kê và điều chỉnh kho gộp thành một phiếu.
- Hạn đổi/trả 7 ngày là quy tắc chọn (tài liệu ghi dạng ví dụ); quy tắc điểm/hạng lấy theo FE vì tài liệu chưa nêu số.
- Phương thức thanh toán: CASH / TRANSFER / CARD (đặc tả có thêm ví MoMo).
- Một cửa hàng; `branchId` trả giá trị cố định. Không in hóa đơn ra máy in.

## Môi trường local (máy dev hiện tại)

- Máy có sẵn dịch vụ Windows `postgresql-x64-16` chiếm **5432** và container của project khác (đều thuộc
  project khác – không dừng/xóa). Postgres của dự án map ra **5433** qua `POSTGRES_PORT=5433` trong `.env` root.
- `.env` (root, cho Docker Compose) và `apps/api/.env` (cho API chạy local) đều gitignored; mẫu ở `.env.example`.
- `DATABASE_URL`: biến môi trường được ưu tiên; nếu thiếu, Prisma CLI / seed / API đọc `apps/api/.env`.
  Không có cả hai thì báo lỗi – **không** fallback sang `localhost:5432`. Lệnh Prisma in DB đích (không in mật khẩu).
  API trong Docker dùng `postgres:5432` do Compose truyền vào.
- Chỉ dùng `prisma migrate deploy` (không reset). Tạo migration mới: `prisma migrate diff --from-config-datasource
  --to-schema prisma/schema.prisma --script` rồi rà SQL trước khi deploy; tránh `migrate dev`/`migrate reset`
  vì có thể đề nghị xóa dữ liệu.
- Sau khi đổi schema: `npm run db:generate` (migrate deploy không tự sinh Prisma Client).
- `JWT_SECRET` (≥ 32 ký tự, tự sinh) bắt buộc trong `apps/api/.env` và `.env` root (cho Docker);
  `AUTH_DEMO_OTP_LOG=true` chỉ đặt ở `apps/api/.env` local. Mẫu: các file `.env.example`.

```powershell
docker compose up -d postgres            # tại root
cd apps/api; npm run db:migrate; npm run db:seed
cd apps/api; npm run build; node dist/main.js   # http://localhost:3001/health
cd apps/api; npm run lint; npx tsc --noEmit -p tsconfig.json; npm test
$env:DATABASE_URL="<DB thử riêng>"; npm run test:e2e   # không chạy e2e trên DB demo
cd apps/web; npm run lint; npm run build
```

## Thứ tự triển khai

0. Chuẩn bị (branch `feature/backend` từ `origin/frontend`, CLAUDE.md, baseline build/health) ✅
1. Prisma schema + migration + seed demo ✅
2. Auth + RBAC guard; bỏ mock auth ở FE ✅
3. Danh mục + Sách ✅
4. Khách hàng, Nhà cung cấp, Nhân viên ✅
5. Khuyến mãi / voucher ✅
6. Bán hàng ✅
7. Đổi / trả ✅
8. Nhập hàng + thanh toán NCC ✅
9. Kiểm kê ✅
10. Báo cáo doanh thu, quản lý tài khoản, sao lưu JSON ✅
11. README hướng dẫn chạy, migrate trong Docker, rà soát ✅ (chờ người dùng thử trình duyệt + review cuối)
