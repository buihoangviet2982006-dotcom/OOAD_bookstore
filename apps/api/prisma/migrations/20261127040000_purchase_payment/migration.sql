-- Chặng 8: nhập hàng + thanh toán NCC qua API.

-- 1) Khóa yêu cầu chống lặp (null với chứng từ cũ và khoản trả trước tạo cùng phiếu nhập).
ALTER TABLE "phieu_nhap" ADD COLUMN "ma_yeu_cau" VARCHAR(64);
CREATE UNIQUE INDEX "phieu_nhap_ma_yeu_cau_key" ON "phieu_nhap"("ma_yeu_cau");

ALTER TABLE "phieu_thanh_toan_ncc" ADD COLUMN "ma_yeu_cau" VARCHAR(64);
CREATE UNIQUE INDEX "phieu_thanh_toan_ncc_ma_yeu_cau_key" ON "phieu_thanh_toan_ncc"("ma_yeu_cau");

-- 2) Số thứ tự chứng từ (không trùng khi lập đồng thời). Mã seed PN-xxxx-2xx / PC-xxxx-0xx không bị đụng.
CREATE SEQUENCE "phieu_nhap_so_thu_tu" START WITH 2000;   -- PN-ddMM-<n>
CREATE SEQUENCE "phieu_chi_so_thu_tu" START WITH 2000;    -- PC-ddMM-<n>
