-- Chặng 9: kiểm kê / điều chỉnh kho qua API.

-- 1) Khóa yêu cầu chống áp dụng một phiếu nhiều lần (null với phiếu cũ).
ALTER TABLE "phieu_kiem_ke" ADD COLUMN "ma_yeu_cau" VARCHAR(64);
CREATE UNIQUE INDEX "phieu_kiem_ke_ma_yeu_cau_key" ON "phieu_kiem_ke"("ma_yeu_cau");

-- 2) Số thứ tự phiếu kiểm kê KK-ddMM-<n> (mã seed KK-2011-009 không bị đụng).
CREATE SEQUENCE "phieu_kiem_ke_so_thu_tu" START WITH 2000;
