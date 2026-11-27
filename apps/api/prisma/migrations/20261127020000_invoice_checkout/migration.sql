-- Chặng 6: lập hóa đơn qua API.
-- Viết tay từ `prisma migrate diff` để giữ dữ liệu hóa đơn đang có.

-- 1) Tên sách lúc bán: thêm cột cho phép null → điền từ bảng sách cho các dòng cũ → đặt NOT NULL.
ALTER TABLE "chi_tiet_hoa_don" ADD COLUMN "ten_sach" VARCHAR(255);
UPDATE "chi_tiet_hoa_don" AS c SET "ten_sach" = s."ten_sach" FROM "sach" AS s WHERE s."ma_sach" = c."ma_sach";
ALTER TABLE "chi_tiet_hoa_don" ALTER COLUMN "ten_sach" SET NOT NULL;

-- 2) Khóa yêu cầu chống tạo hóa đơn lặp (bấm 2 lần / thử lại). Null với hóa đơn cũ.
ALTER TABLE "hoa_don" ADD COLUMN "ma_yeu_cau" VARCHAR(64);
CREATE UNIQUE INDEX "hoa_don_ma_yeu_cau_key" ON "hoa_don"("ma_yeu_cau");

-- 3) Số thứ tự hóa đơn: sequence của PostgreSQL → mã không trùng kể cả khi lập đồng thời.
--    Bắt đầu từ 2000 để không đụng các mã seed (HD-xxxx-10xx). Prisma schema không mô tả sequence;
--    code đọc bằng nextval('hoa_don_so_thu_tu').
CREATE SEQUENCE "hoa_don_so_thu_tu" START WITH 2000;
