-- Dữ liệu thử cho kiểm tra Đổi / trả thủ công (Chặng 7).
-- Chỉ tạo bản ghi mã TEST-SP1, TEST-SP2, TEST-SP3, TEST-KH1 (giá trị dữ liệu không dấu để tránh lỗi mã hóa PowerShell).
-- Chạy:  Get-Content docs/manual-tests/returns-fixture.sql | docker exec -i ooad_bookstore_postgres psql -U bookstore -d ooad_bookstore -v ON_ERROR_STOP=1 -1
INSERT INTO sach (ma_sach, isbn, ten_sach, gia_nhap, gia_ban, so_luong_ton, muc_ton_toi_thieu, trang_thai, ma_the_loai, ma_tac_gia, ma_nxb) VALUES
  ('TEST-SP1', '9790000099991', 'TEST Sach ban de tra', 10000, 20000, 5, 0, 'ACTIVE', 'VH', 'TG001', 'NXB001'),
  ('TEST-SP2', '9790000099992', 'TEST Sach doi sang', 20000, 35000, 1, 0, 'ACTIVE', 'VH', 'TG001', 'NXB001'),
  ('TEST-SP3', '9790000099993', 'TEST Sach het ton', 10000, 25000, 0, 0, 'ACTIVE', 'VH', 'TG001', 'NXB001');
INSERT INTO khach_hang (ma_kh, ho_ten, so_dien_thoai) VALUES ('TEST-KH1', 'TEST Khach doi tra', '0911999001');
