-- Dọn dữ liệu thử POS: xóa đúng TEST-SP1, TEST-KH1, TEST-VC6 và các hóa đơn dùng chúng.
-- Tự dừng (không xóa gì) nếu hóa đơn thử có chứa sách seed – khi đó tồn kho seed đã bị trừ, cần xử lý riêng.
-- Chạy:  Get-Content docs/manual-tests/pos-cleanup.sql | docker exec -i ooad_bookstore_postgres psql -U bookstore -d ooad_bookstore -v ON_ERROR_STOP=1 -1
CREATE TEMP TABLE hd_thu AS
  SELECT DISTINCT h.ma_hoa_don FROM hoa_don h LEFT JOIN chi_tiet_hoa_don c ON c.ma_hoa_don = h.ma_hoa_don
  WHERE c.ma_sach = 'TEST-SP1' OR h.ma_kh = 'TEST-KH1' OR h.ma_code = 'TEST-VC6';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM chi_tiet_hoa_don WHERE ma_hoa_don IN (SELECT ma_hoa_don FROM hd_thu) AND ma_sach <> 'TEST-SP1') THEN
    RAISE EXCEPTION 'Hóa đơn thử có chứa sách khác TEST-SP1 – dừng dọn, không xóa gì.';
  END IF;
END $$;
DELETE FROM thanh_toan WHERE ma_hoa_don IN (SELECT ma_hoa_don FROM hd_thu);
DELETE FROM chi_tiet_hoa_don WHERE ma_hoa_don IN (SELECT ma_hoa_don FROM hd_thu);
DELETE FROM hoa_don WHERE ma_hoa_don IN (SELECT ma_hoa_don FROM hd_thu);
DELETE FROM sach WHERE ma_sach = 'TEST-SP1';
DELETE FROM khach_hang WHERE ma_kh = 'TEST-KH1';
DELETE FROM ma_giam_gia WHERE ma_code = 'TEST-VC6';
