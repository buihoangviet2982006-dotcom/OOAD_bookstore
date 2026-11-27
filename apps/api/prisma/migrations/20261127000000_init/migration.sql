-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VaiTro" AS ENUM ('MANAGER', 'SALES', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "TrangThaiNhanVien" AS ENUM ('WORKING', 'ON_LEAVE', 'RESIGNED');

-- CreateEnum
CREATE TYPE "TrangThaiTaiKhoan" AS ENUM ('ACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "TrangThaiSach" AS ENUM ('ACTIVE', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "TrangThaiNhaCungCap" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LoaiGiamGia" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "PhuongThucThanhToan" AS ENUM ('CASH', 'TRANSFER', 'CARD');

-- CreateEnum
CREATE TYPE "TrangThaiHoaDon" AS ENUM ('COMPLETED', 'PARTIAL_RETURN', 'RETURNED');

-- CreateEnum
CREATE TYPE "HinhThucDoiTra" AS ENUM ('RETURN', 'EXCHANGE');

-- CreateTable
CREATE TABLE "nhan_vien" (
    "ma_nv" VARCHAR(50) NOT NULL,
    "ho_ten" VARCHAR(150) NOT NULL,
    "so_dien_thoai" VARCHAR(20) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "dia_chi" TEXT,
    "ngay_vao_lam" DATE NOT NULL,
    "bo_phan" "VaiTro" NOT NULL,
    "chuc_vu" VARCHAR(150) NOT NULL,
    "luong_co_ban" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "trang_thai" "TrangThaiNhanVien" NOT NULL DEFAULT 'WORKING',

    CONSTRAINT "nhan_vien_pkey" PRIMARY KEY ("ma_nv")
);

-- CreateTable
CREATE TABLE "tai_khoan" (
    "ma_tai_khoan" VARCHAR(50) NOT NULL,
    "ten_dang_nhap" VARCHAR(100) NOT NULL,
    "mat_khau_hash" TEXT NOT NULL,
    "email_khoi_phuc" VARCHAR(150) NOT NULL,
    "trang_thai" "TrangThaiTaiKhoan" NOT NULL DEFAULT 'ACTIVE',
    "vai_tro" "VaiTro" NOT NULL,
    "ma_nv" VARCHAR(50) NOT NULL,
    "so_lan_sai_mat_khau" INTEGER NOT NULL DEFAULT 0,
    "phien_ban" INTEGER NOT NULL DEFAULT 0,
    "otp_hash" TEXT,
    "otp_het_han" TIMESTAMPTZ(3),
    "otp_so_lan_sai" INTEGER NOT NULL DEFAULT 0,
    "lan_dang_nhap_cuoi" TIMESTAMPTZ(3),
    "ngay_tao" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tai_khoan_pkey" PRIMARY KEY ("ma_tai_khoan")
);

-- CreateTable
CREATE TABLE "the_loai" (
    "ma_the_loai" VARCHAR(50) NOT NULL,
    "ten_the_loai" VARCHAR(150) NOT NULL,
    "mo_ta" TEXT,

    CONSTRAINT "the_loai_pkey" PRIMARY KEY ("ma_the_loai")
);

-- CreateTable
CREATE TABLE "tac_gia" (
    "ma_tac_gia" VARCHAR(50) NOT NULL,
    "ten_tac_gia" VARCHAR(150) NOT NULL,
    "tieu_su" TEXT,
    "quoc_tich" VARCHAR(100),

    CONSTRAINT "tac_gia_pkey" PRIMARY KEY ("ma_tac_gia")
);

-- CreateTable
CREATE TABLE "nha_xuat_ban" (
    "ma_nxb" VARCHAR(50) NOT NULL,
    "ten_nxb" VARCHAR(200) NOT NULL,
    "dia_chi" TEXT,
    "so_dien_thoai" VARCHAR(20),
    "email" VARCHAR(150),

    CONSTRAINT "nha_xuat_ban_pkey" PRIMARY KEY ("ma_nxb")
);

-- CreateTable
CREATE TABLE "sach" (
    "ma_sach" VARCHAR(50) NOT NULL,
    "isbn" VARCHAR(50) NOT NULL,
    "ten_sach" VARCHAR(255) NOT NULL,
    "nam_xuat_ban" INTEGER,
    "gia_nhap" DECIMAL(14,2) NOT NULL,
    "gia_ban" DECIMAL(14,2) NOT NULL,
    "so_luong_ton" INTEGER NOT NULL DEFAULT 0,
    "muc_ton_toi_thieu" INTEGER NOT NULL DEFAULT 0,
    "trang_thai" "TrangThaiSach" NOT NULL DEFAULT 'ACTIVE',
    "ma_the_loai" VARCHAR(50) NOT NULL,
    "ma_nxb" VARCHAR(50) NOT NULL,
    "ma_tac_gia" VARCHAR(50) NOT NULL,
    "vi_tri_ke" VARCHAR(100),
    "mo_ta" TEXT,

    CONSTRAINT "sach_pkey" PRIMARY KEY ("ma_sach")
);

-- CreateTable
CREATE TABLE "khach_hang" (
    "ma_kh" VARCHAR(50) NOT NULL,
    "ho_ten" VARCHAR(150) NOT NULL,
    "so_dien_thoai" VARCHAR(20) NOT NULL,
    "email" VARCHAR(150),
    "diem_tich_luy" INTEGER NOT NULL DEFAULT 0,
    "dia_chi" TEXT,
    "ghi_chu" TEXT,
    "ngay_tao" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dang_hoat_dong" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "khach_hang_pkey" PRIMARY KEY ("ma_kh")
);

-- CreateTable
CREATE TABLE "chuong_trinh_khuyen_mai" (
    "ma_ctkm" VARCHAR(50) NOT NULL,
    "ten_ctkm" VARCHAR(200) NOT NULL,
    "ngay_bat_dau" DATE NOT NULL,
    "ngay_ket_thuc" DATE NOT NULL,
    "loai_giam" "LoaiGiamGia" NOT NULL,
    "gia_tri_giam" DECIMAL(14,2) NOT NULL,
    "giam_toi_da" DECIMAL(14,2),
    "don_toi_thieu" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ma_the_loai" VARCHAR(50),
    "mo_ta" TEXT,
    "da_ngung" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "chuong_trinh_khuyen_mai_pkey" PRIMARY KEY ("ma_ctkm")
);

-- CreateTable
CREATE TABLE "ma_giam_gia" (
    "ma_code" VARCHAR(50) NOT NULL,
    "loai_giam" "LoaiGiamGia" NOT NULL,
    "gia_tri_giam" DECIMAL(14,2) NOT NULL,
    "giam_toi_da" DECIMAL(14,2),
    "don_toi_thieu" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "so_lan_toi_da" INTEGER NOT NULL,
    "so_lan_da_dung" INTEGER NOT NULL DEFAULT 0,
    "ngay_bat_dau" DATE NOT NULL,
    "han_su_dung" DATE NOT NULL,
    "dang_hoat_dong" BOOLEAN NOT NULL DEFAULT true,
    "mo_ta" TEXT,

    CONSTRAINT "ma_giam_gia_pkey" PRIMARY KEY ("ma_code")
);

-- CreateTable
CREATE TABLE "hoa_don" (
    "ma_hoa_don" VARCHAR(50) NOT NULL,
    "ngay_lap" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tong_tien_hang" DECIMAL(14,2) NOT NULL,
    "tien_giam_ctkm" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tien_giam_voucher" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "thanh_toan_cuoi" DECIMAL(14,2) NOT NULL,
    "trang_thai" "TrangThaiHoaDon" NOT NULL DEFAULT 'COMPLETED',
    "ma_kh" VARCHAR(50),
    "ma_nv" VARCHAR(50) NOT NULL,
    "ma_code" VARCHAR(50),
    "ma_ctkm" VARCHAR(50),
    "ghi_chu" TEXT,

    CONSTRAINT "hoa_don_pkey" PRIMARY KEY ("ma_hoa_don")
);

-- CreateTable
CREATE TABLE "chi_tiet_hoa_don" (
    "ma_hoa_don" VARCHAR(50) NOT NULL,
    "ma_sach" VARCHAR(50) NOT NULL,
    "so_luong_ban" INTEGER NOT NULL,
    "don_gia_ban" DECIMAL(14,2) NOT NULL,
    "giam_gia" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gia_von" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "chi_tiet_hoa_don_pkey" PRIMARY KEY ("ma_hoa_don","ma_sach")
);

-- CreateTable
CREATE TABLE "thanh_toan" (
    "ma_thanh_toan" VARCHAR(50) NOT NULL,
    "ngay_thanh_toan" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "so_tien" DECIMAL(14,2) NOT NULL,
    "phuong_thuc" "PhuongThucThanhToan" NOT NULL,
    "trang_thai" VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
    "tien_khach_dua" DECIMAL(14,2),
    "ma_hoa_don" VARCHAR(50) NOT NULL,

    CONSTRAINT "thanh_toan_pkey" PRIMARY KEY ("ma_thanh_toan")
);

-- CreateTable
CREATE TABLE "phieu_doi_tra" (
    "ma_doi_tra" VARCHAR(50) NOT NULL,
    "ngay_doi_tra" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ly_do" TEXT NOT NULL,
    "hinh_thuc_xu_ly" "HinhThucDoiTra" NOT NULL,
    "tien_hoan_tra" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tien_khach_bu" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ma_hoa_don" VARCHAR(50) NOT NULL,
    "ma_nv" VARCHAR(50) NOT NULL,

    CONSTRAINT "phieu_doi_tra_pkey" PRIMARY KEY ("ma_doi_tra")
);

-- CreateTable
CREATE TABLE "chi_tiet_doi_tra" (
    "ma_doi_tra" VARCHAR(50) NOT NULL,
    "ma_sach" VARCHAR(50) NOT NULL,
    "so_luong_tra" INTEGER NOT NULL,
    "tinh_trang_sach" VARCHAR(100) NOT NULL,
    "don_gia_hoan" DECIMAL(14,2) NOT NULL,
    "ma_sach_doi" VARCHAR(50),
    "don_gia_sach_doi" DECIMAL(14,2),

    CONSTRAINT "chi_tiet_doi_tra_pkey" PRIMARY KEY ("ma_doi_tra","ma_sach")
);

-- CreateTable
CREATE TABLE "nha_cung_cap" (
    "ma_ncc" VARCHAR(50) NOT NULL,
    "ten_ncc" VARCHAR(200) NOT NULL,
    "so_dien_thoai" VARCHAR(20) NOT NULL,
    "email" VARCHAR(150),
    "dia_chi" TEXT,
    "ma_so_thue" VARCHAR(20),
    "nguoi_lien_he" VARCHAR(150),
    "trang_thai" "TrangThaiNhaCungCap" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "nha_cung_cap_pkey" PRIMARY KEY ("ma_ncc")
);

-- CreateTable
CREATE TABLE "phieu_nhap" (
    "ma_phieu_nhap" VARCHAR(50) NOT NULL,
    "ngay_nhap" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tong_tien" DECIMAL(14,2) NOT NULL,
    "da_thanh_toan" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ma_ncc" VARCHAR(50) NOT NULL,
    "ma_nv" VARCHAR(50) NOT NULL,
    "han_thanh_toan" DATE,
    "ghi_chu" TEXT,

    CONSTRAINT "phieu_nhap_pkey" PRIMARY KEY ("ma_phieu_nhap")
);

-- CreateTable
CREATE TABLE "chi_tiet_phieu_nhap" (
    "ma_phieu_nhap" VARCHAR(50) NOT NULL,
    "ma_sach" VARCHAR(50) NOT NULL,
    "so_luong_nhap" INTEGER NOT NULL,
    "don_gia_nhap" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "chi_tiet_phieu_nhap_pkey" PRIMARY KEY ("ma_phieu_nhap","ma_sach")
);

-- CreateTable
CREATE TABLE "phieu_thanh_toan_ncc" (
    "ma_thanh_toan_ncc" VARCHAR(50) NOT NULL,
    "ngay_thanh_toan" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "so_tien_thanh_toan" DECIMAL(14,2) NOT NULL,
    "phuong_thuc" "PhuongThucThanhToan" NOT NULL,
    "ghi_chu" TEXT,
    "ma_phieu_nhap" VARCHAR(50) NOT NULL,
    "ma_nv" VARCHAR(50) NOT NULL,

    CONSTRAINT "phieu_thanh_toan_ncc_pkey" PRIMARY KEY ("ma_thanh_toan_ncc")
);

-- CreateTable
CREATE TABLE "phieu_kiem_ke" (
    "ma_kiem_ke" VARCHAR(50) NOT NULL,
    "ngay_kiem_ke" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ghi_chu" TEXT,
    "ma_nv" VARCHAR(50) NOT NULL,

    CONSTRAINT "phieu_kiem_ke_pkey" PRIMARY KEY ("ma_kiem_ke")
);

-- CreateTable
CREATE TABLE "chi_tiet_kiem_ke" (
    "ma_kiem_ke" VARCHAR(50) NOT NULL,
    "ma_sach" VARCHAR(50) NOT NULL,
    "so_luong_he_thong" INTEGER NOT NULL,
    "so_luong_thuc_te" INTEGER NOT NULL,
    "ly_do" TEXT,

    CONSTRAINT "chi_tiet_kiem_ke_pkey" PRIMARY KEY ("ma_kiem_ke","ma_sach")
);

-- CreateTable
CREATE TABLE "ban_sao_luu" (
    "ma_sao_luu" VARCHAR(50) NOT NULL,
    "ten_tep" VARCHAR(255) NOT NULL,
    "ngay_tao" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kich_thuoc_byte" INTEGER NOT NULL,
    "ghi_chu" TEXT,
    "ma_nv" VARCHAR(50) NOT NULL,

    CONSTRAINT "ban_sao_luu_pkey" PRIMARY KEY ("ma_sao_luu")
);

-- CreateIndex
CREATE UNIQUE INDEX "nhan_vien_so_dien_thoai_key" ON "nhan_vien"("so_dien_thoai");

-- CreateIndex
CREATE UNIQUE INDEX "nhan_vien_email_key" ON "nhan_vien"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tai_khoan_ten_dang_nhap_key" ON "tai_khoan"("ten_dang_nhap");

-- CreateIndex
CREATE UNIQUE INDEX "tai_khoan_email_khoi_phuc_key" ON "tai_khoan"("email_khoi_phuc");

-- CreateIndex
CREATE UNIQUE INDEX "tai_khoan_ma_nv_key" ON "tai_khoan"("ma_nv");

-- CreateIndex
CREATE UNIQUE INDEX "the_loai_ten_the_loai_key" ON "the_loai"("ten_the_loai");

-- CreateIndex
CREATE UNIQUE INDEX "sach_isbn_key" ON "sach"("isbn");

-- CreateIndex
CREATE INDEX "sach_ma_the_loai_idx" ON "sach"("ma_the_loai");

-- CreateIndex
CREATE UNIQUE INDEX "khach_hang_so_dien_thoai_key" ON "khach_hang"("so_dien_thoai");

-- CreateIndex
CREATE INDEX "hoa_don_ngay_lap_idx" ON "hoa_don"("ngay_lap");

-- CreateIndex
CREATE INDEX "hoa_don_ma_kh_idx" ON "hoa_don"("ma_kh");

-- CreateIndex
CREATE INDEX "thanh_toan_ma_hoa_don_idx" ON "thanh_toan"("ma_hoa_don");

-- CreateIndex
CREATE INDEX "phieu_doi_tra_ngay_doi_tra_idx" ON "phieu_doi_tra"("ngay_doi_tra");

-- CreateIndex
CREATE INDEX "phieu_doi_tra_ma_hoa_don_idx" ON "phieu_doi_tra"("ma_hoa_don");

-- CreateIndex
CREATE UNIQUE INDEX "nha_cung_cap_so_dien_thoai_key" ON "nha_cung_cap"("so_dien_thoai");

-- CreateIndex
CREATE INDEX "phieu_nhap_ma_ncc_idx" ON "phieu_nhap"("ma_ncc");

-- CreateIndex
CREATE INDEX "phieu_nhap_ngay_nhap_idx" ON "phieu_nhap"("ngay_nhap");

-- CreateIndex
CREATE INDEX "phieu_thanh_toan_ncc_ma_phieu_nhap_idx" ON "phieu_thanh_toan_ncc"("ma_phieu_nhap");

-- AddForeignKey
ALTER TABLE "tai_khoan" ADD CONSTRAINT "tai_khoan_ma_nv_fkey" FOREIGN KEY ("ma_nv") REFERENCES "nhan_vien"("ma_nv") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sach" ADD CONSTRAINT "sach_ma_the_loai_fkey" FOREIGN KEY ("ma_the_loai") REFERENCES "the_loai"("ma_the_loai") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sach" ADD CONSTRAINT "sach_ma_nxb_fkey" FOREIGN KEY ("ma_nxb") REFERENCES "nha_xuat_ban"("ma_nxb") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sach" ADD CONSTRAINT "sach_ma_tac_gia_fkey" FOREIGN KEY ("ma_tac_gia") REFERENCES "tac_gia"("ma_tac_gia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chuong_trinh_khuyen_mai" ADD CONSTRAINT "chuong_trinh_khuyen_mai_ma_the_loai_fkey" FOREIGN KEY ("ma_the_loai") REFERENCES "the_loai"("ma_the_loai") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hoa_don" ADD CONSTRAINT "hoa_don_ma_kh_fkey" FOREIGN KEY ("ma_kh") REFERENCES "khach_hang"("ma_kh") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hoa_don" ADD CONSTRAINT "hoa_don_ma_nv_fkey" FOREIGN KEY ("ma_nv") REFERENCES "nhan_vien"("ma_nv") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hoa_don" ADD CONSTRAINT "hoa_don_ma_code_fkey" FOREIGN KEY ("ma_code") REFERENCES "ma_giam_gia"("ma_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hoa_don" ADD CONSTRAINT "hoa_don_ma_ctkm_fkey" FOREIGN KEY ("ma_ctkm") REFERENCES "chuong_trinh_khuyen_mai"("ma_ctkm") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chi_tiet_hoa_don" ADD CONSTRAINT "chi_tiet_hoa_don_ma_hoa_don_fkey" FOREIGN KEY ("ma_hoa_don") REFERENCES "hoa_don"("ma_hoa_don") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chi_tiet_hoa_don" ADD CONSTRAINT "chi_tiet_hoa_don_ma_sach_fkey" FOREIGN KEY ("ma_sach") REFERENCES "sach"("ma_sach") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thanh_toan" ADD CONSTRAINT "thanh_toan_ma_hoa_don_fkey" FOREIGN KEY ("ma_hoa_don") REFERENCES "hoa_don"("ma_hoa_don") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phieu_doi_tra" ADD CONSTRAINT "phieu_doi_tra_ma_hoa_don_fkey" FOREIGN KEY ("ma_hoa_don") REFERENCES "hoa_don"("ma_hoa_don") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phieu_doi_tra" ADD CONSTRAINT "phieu_doi_tra_ma_nv_fkey" FOREIGN KEY ("ma_nv") REFERENCES "nhan_vien"("ma_nv") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chi_tiet_doi_tra" ADD CONSTRAINT "chi_tiet_doi_tra_ma_doi_tra_fkey" FOREIGN KEY ("ma_doi_tra") REFERENCES "phieu_doi_tra"("ma_doi_tra") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chi_tiet_doi_tra" ADD CONSTRAINT "chi_tiet_doi_tra_ma_sach_fkey" FOREIGN KEY ("ma_sach") REFERENCES "sach"("ma_sach") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chi_tiet_doi_tra" ADD CONSTRAINT "chi_tiet_doi_tra_ma_sach_doi_fkey" FOREIGN KEY ("ma_sach_doi") REFERENCES "sach"("ma_sach") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phieu_nhap" ADD CONSTRAINT "phieu_nhap_ma_ncc_fkey" FOREIGN KEY ("ma_ncc") REFERENCES "nha_cung_cap"("ma_ncc") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phieu_nhap" ADD CONSTRAINT "phieu_nhap_ma_nv_fkey" FOREIGN KEY ("ma_nv") REFERENCES "nhan_vien"("ma_nv") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chi_tiet_phieu_nhap" ADD CONSTRAINT "chi_tiet_phieu_nhap_ma_phieu_nhap_fkey" FOREIGN KEY ("ma_phieu_nhap") REFERENCES "phieu_nhap"("ma_phieu_nhap") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chi_tiet_phieu_nhap" ADD CONSTRAINT "chi_tiet_phieu_nhap_ma_sach_fkey" FOREIGN KEY ("ma_sach") REFERENCES "sach"("ma_sach") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phieu_thanh_toan_ncc" ADD CONSTRAINT "phieu_thanh_toan_ncc_ma_phieu_nhap_fkey" FOREIGN KEY ("ma_phieu_nhap") REFERENCES "phieu_nhap"("ma_phieu_nhap") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phieu_thanh_toan_ncc" ADD CONSTRAINT "phieu_thanh_toan_ncc_ma_nv_fkey" FOREIGN KEY ("ma_nv") REFERENCES "nhan_vien"("ma_nv") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phieu_kiem_ke" ADD CONSTRAINT "phieu_kiem_ke_ma_nv_fkey" FOREIGN KEY ("ma_nv") REFERENCES "nhan_vien"("ma_nv") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chi_tiet_kiem_ke" ADD CONSTRAINT "chi_tiet_kiem_ke_ma_kiem_ke_fkey" FOREIGN KEY ("ma_kiem_ke") REFERENCES "phieu_kiem_ke"("ma_kiem_ke") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chi_tiet_kiem_ke" ADD CONSTRAINT "chi_tiet_kiem_ke_ma_sach_fkey" FOREIGN KEY ("ma_sach") REFERENCES "sach"("ma_sach") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ban_sao_luu" ADD CONSTRAINT "ban_sao_luu_ma_nv_fkey" FOREIGN KEY ("ma_nv") REFERENCES "nhan_vien"("ma_nv") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Ràng buộc CHECK (viết tay – Prisma schema không biểu diễn được).
-- Là lớp bảo vệ cuối; service vẫn kiểm tra và trả lỗi dễ hiểu trước.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "sach"
  ADD CONSTRAINT "sach_so_luong_ton_khong_am" CHECK ("so_luong_ton" >= 0),
  ADD CONSTRAINT "sach_muc_ton_toi_thieu_khong_am" CHECK ("muc_ton_toi_thieu" >= 0),
  ADD CONSTRAINT "sach_gia_khong_am" CHECK ("gia_nhap" >= 0 AND "gia_ban" >= 0);

ALTER TABLE "khach_hang"
  ADD CONSTRAINT "khach_hang_diem_khong_am" CHECK ("diem_tich_luy" >= 0);

ALTER TABLE "chuong_trinh_khuyen_mai"
  ADD CONSTRAINT "ctkm_khoang_ngay_hop_le" CHECK ("ngay_ket_thuc" >= "ngay_bat_dau"),
  ADD CONSTRAINT "ctkm_gia_tri_giam_duong" CHECK ("gia_tri_giam" > 0 AND "don_toi_thieu" >= 0);

ALTER TABLE "ma_giam_gia"
  ADD CONSTRAINT "ma_giam_gia_khoang_ngay_hop_le" CHECK ("han_su_dung" >= "ngay_bat_dau"),
  ADD CONSTRAINT "ma_giam_gia_gia_tri_giam_duong" CHECK ("gia_tri_giam" > 0 AND "don_toi_thieu" >= 0),
  ADD CONSTRAINT "ma_giam_gia_so_lan_hop_le" CHECK ("so_lan_toi_da" > 0 AND "so_lan_da_dung" BETWEEN 0 AND "so_lan_toi_da");

ALTER TABLE "hoa_don"
  ADD CONSTRAINT "hoa_don_giam_gia_khong_am" CHECK ("tien_giam_ctkm" >= 0 AND "tien_giam_voucher" >= 0),
  ADD CONSTRAINT "hoa_don_thanh_toan_cuoi_dung" CHECK (
    "thanh_toan_cuoi" >= 0
    AND "thanh_toan_cuoi" = "tong_tien_hang" - "tien_giam_ctkm" - "tien_giam_voucher"
  );

ALTER TABLE "chi_tiet_hoa_don"
  ADD CONSTRAINT "ct_hoa_don_so_luong_duong" CHECK ("so_luong_ban" > 0),
  ADD CONSTRAINT "ct_hoa_don_gia_khong_am" CHECK ("don_gia_ban" >= 0 AND "giam_gia" >= 0 AND "gia_von" >= 0);

ALTER TABLE "phieu_doi_tra"
  ADD CONSTRAINT "phieu_doi_tra_tien_khong_am" CHECK ("tien_hoan_tra" >= 0 AND "tien_khach_bu" >= 0);

ALTER TABLE "chi_tiet_doi_tra"
  ADD CONSTRAINT "ct_doi_tra_so_luong_duong" CHECK ("so_luong_tra" > 0),
  ADD CONSTRAINT "ct_doi_tra_gia_khong_am" CHECK ("don_gia_hoan" >= 0);

ALTER TABLE "phieu_nhap"
  ADD CONSTRAINT "phieu_nhap_da_thanh_toan_hop_le" CHECK ("da_thanh_toan" >= 0 AND "da_thanh_toan" <= "tong_tien");

ALTER TABLE "chi_tiet_phieu_nhap"
  ADD CONSTRAINT "ct_phieu_nhap_so_luong_duong" CHECK ("so_luong_nhap" > 0),
  ADD CONSTRAINT "ct_phieu_nhap_gia_khong_am" CHECK ("don_gia_nhap" >= 0);

ALTER TABLE "phieu_thanh_toan_ncc"
  ADD CONSTRAINT "thanh_toan_ncc_so_tien_duong" CHECK ("so_tien_thanh_toan" > 0);

ALTER TABLE "chi_tiet_kiem_ke"
  ADD CONSTRAINT "ct_kiem_ke_so_luong_khong_am" CHECK ("so_luong_he_thong" >= 0 AND "so_luong_thuc_te" >= 0);
