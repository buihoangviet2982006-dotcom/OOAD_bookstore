-- Dọn dữ liệu thử Đổi / trả: xóa đúng TEST-SP1..3, TEST-KH1, các hóa đơn dùng chúng và phiếu đổi/trả của các hóa đơn đó.
-- Tự dừng (không xóa gì) nếu dữ liệu thử dính sách seed (khi đó tồn kho seed đã thay đổi, cần xử lý riêng).
-- Chạy:  Get-Content docs/manual-tests/returns-cleanup.sql | docker exec -i ooad_bookstore_postgres psql -U bookstore -d ooad_bookstore -v ON_ERROR_STOP=1 -1
CREATE TEMP TABLE sach_thu (ma_sach VARCHAR(50));
INSERT INTO sach_thu VALUES ('TEST-SP1'), ('TEST-SP2'), ('TEST-SP3');

CREATE TEMP TABLE hd_thu AS
  SELECT DISTINCT h.ma_hoa_don FROM hoa_don h LEFT JOIN chi_tiet_hoa_don c ON c.ma_hoa_don = h.ma_hoa_don
  WHERE c.ma_sach IN (SELECT ma_sach FROM sach_thu) OR h.ma_kh = 'TEST-KH1';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM chi_tiet_hoa_don WHERE ma_hoa_don IN (SELECT ma_hoa_don FROM hd_thu)
             AND ma_sach NOT IN (SELECT ma_sach FROM sach_thu)) THEN
    RAISE EXCEPTION 'Hóa đơn thử có chứa sách seed – dừng dọn, không xóa gì.';
  END IF;
  IF EXISTS (SELECT 1 FROM chi_tiet_doi_tra c JOIN phieu_doi_tra p ON p.ma_doi_tra = c.ma_doi_tra
             WHERE p.ma_hoa_don IN (SELECT ma_hoa_don FROM hd_thu)
             AND c.ma_sach_doi IS NOT NULL AND c.ma_sach_doi NOT IN (SELECT ma_sach FROM sach_thu)) THEN
    RAISE EXCEPTION 'Phiếu đổi thử đã đổi sang sách seed – dừng dọn, không xóa gì.';
  END IF;
END $$;

DELETE FROM chi_tiet_doi_tra WHERE ma_doi_tra IN (SELECT ma_doi_tra FROM phieu_doi_tra WHERE ma_hoa_don IN (SELECT ma_hoa_don FROM hd_thu));
DELETE FROM phieu_doi_tra WHERE ma_hoa_don IN (SELECT ma_hoa_don FROM hd_thu);
DELETE FROM thanh_toan WHERE ma_hoa_don IN (SELECT ma_hoa_don FROM hd_thu);
DELETE FROM chi_tiet_hoa_don WHERE ma_hoa_don IN (SELECT ma_hoa_don FROM hd_thu);
DELETE FROM hoa_don WHERE ma_hoa_don IN (SELECT ma_hoa_don FROM hd_thu);
DELETE FROM sach WHERE ma_sach IN (SELECT ma_sach FROM sach_thu);
DELETE FROM khach_hang WHERE ma_kh = 'TEST-KH1';
