-- Dữ liệu thử cho kiểm tra Kiểm kê thủ công (Chặng 9). Chỉ tạo sách TEST-SP1 (tồn 10), TEST-SP2 (tồn 3).
-- (Giá trị dữ liệu không dấu để tránh lỗi mã hóa PowerShell.)
-- Chạy:  Get-Content docs/manual-tests/stock-fixture.sql | docker exec -i ooad_bookstore_postgres psql -U bookstore -d ooad_bookstore -v ON_ERROR_STOP=1 -1
INSERT INTO sach (ma_sach, isbn, ten_sach, gia_nhap, gia_ban, so_luong_ton, muc_ton_toi_thieu, trang_thai, ma_the_loai, ma_tac_gia, ma_nxb) VALUES
  ('TEST-SP1', '9790000099991', 'TEST Sach kiem ke 1', 10000, 20000, 10, 5, 'ACTIVE', 'VH', 'TG001', 'NXB001'),
  ('TEST-SP2', '9790000099992', 'TEST Sach kiem ke 2', 10000, 20000, 3, 5, 'ACTIVE', 'VH', 'TG001', 'NXB001');
