-- Dữ liệu thử Chặng 10 (Báo cáo + Tài khoản). Giá trị không dấu để tránh lỗi mã hóa PowerShell.
-- Tạo: sách TEST-RP-A/B/C; hóa đơn TEST-HD0 (29/09/2026), TEST-HD1 (01/10/2026); phiếu TEST-DT1 (02/10 23:30),
--      TEST-DT2 (03/10 00:10, đổi sách của hóa đơn kỳ trước); nhân viên TEST-NV1 (chưa có tài khoản).
-- Kết quả tính tay – kỳ 01/10/2026 → 03/10/2026 (kỳ trước 28/09 → 30/09):
--   Doanh thu thuần = 230.000 + 25.000 − 90.000 = 165.000   (kỳ trước 45.000)
--   Giá vốn thuần   = 150.000 − 90.000 + 40.000 = 100.000   (kỳ trước 30.000)
--   Lợi nhuận gộp   = 65.000                                 (kỳ trước 15.000)
--   Theo ngày: 01/10 230.000 | 02/10 −90.000 | 03/10 25.000
--   Sách bán chạy: A thuần 1 (90.000), C thuần 1 (70.000), B thuần 0 (5.000) – tổng 165.000.
-- Chạy:  Get-Content docs/manual-tests/reports-fixture.sql | docker exec -i ooad_bookstore_postgres psql -U bookstore -d ooad_bookstore -v ON_ERROR_STOP=1 -1
INSERT INTO sach (ma_sach, isbn, ten_sach, gia_nhap, gia_ban, so_luong_ton, muc_ton_toi_thieu, trang_thai, ma_the_loai, ma_tac_gia, ma_nxb) VALUES
  ('TEST-RP-A', '9790000099981', 'TEST Bao cao A', 60000, 100000, 20, 0, 'ACTIVE', 'VH', 'TG001', 'NXB001'),
  ('TEST-RP-B', '9790000099982', 'TEST Bao cao B', 30000, 50000, 20, 0, 'ACTIVE', 'VH', 'TG001', 'NXB001'),
  ('TEST-RP-C', '9790000099983', 'TEST Bao cao C', 40000, 70000, 20, 0, 'ACTIVE', 'VH', 'TG001', 'NXB001');

INSERT INTO hoa_don (ma_hoa_don, ngay_lap, tong_tien_hang, tien_giam_ctkm, thanh_toan_cuoi, trang_thai, ma_nv) VALUES
  ('TEST-HD0', '2026-09-29 15:00:00+07', 50000, 5000, 45000, 'RETURNED', 'NV002'),
  ('TEST-HD1', '2026-10-01 10:00:00+07', 250000, 20000, 230000, 'PARTIAL_RETURN', 'NV002');

INSERT INTO chi_tiet_hoa_don (ma_hoa_don, ma_sach, ten_sach, so_luong_ban, don_gia_ban, giam_gia, gia_von) VALUES
  ('TEST-HD0', 'TEST-RP-B', 'TEST Bao cao B', 1, 50000, 5000, 30000),
  ('TEST-HD1', 'TEST-RP-A', 'TEST Bao cao A', 2, 100000, 20000, 60000),
  ('TEST-HD1', 'TEST-RP-B', 'TEST Bao cao B', 1, 50000, 0, 30000);

INSERT INTO thanh_toan (ma_thanh_toan, ngay_thanh_toan, so_tien, phuong_thuc, ma_hoa_don) VALUES
  ('TT-TEST-HD0', '2026-09-29 15:00:00+07', 45000, 'CARD', 'TEST-HD0'),
  ('TT-TEST-HD1', '2026-10-01 10:00:00+07', 230000, 'CARD', 'TEST-HD1');

INSERT INTO phieu_doi_tra (ma_doi_tra, ngay_doi_tra, ly_do, hinh_thuc_xu_ly, tien_hoan_tra, tien_khach_bu, ma_hoa_don, ma_nv) VALUES
  ('TEST-DT1', '2026-10-02 23:30:00+07', 'TEST tra hang', 'RETURN', 90000, 0, 'TEST-HD1', 'NV002'),
  ('TEST-DT2', '2026-10-03 00:10:00+07', 'TEST doi hang', 'EXCHANGE', 0, 25000, 'TEST-HD0', 'NV002');

INSERT INTO chi_tiet_doi_tra (ma_doi_tra, ma_sach, so_luong_tra, tinh_trang_sach, don_gia_hoan, gia_tri_tra, ma_sach_doi, don_gia_sach_doi, gia_von_sach_doi) VALUES
  ('TEST-DT1', 'TEST-RP-A', 1, 'Tot', 90000, 90000, NULL, NULL, NULL),
  ('TEST-DT2', 'TEST-RP-B', 1, 'Tot', 45000, 45000, 'TEST-RP-C', 70000, 40000);

INSERT INTO nhan_vien (ma_nv, ho_ten, so_dien_thoai, email, ngay_vao_lam, bo_phan, chuc_vu, trang_thai) VALUES
  ('TEST-NV1', 'TEST Nhan vien 1', '0900000991', 'test.nv1@test.local', '2026-11-01', 'SALES', 'Thu ngan', 'WORKING');
