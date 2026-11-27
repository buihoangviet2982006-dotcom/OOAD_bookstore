-- Dữ liệu thử cho kiểm tra Nhập hàng + Thanh toán NCC thủ công (Chặng 8).
-- Tạo: sách TEST-SP1; NCC TEST-NCC1 (đang hợp tác), TEST-NCC2 (ngừng hợp tác) kèm phiếu nợ cũ TEST-PN-OLD.
-- (Giá trị dữ liệu không dấu để tránh lỗi mã hóa PowerShell. Phiếu nợ cũ ghi người lập NV003 – chỉ tham chiếu.)
-- Chạy:  Get-Content docs/manual-tests/imports-fixture.sql | docker exec -i ooad_bookstore_postgres psql -U bookstore -d ooad_bookstore -v ON_ERROR_STOP=1 -1
INSERT INTO sach (ma_sach, isbn, ten_sach, gia_nhap, gia_ban, so_luong_ton, muc_ton_toi_thieu, trang_thai, ma_the_loai, ma_tac_gia, ma_nxb)
VALUES ('TEST-SP1', '9790000099991', 'TEST Sach nhap thu', 15000, 30000, 0, 0, 'ACTIVE', 'VH', 'TG001', 'NXB001');

INSERT INTO nha_cung_cap (ma_ncc, ten_ncc, so_dien_thoai, trang_thai) VALUES
  ('TEST-NCC1', 'TEST NCC dang hop tac', '02899999001', 'ACTIVE'),
  ('TEST-NCC2', 'TEST NCC ngung hop tac', '02899999002', 'INACTIVE');

INSERT INTO phieu_nhap (ma_phieu_nhap, tong_tien, da_thanh_toan, ma_ncc, ma_nv, han_thanh_toan, ghi_chu)
VALUES ('TEST-PN-OLD', 100000, 0, 'TEST-NCC2', 'NV003', CURRENT_DATE + 10, 'No cu truoc khi ngung hop tac');
INSERT INTO chi_tiet_phieu_nhap (ma_phieu_nhap, ma_sach, so_luong_nhap, don_gia_nhap)
VALUES ('TEST-PN-OLD', 'TEST-SP1', 5, 20000);
