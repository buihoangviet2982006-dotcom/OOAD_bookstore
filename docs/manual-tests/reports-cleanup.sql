-- Dọn dữ liệu thử Chặng 10: đúng các mã trong reports-fixture.sql, tài khoản cấp cho TEST-NV1,
-- và bản ghi lịch sử xuất dữ liệu có ghi chú đúng bằng 'TEST sao luu'.
-- Tự dừng (không xóa gì) nếu dữ liệu thử đã bị dùng ở chứng từ khác ngoài fixture.
-- Chạy:  Get-Content docs/manual-tests/reports-cleanup.sql | docker exec -i ooad_bookstore_postgres psql -U bookstore -d ooad_bookstore -v ON_ERROR_STOP=1 -1
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM chi_tiet_hoa_don WHERE ma_sach IN ('TEST-RP-A', 'TEST-RP-B', 'TEST-RP-C')
             AND ma_hoa_don NOT IN ('TEST-HD0', 'TEST-HD1'))
     OR EXISTS (SELECT 1 FROM phieu_doi_tra WHERE ma_hoa_don IN ('TEST-HD0', 'TEST-HD1')
             AND ma_doi_tra NOT IN ('TEST-DT1', 'TEST-DT2'))
     OR EXISTS (SELECT 1 FROM chi_tiet_doi_tra WHERE (ma_sach IN ('TEST-RP-A', 'TEST-RP-B', 'TEST-RP-C')
             OR ma_sach_doi IN ('TEST-RP-A', 'TEST-RP-B', 'TEST-RP-C')) AND ma_doi_tra NOT IN ('TEST-DT1', 'TEST-DT2'))
     OR EXISTS (SELECT 1 FROM chi_tiet_phieu_nhap WHERE ma_sach IN ('TEST-RP-A', 'TEST-RP-B', 'TEST-RP-C'))
     OR EXISTS (SELECT 1 FROM chi_tiet_kiem_ke WHERE ma_sach IN ('TEST-RP-A', 'TEST-RP-B', 'TEST-RP-C')) THEN
    RAISE EXCEPTION 'Du lieu thu bao cao da duoc dung o chung tu khac - dung don, xu ly rieng.';
  END IF;
  IF EXISTS (SELECT 1 FROM hoa_don WHERE ma_nv = 'TEST-NV1') OR EXISTS (SELECT 1 FROM phieu_doi_tra WHERE ma_nv = 'TEST-NV1')
     OR EXISTS (SELECT 1 FROM phieu_nhap WHERE ma_nv = 'TEST-NV1') OR EXISTS (SELECT 1 FROM phieu_kiem_ke WHERE ma_nv = 'TEST-NV1')
     OR EXISTS (SELECT 1 FROM phieu_thanh_toan_ncc WHERE ma_nv = 'TEST-NV1') THEN
    RAISE EXCEPTION 'Nhan vien TEST-NV1 da lap chung tu - dung don, xu ly rieng.';
  END IF;
END $$;

DELETE FROM chi_tiet_doi_tra WHERE ma_doi_tra IN ('TEST-DT1', 'TEST-DT2');
DELETE FROM phieu_doi_tra WHERE ma_doi_tra IN ('TEST-DT1', 'TEST-DT2');
DELETE FROM thanh_toan WHERE ma_hoa_don IN ('TEST-HD0', 'TEST-HD1');
DELETE FROM chi_tiet_hoa_don WHERE ma_hoa_don IN ('TEST-HD0', 'TEST-HD1');
DELETE FROM hoa_don WHERE ma_hoa_don IN ('TEST-HD0', 'TEST-HD1');
DELETE FROM sach WHERE ma_sach IN ('TEST-RP-A', 'TEST-RP-B', 'TEST-RP-C');
DELETE FROM ban_sao_luu WHERE ma_nv = 'TEST-NV1' OR ghi_chu = 'TEST sao luu';
DELETE FROM tai_khoan WHERE ma_nv = 'TEST-NV1';
DELETE FROM nhan_vien WHERE ma_nv = 'TEST-NV1';
