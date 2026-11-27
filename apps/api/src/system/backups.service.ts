import { Injectable } from '@nestjs/common';
import { Prisma, type BanSaoLuu, type NhanVien } from '@prisma/client';
import { STORE_BRANCH, STORE_NAME } from '../auth/auth.constants.js';
import type { CurrentAccount } from '../auth/auth.types.js';
import { nextSequentialCode } from '../common/codes.js';
import { STORE_TIME_ZONE } from '../common/store-time.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateBackupDto } from './dto/account.dto.js';

export const EXPORT_SCOPE =
  'Bản xuất JSON dữ liệu nghiệp vụ (danh mục, sách, khách hàng, nhân viên, NCC, khuyến mãi, hóa đơn, ' +
  'đổi/trả, nhập hàng, thanh toán NCC, kiểm kê, lịch sử sao lưu). Tài khoản chỉ gồm tên đăng nhập, vai trò, ' +
  'trạng thái – KHÔNG có mật khẩu, OTP, phiên đăng nhập hay khóa bí mật. Dùng để lưu trữ / đối chiếu; ' +
  'hệ thống chưa hỗ trợ phục hồi từ tệp này.';

/**
 * Sao lưu = xuất JSON (quyết định review #4). Mỗi lần xuất ghi một dòng `ban_sao_luu` (lịch sử thao tác).
 * Đọc mọi bảng trong một transaction REPEATABLE READ để dữ liệu giữa các bảng nhất quán tại một thời điểm.
 */
@Injectable()
export class BackupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.banSaoLuu.findMany({ include: { nhanVien: true }, orderBy: { ngayTao: 'desc' } });
    return rows.map(toBackupRecord);
  }

  async create(dto: CreateBackupDto, actor: CurrentAccount) {
    return this.prisma.$transaction(
      async (tx) => {
        const data = await exportTables(tx);
        const now = new Date();
        const id = nextSequentialCode('SL', data.banSaoLuu.map((b) => b.maSaoLuu), 4);
        const snapshot = {
          meta: {
            format: 'ooad-bookstore-export',
            version: 1,
            store: `${STORE_NAME} – ${STORE_BRANCH.name}`,
            backupId: id,
            createdAt: now.toISOString(),
            createdBy: `${actor.maNV} – ${actor.nhanVien.hoTen}`,
            scope: EXPORT_SCOPE,
            moneyFormat: 'Số tiền dạng chuỗi thập phân (VNĐ).',
            counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
          },
          data,
        };
        const record = await tx.banSaoLuu.create({
          data: {
            maSaoLuu: id,
            tenTep: `nha-sach-be-bi_export_${fileStamp(now)}.json`,
            ngayTao: now,
            kichThuocByte: Buffer.byteLength(JSON.stringify(snapshot)),
            ghiChu: dto.note ?? 'Xuất JSON thủ công',
            maNV: actor.maNV,
          },
          include: { nhanVien: true },
        });
        return { record: toBackupRecord(record), snapshot };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}

async function exportTables(tx: Prisma.TransactionClient) {
  const [
    theLoai, tacGia, nhaXuatBan, sach, khachHang, nhanVien, taiKhoan, nhaCungCap,
    chuongTrinhKhuyenMai, maGiamGia, hoaDon, chiTietHoaDon, thanhToan, phieuDoiTra, chiTietDoiTra,
    phieuNhap, chiTietPhieuNhap, phieuThanhToanNCC, phieuKiemKe, chiTietKiemKe, banSaoLuu,
  ] = await Promise.all([
    tx.theLoai.findMany(),
    tx.tacGia.findMany(),
    tx.nhaXuatBan.findMany(),
    tx.sach.findMany(),
    tx.khachHang.findMany(),
    tx.nhanVien.findMany(),
    // Chỉ chọn trường không nhạy cảm – loại mat_khau_hash, otp_*, phien_ban, so_lan_sai_mat_khau.
    tx.taiKhoan.findMany({
      select: { maTaiKhoan: true, tenDangNhap: true, emailKhoiPhuc: true, vaiTro: true, trangThai: true, maNV: true, ngayTao: true, lanDangNhapCuoi: true },
    }),
    tx.nhaCungCap.findMany(),
    tx.chuongTrinhKhuyenMai.findMany(),
    tx.maGiamGia.findMany(),
    tx.hoaDon.findMany(),
    tx.chiTietHoaDon.findMany(),
    tx.thanhToan.findMany(),
    tx.phieuDoiTra.findMany(),
    tx.chiTietDoiTra.findMany(),
    tx.phieuNhap.findMany(),
    tx.chiTietPhieuNhap.findMany(),
    tx.phieuThanhToanNCC.findMany(),
    tx.phieuKiemKe.findMany(),
    tx.chiTietKiemKe.findMany(),
    tx.banSaoLuu.findMany(),
  ]);
  return {
    theLoai, tacGia, nhaXuatBan, sach, khachHang, nhanVien, taiKhoan, nhaCungCap,
    chuongTrinhKhuyenMai, maGiamGia, hoaDon, chiTietHoaDon, thanhToan, phieuDoiTra, chiTietDoiTra,
    phieuNhap, chiTietPhieuNhap, phieuThanhToanNCC, phieuKiemKe, chiTietKiemKe, banSaoLuu,
  };
}

/** YYYYMMDD_HHmmss theo giờ cửa hàng. */
function fileStamp(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: STORE_TIME_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}${parts.month}${parts.day}_${parts.hour}${parts.minute}${parts.second}`;
}

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** Bản ghi lịch sử → `BackupRecord` của FE. */
function toBackupRecord(row: BanSaoLuu & { nhanVien: NhanVien }) {
  return {
    id: row.maSaoLuu,
    fileName: row.tenTep,
    createdAt: row.ngayTao.toISOString(),
    createdBy: row.nhanVien.hoTen,
    sizeLabel: sizeLabel(row.kichThuocByte),
    type: 'MANUAL' as const,
    status: 'SUCCESS' as const,
    note: row.ghiChu ?? undefined,
  };
}
