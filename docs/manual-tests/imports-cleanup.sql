-- Dọn dữ liệu thử Nhập hàng: xóa đúng TEST-SP1, TEST-NCC1, TEST-NCC2, mọi phiếu nhập của 2 NCC thử
-- và phiếu chi của các phiếu nhập đó.
-- Tự dừng (không xóa gì) nếu phiếu nhập thử có sách seed (khi đó tồn / giá nhập seed đã đổi, cần xử lý riêng)
-- hoặc sách thử nằm trong phiếu nhập của NCC khác.
-- Chạy:  Get-Content docs/manual-tests/imports-cleanup.sql | docker exec -i ooad_bookstore_postgres psql -U bookstore -d ooad_bookstore -v ON_ERROR_STOP=1 -1
CREATE TEMP TABLE pn_thu AS
  SELECT ma_phieu_nhap FROM phieu_nhap WHERE ma_ncc IN ('TEST-NCC1', 'TEST-NCC2');

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM chi_tiet_phieu_nhap WHERE ma_phieu_nhap IN (SELECT ma_phieu_nhap FROM pn_thu)
             AND ma_sach <> 'TEST-SP1') THEN
    RAISE EXCEPTION 'Phiếu nhập thử có chứa sách seed – dừng dọn, không xóa gì.';
  END IF;
  IF EXISTS (SELECT 1 FROM chi_tiet_phieu_nhap WHERE ma_sach = 'TEST-SP1'
             AND ma_phieu_nhap NOT IN (SELECT ma_phieu_nhap FROM pn_thu)) THEN
    RAISE EXCEPTION 'Sách thử nằm trong phiếu nhập của NCC khác – dừng dọn, không xóa gì.';
  END IF;
END $$;

DELETE FROM phieu_thanh_toan_ncc WHERE ma_phieu_nhap IN (SELECT ma_phieu_nhap FROM pn_thu);
DELETE FROM chi_tiet_phieu_nhap WHERE ma_phieu_nhap IN (SELECT ma_phieu_nhap FROM pn_thu);
DELETE FROM phieu_nhap WHERE ma_phieu_nhap IN (SELECT ma_phieu_nhap FROM pn_thu);
DELETE FROM sach WHERE ma_sach = 'TEST-SP1';
DELETE FROM nha_cung_cap WHERE ma_ncc IN ('TEST-NCC1', 'TEST-NCC2');
