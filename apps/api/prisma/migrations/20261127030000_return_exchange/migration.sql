-- Chặng 7: đổi / trả hàng qua API.
-- Viết tay từ `prisma migrate diff` để giữ dữ liệu phiếu đổi/trả đang có.

-- 1) Giá trị thực của phần sách trả (đồng). Dòng cũ: = đơn giá hoàn × số lượng trả.
ALTER TABLE "chi_tiet_doi_tra" ADD COLUMN "gia_tri_tra" DECIMAL(14,2);
UPDATE "chi_tiet_doi_tra" SET "gia_tri_tra" = "don_gia_hoan" * "so_luong_tra";
ALTER TABLE "chi_tiet_doi_tra" ALTER COLUMN "gia_tri_tra" SET NOT NULL;
ALTER TABLE "chi_tiet_doi_tra" ADD CONSTRAINT "ct_doi_tra_gia_tri_tra_khong_am" CHECK ("gia_tri_tra" >= 0);

-- 2) Giá vốn sách đổi ra. Dòng cũ có sách đổi: lấy giá nhập hiện tại của sách đó (dữ liệu seed).
ALTER TABLE "chi_tiet_doi_tra" ADD COLUMN "gia_von_sach_doi" DECIMAL(14,2);
UPDATE "chi_tiet_doi_tra" AS c SET "gia_von_sach_doi" = s."gia_nhap"
FROM "sach" AS s WHERE s."ma_sach" = c."ma_sach_doi";

-- 3) Khóa yêu cầu chống lập phiếu lặp. Null với phiếu cũ.
ALTER TABLE "phieu_doi_tra" ADD COLUMN "ma_yeu_cau" VARCHAR(64);
CREATE UNIQUE INDEX "phieu_doi_tra_ma_yeu_cau_key" ON "phieu_doi_tra"("ma_yeu_cau");

-- 4) Số thứ tự phiếu đổi/trả: DT-ddMM-<n>, bắt đầu 3000 (không đụng mã seed DT-2511-2001).
CREATE SEQUENCE "phieu_doi_tra_so_thu_tu" START WITH 3000;
