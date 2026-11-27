-- Dữ liệu thử cho kiểm tra POS thủ công (Chặng 6). Chỉ tạo bản ghi mã TEST-SP1, TEST-KH1, TEST-VC6.
-- Chạy:  Get-Content docs/manual-tests/pos-fixture.sql | docker exec -i ooad_bookstore_postgres psql -U bookstore -d ooad_bookstore -v ON_ERROR_STOP=1 -1
INSERT INTO sach (ma_sach, isbn, ten_sach, gia_nhap, gia_ban, so_luong_ton, muc_ton_toi_thieu, trang_thai, ma_the_loai, ma_tac_gia, ma_nxb)
VALUES ('TEST-SP1', '9790000099991', 'TEST Sach thu POS', 10000, 20000, 5, 0, 'ACTIVE', 'VH', 'TG001', 'NXB001');
INSERT INTO khach_hang (ma_kh, ho_ten, so_dien_thoai) VALUES ('TEST-KH1', 'TEST Khach thu', '0911999001');
INSERT INTO ma_giam_gia (ma_code, loai_giam, gia_tri_giam, don_toi_thieu, so_lan_toi_da, ngay_bat_dau, han_su_dung, mo_ta)
VALUES ('TEST-VC6', 'FIXED', 5000, 0, 1, CURRENT_DATE - 1, CURRENT_DATE + 30, 'Voucher thu POS');
