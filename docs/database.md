# Cơ sở dữ liệu – đối chiếu Relational Data Model

Schema: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma) ·
Migration: `apps/api/prisma/migrations/` · Seed: [`apps/api/prisma/seed.ts`](../apps/api/prisma/seed.ts)

- **Tên bảng / cột** trong PostgreSQL giữ đúng RDM (vd `sach.ten_sach`).
- **Tên model / field** trong code theo Class diagram (vd `Sach.tenSach`).
- **Giá trị enum** tiếng Anh để khớp hợp đồng API với frontend (`apps/web/src/types`).
- Khóa chính là **mã nghiệp vụ dạng chuỗi** như RDM (`ma_sach = SP001`, `ma_hoa_don = HD-2611-1042`);
  API trả `id = mã` cho FE. Mã đã tạo không đổi.

## Bảng và điểm khác RDM

| Bảng (RDM) | Model | Khác RDM | Lý do |
|---|---|---|---|
| NHAN_VIEN | NhanVien | + `bo_phan`, `chuc_vu`, `luong_co_ban`, `trang_thai` | Đặc tả QLNV lọc theo phòng ban/chức vụ; state diagram nhân viên; FE có lương cơ bản |
| TAI_KHOAN | TaiKhoan | `trang_thai` boolean → enum ACTIVE/LOCKED; + `so_lan_sai_mat_khau`, `phien_ban`, `otp_hash`, `otp_het_han`, `otp_so_lan_sai`, `lan_dang_nhap_cuoi`, `ngay_tao`; `email_khoi_phuc` unique | Khóa khi sai nhiều lần, thu hồi phiên phía server (đăng xuất/khóa), OTP quên mật khẩu dùng 1 lần có hạn (quyết định #3, #11) |
| THE_LOAI | TheLoai | `ten_the_loai` unique | Đặc tả QLDMS: không trùng tên thể loại |
| TAC_GIA | TacGia | + `quoc_tich` | Mô tả yêu cầu + FE |
| NHA_XUAT_BAN | NhaXuatBan | + `email` | Đặc tả QLDMS kiểm tra định dạng email + FE |
| SACH | Sach | − `ma_ctkm`; + `vi_tri_ke`, `mo_ta`; `trang_thai` chỉ ACTIVE/DISCONTINUED | Không khuyến mãi theo từng sách (#5); "hết hàng" suy ra từ tồn = 0, sách ngừng KD giữ trạng thái (#9) |
| KHACH_HANG | KhachHang | + `dia_chi`, `ghi_chu`, `ngay_tao`, `dang_hoat_dong` | Đặc tả QLKH; xóa khách đã có giao dịch = vô hiệu hóa (state diagram) |
| CHUONG_TRINH_KHUYEN_MAI | ChuongTrinhKhuyenMai | `phan_tram_giam` → `loai_giam` + `gia_tri_giam`; + `giam_toi_da`, `don_toi_thieu`, `ma_the_loai` (null = toàn cửa hàng), `mo_ta`; `trang_thai` boolean → enum ACTIVE/PAUSED/CANCELLED (migration `20261127010000_promotion_status`, dữ liệu `da_ngung = true` chuyển thành CANCELLED) | Mô hình FE (#5); tạm dừng tiếp tục được, hủy là trạng thái cuối. Sắp diễn ra / đang diễn ra / đã kết thúc suy ra từ ngày |
| MA_GIAM_GIA | MaGiamGia | − `ma_ctkm`; `so_luong_con_lai` → `so_lan_toi_da` + `so_lan_da_dung`; + `loai_giam`, `giam_toi_da`, `ngay_bat_dau`, `dang_hoat_dong`, `mo_ta` | Voucher độc lập CTKM (#5); FE cần tổng lượt và lượt đã dùng; tăng lượt dùng bằng cập nhật có điều kiện |
| HOA_DON | HoaDon | `tien_giam_gia` → `tien_giam_ctkm` + `tien_giam_voucher`; + `ma_ctkm`, `ghi_chu`, `ma_yeu_cau` (unique, chống tạo lặp); `thanh_toan_cuoi` là cột thường; mã hóa đơn mới lấy số từ sequence `hoa_don_so_thu_tu` | Tra cứu lịch sử voucher cần số giảm riêng của voucher; tối đa 1 CTKM. Prisma không hỗ trợ cột GENERATED → backend tính, CHECK đảm bảo đúng công thức |
| CHI_TIET_HOA_DON | ChiTietHoaDon | + `gia_von`, + `ten_sach` (migration `invoice_checkout`, điền từ bảng sách cho dòng cũ); − `thanh_tien` (GEN) | Giá vốn tại thời điểm bán (#12); tên sách lúc bán để hóa đơn cũ không đổi khi sửa sách; thành tiền suy ra |
| THANH_TOAN | ThanhToan | + `tien_khach_dua` | Tính tiền thừa; **không** tính vào doanh thu |
| PHIEU_DOI_TRA | PhieuDoiTra | + `tien_khach_bu`, `ma_yeu_cau` (unique, chống lập lặp); mã phiếu mới lấy số từ sequence `phieu_doi_tra_so_thu_tu` | Doanh thu thuần cộng tiền khách bù khi đổi; ghi riêng với tiền hoàn |
| CHI_TIET_DOI_TRA | ChiTietDoiTra | + `gia_tri_tra` (giá trị thực phần trả, tính lũy kế), `don_gia_sach_doi`, `gia_von_sach_doi` (migration `return_exchange`, điền cho dòng cũ) | Tổng hoàn qua nhiều lần không vượt và trả hết hoàn đủ; căn cứ chênh lệch khi đổi; giá vốn sách đổi ra cho báo cáo. Số lượng đổi = số lượng trả (như FE) |
| NHA_CUNG_CAP | NhaCungCap | − `tong_cong_no`; + `ma_so_thue`, `nguoi_lien_he`, `trang_thai`; `so_dien_thoai` unique | Công nợ suy ra từ phiếu nhập (tránh lệch số); đặc tả QLNCC: trạng thái hợp tác, SĐT không trùng |
| PHIEU_NHAP | PhieuNhap | − `con_no` (GEN), − `trang_thai`; + `han_thanh_toan`, `ghi_chu`, `ma_yeu_cau` (unique, chống lập lặp – migration `purchase_payment`); mã mới từ sequence `phieu_nhap_so_thu_tu` | Còn nợ = tổng − đã thanh toán; trạng thái công nợ suy ra; hạn thanh toán cho cảnh báo nợ (#8) |
| CHI_TIET_PHIEU_NHAP | ChiTietPhieuNhap | − `thanh_tien` (GEN) | Suy ra. Không có chiết khấu dòng (giới hạn demo) |
| PHIEU_THANH_TOAN_NCC | PhieuThanhToanNCC | − `ma_ncc`; `ma_phieu_nhap` bắt buộc; + `ma_yeu_cau` (unique, null với khoản trả trước tạo cùng phiếu nhập); mã mới từ sequence `phieu_chi_so_thu_tu` | Bắt buộc chọn phiếu nhập (#8); NCC suy ra từ phiếu nhập, tránh dữ liệu mâu thuẫn |
| PHIEU_KIEM_KE | PhieuKiemKe | + `ma_yeu_cau` (unique, chống áp dụng lặp – migration `stock_audit`); mã mới từ sequence `phieu_kiem_ke_so_thu_tu` | Kiểm kê và điều chỉnh gộp làm một phiếu, áp dụng ngay (#10) |
| CHI_TIET_KIEM_KE | ChiTietKiemKe | − `chenh_lech` (GEN) | Suy ra = thực tế − hệ thống |
| — | BanSaoLuu (`ban_sao_luu`) | Bảng mới | Đặc tả QLHT – Sao lưu bước 5 "ghi nhận lịch sử sao lưu" |

Không tạo bảng VaiTro/Quyền: RBAC cố định 3 vai trò trong code (#2).

### Ràng buộc CHECK (viết tay trong migration `init`)

Tồn kho, giá, điểm không âm; số lượng dòng > 0; `0 ≤ da_thanh_toan ≤ tong_tien` (không trả NCC vượt nợ);
`0 ≤ so_lan_da_dung ≤ so_lan_toi_da`; `thanh_toan_cuoi = tong_tien_hang − tien_giam_ctkm − tien_giam_voucher`;
khoảng ngày CTKM/voucher hợp lệ. Đây là lớp bảo vệ cuối – service vẫn kiểm tra và báo lỗi dễ hiểu trước.

## Quy tắc tính tiền (đã chốt review)

**Khuyến mãi** – tối đa 1 CTKM + 1 voucher mỗi hóa đơn
(cài đặt: `apps/api/src/promotions/pricing.ts`, kiểm thử: `pricing.spec.ts`):

1. *Dòng đủ điều kiện CTKM*: mọi dòng (toàn cửa hàng) hoặc các dòng thuộc thể loại của CTKM.
2. *Đơn tối thiểu CTKM*: xét trên tổng giá trị các dòng đủ điều kiện.
3. *Giảm CTKM*: PERCENT = % × giá trị dòng đủ điều kiện (không vượt mức tối đa); FIXED = số tiền cố định,
   không vượt giá trị dòng đủ điều kiện.
4. *Đơn tối thiểu voucher*: xét trên phần còn lại sau giảm CTKM (tổng tiền hàng − giảm CTKM).
5. *Giảm voucher*: tính trên phần còn lại đó, theo cùng cách PERCENT/FIXED; tổng giảm ≤ tổng tiền hàng.
6. Số tiền giảm làm tròn xuống đến đồng.
7. *Phân bổ từng dòng* (`chi_tiet_hoa_don.giam_gia`): giảm CTKM chia cho các dòng đủ điều kiện theo tỷ lệ
   giá trị dòng; giảm voucher chia cho mọi dòng theo tỷ lệ giá trị còn lại của dòng.
   Cách chia (phương pháp phần dư lớn nhất): mỗi phần làm tròn xuống; số đồng còn dư chia **mỗi lần 1đ**
   cho các dòng có phần lẻ lớn nhất (hòa → dòng đứng trước). Nhờ vậy tổng phân bổ đúng bằng số tiền giảm
   và **không dòng nào bị giảm vượt giá trị của nó** (vd 2.999đ cho 3 dòng 1.000đ → 1.000 / 1.000 / 999).
   Giá hoàn khi trả = (giá trị dòng − giảm phân bổ) / số lượng.
8. Có endpoint preview cho FE hiển thị; khi hoàn tất hóa đơn backend **kiểm tra và tính lại từ đầu**,
   không dùng số của preview.

**Doanh thu thuần trong kỳ** = Σ `thanh_toan_cuoi` hóa đơn lập trong kỳ + Σ `tien_khach_bu` phiếu đổi/trả
trong kỳ − Σ `tien_hoan_tra` phiếu đổi/trả trong kỳ (theo ngày phiếu). Không dùng tiền khách đưa.

**Giá vốn thuần trong kỳ** (Chặng 10, `reports/revenue.ts`) = Σ `so_luong_ban × gia_von` dòng hóa đơn lập trong kỳ
− Σ `so_luong_tra × gia_von` (của dòng hóa đơn gốc) cho phiếu đổi/trả trong kỳ
+ Σ `so_luong_tra × gia_von_sach_doi` (sách đổi ra) cho phiếu trong kỳ. Luôn dùng giá vốn đã lưu trên chứng từ,
không dùng `sach.gia_nhap` hiện tại. **Lợi nhuận gộp** = doanh thu thuần − giá vốn thuần.

- Kỳ = ngày theo lịch Việt Nam, tính cả hai đầu: [00:00 ngày đầu, 00:00 ngày sau ngày cuối) giờ +07:00.
  Kỳ trước để so sánh = cùng số ngày, liền trước. Tối đa 366 ngày / lần.
- Phiếu đổi/trả tính vào **ngày lập phiếu**; hóa đơn gốc giữ nguyên ở kỳ của nó (không loại hóa đơn, không trừ hai lần).
  Một ngày có thể âm nếu tiền hoàn lớn hơn tiền bán.
- Sách bán chạy: số lượng thuần = bán − nhận lại + đổi ra; doanh thu từng sách = thực trả dòng − `gia_tri_tra`
  + số lượng đổi × `don_gia_sach_doi` → tổng cột bằng doanh thu thuần.
- Số sách bán (thuần) trong KPI dùng cùng quy tắc; số hóa đơn đếm hóa đơn lập trong kỳ.

**Điểm khách hàng** – 1 điểm / 10.000đ giá trị thực trả *của từng hóa đơn* (thanh toán cuối + bù − hoàn),
làm tròn xuống. Khi đổi/trả chỉ cộng/trừ phần chênh lệch điểm của hóa đơn đó → không trừ lặp.
Hạng tính từ tổng chi tiêu (cùng công thức giá trị thực trả): ≥1.200.000 SILVER, ≥3.500.000 GOLD,
≥8.000.000 DIAMOND.

## Seed – điều chỉnh so với Mock FE

Mock FE có một số số liệu không khớp nhau; seed sửa để mọi chứng từ nhất quán:

| Mock FE | Seed | Lý do |
|---|---|---|
| Phiếu nhập 100–120 cuốn/dòng, NCC "tổng nhập" 48,5tr/36,2tr/52,9tr | Thu nhỏ số lượng: PN-0511-290 (20+8 cuốn, 4.500.000), PN-1011-298 (10 cuốn, 950.000), PN-1511-301 (30+30 cuốn, 5.310.000); tổng nhập/công nợ suy ra từ phiếu | Với số lượng Mock, tồn kho hiện tại (vd 8 cuốn Rừng Na Uy) không thể đúng. Giữ nguyên trạng thái công nợ: đã trả đủ / quá hạn 24/11 / trả một phần hạn 29/11 |
| PO-02 đã trả 3.000.000 nhưng không có phiếu chi | Thêm phiếu chi PC-1011-036 (300.000) | `da_thanh_toan` phải bằng Σ phiếu chi |
| Kiểm kê: hệ thống 9 → thực tế 8 và 41 → 42 | 10 → 9 và 44 → 45 | Số hệ thống phải bằng tồn tại thời điểm kiểm kê (đã dựng lại theo thứ tự thời gian, tồn đầu kỳ ≥ 0) |
| Lịch sử voucher VU-02 trỏ hóa đơn HD-2211-1018 không tồn tại, giảm 45.000 trên đơn 315.000 (sai 15%) | Thêm hóa đơn HD-2011-1018 (20/11, KH004, 290.000 − 15% = 246.500) | Lịch sử voucher suy ra từ hóa đơn; số tiền theo đúng quy tắc |
| Voucher đã dùng 28 / 64 / 50 lượt | 1 / 1 / 0 | Lượt dùng = số hóa đơn thực dùng mã. VIP100K vẫn hết hạn (20/11) và tạm ngừng |
| Khách hàng: tổng chi 4,28tr/8,95tr…, số đơn 9/16…, hạng GOLD/DIAMOND… | Không lưu; suy ra từ hóa đơn → cả 4 khách hiện ở hạng STANDARD; điểm 56/80/54/24 | Tổng chi tiêu/số đơn của Mock không có hóa đơn tương ứng |
| SĐT có khoảng trắng ("0909 234 567") | Lưu chữ số liền ("0909234567") | Đặc tả QLKH: SĐT 10 chữ số, kiểm tra trùng |
| Sách SP007 trạng thái OUT_OF_STOCK | Lưu ACTIVE, tồn 0 → API trả OUT_OF_STOCK | Hết hàng là trạng thái suy ra (#9) |
| Lịch sử sao lưu (tệp 14,8 MB…), doanh thu 7 ngày, ma trận quyền | Không seed | Tệp không tồn tại; doanh thu tính từ hóa đơn; quyền cố định trong code |

Tài khoản demo: `minhanh.ql` (MANAGER), `thao.bh` (SALES), `hoangnam.kho` (WAREHOUSE), `linh.bh` (SALES, đang bị khóa).
Mật khẩu demo lấy từ biến `SEED_DEMO_PASSWORD`, mặc định `123456` – chỉ dùng cho môi trường demo.

## Lệnh thường dùng (trong `apps/api`)

```powershell
npm run db:status     # xem DB đích (host:port/db) và trạng thái migration
npm run db:migrate    # áp migration (prisma migrate deploy – không reset DB)
npm run db:seed       # seed demo, chạy lại an toàn
npm run db:generate   # sinh lại Prisma Client sau khi đổi schema
```

Prisma CLI đọc `DATABASE_URL` từ môi trường, nếu không có thì đọc `apps/api/.env`; không có cả hai thì báo lỗi
(không tự dùng `localhost:5432`). Mỗi lệnh in DB đích, không in mật khẩu.
