-- Dọn dữ liệu thử Kiểm kê: xóa đúng TEST-SP1, TEST-SP2 và các phiếu kiểm kê chứa chúng.
-- Tự dừng (không xóa gì) nếu phiếu kiểm kê thử có cả sách seed (khi đó tồn seed đã đổi, cần xử lý riêng)
-- hoặc sách thử đã nằm trong chứng từ khác (hóa đơn, phiếu nhập, đổi/trả).
-- Chạy:  Get-Content docs/manual-tests/stock-cleanup.sql | docker exec -i ooad_bookstore_postgres psql -U bookstore -d ooad_bookstore -v ON_ERROR_STOP=1 -1
CREATE TEMP TABLE kk_thu AS
  SELECT DISTINCT ma_kiem_ke FROM chi_tiet_kiem_ke WHERE ma_sach IN ('TEST-SP1', 'TEST-SP2');

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM chi_tiet_kiem_ke WHERE ma_kiem_ke IN (SELECT ma_kiem_ke FROM kk_thu)
             AND ma_sach NOT IN ('TEST-SP1', 'TEST-SP2')) THEN
    RAISE EXCEPTION 'Phiếu kiểm kê thử có chứa sách seed – dừng dọn, không xóa gì.';
  END IF;
  IF EXISTS (SELECT 1 FROM chi_tiet_hoa_don WHERE ma_sach IN ('TEST-SP1', 'TEST-SP2'))
     OR EXISTS (SELECT 1 FROM chi_tiet_phieu_nhap WHERE ma_sach IN ('TEST-SP1', 'TEST-SP2')) THEN
    RAISE EXCEPTION 'Sách thử đã có trong hóa đơn / phiếu nhập – dừng dọn, xử lý riêng.';
  END IF;
END $$;

DELETE FROM chi_tiet_kiem_ke WHERE ma_kiem_ke IN (SELECT ma_kiem_ke FROM kk_thu);
DELETE FROM phieu_kiem_ke WHERE ma_kiem_ke IN (SELECT ma_kiem_ke FROM kk_thu);
DELETE FROM sach WHERE ma_sach IN ('TEST-SP1', 'TEST-SP2');
