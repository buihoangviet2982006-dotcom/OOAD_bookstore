-- Chặng 5: trạng thái CTKM phân biệt Tạm dừng (PAUSED, tiếp tục được) và Hủy (CANCELLED, trạng thái cuối).
-- Viết tay từ `prisma migrate diff` để GIỮ dữ liệu cũ: da_ngung = true → CANCELLED, còn lại → ACTIVE.

-- CreateEnum
CREATE TYPE "TrangThaiCTKM" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- Thêm cột mới (mặc định ACTIVE cho mọi dòng hiện có)
ALTER TABLE "chuong_trinh_khuyen_mai"
ADD COLUMN "trang_thai" "TrangThaiCTKM" NOT NULL DEFAULT 'ACTIVE';

-- Chuyển dữ liệu: chương trình đã ngưng trước đây → CANCELLED
UPDATE "chuong_trinh_khuyen_mai" SET "trang_thai" = 'CANCELLED' WHERE "da_ngung" = true;

-- Bỏ cột cũ
ALTER TABLE "chuong_trinh_khuyen_mai" DROP COLUMN "da_ngung";
