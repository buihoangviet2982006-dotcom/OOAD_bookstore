import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ChuongTrinhKhuyenMai, MaGiamGia, TheLoai, TrangThaiCTKM } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { todayInStore } from '../common/store-time.js';
import { formatDateOnly, toDateOnly } from '../common/transforms.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PromotionDto, VoucherDto } from './dto/promotion.dto.js';
import { promotionStatus, voucherStatus } from './promotion-status.js';

const ALL_CATEGORIES_LABEL = 'Tất cả thể loại';

type PromotionRow = ChuongTrinhKhuyenMai & { theLoai: TheLoai | null };

/**
 * Quản lý khuyến mãi (đặc tả QLKM): chương trình khuyến mãi (CTKM) và mã giảm giá (voucher).
 * - Trạng thái hiển thị suy ra theo ngày giờ cửa hàng (promotion-status.ts).
 * - Sửa chương trình không ảnh hưởng hóa đơn cũ: hóa đơn đã lưu số tiền giảm riêng.
 * - Số lượt đã dùng voucher và lịch sử sử dụng chỉ đến từ hóa đơn, không nhận từ payload.
 */
@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── Chương trình khuyến mãi ─────────────────────────

  /** `onlyUsable` (vai trò SALES): chỉ trả CTKM đang diễn ra – thông tin POS cần. */
  async listPromotions(onlyUsable: boolean) {
    const rows = await this.prisma.chuongTrinhKhuyenMai.findMany({
      include: { theLoai: true },
      orderBy: { ngayBatDau: 'desc' },
    });
    const today = todayInStore();
    const result = rows.map((row) => toPromotion(row, today));
    return onlyUsable ? result.filter((p) => p.status === 'ACTIVE') : result;
  }

  async createPromotion(dto: PromotionDto) {
    if (!dto.code) throw new BadRequestException('Vui lòng nhập mã chương trình.');
    if (await this.prisma.chuongTrinhKhuyenMai.findUnique({ where: { maCTKM: dto.code } })) {
      throw new ConflictException(`Mã chương trình "${dto.code}" đã tồn tại.`);
    }
    if (dto.status === 'CANCELLED') throw new BadRequestException('Không thể tạo chương trình ở trạng thái đã hủy.');
    await this.validatePromotion(dto);

    const created = await this.prisma.chuongTrinhKhuyenMai.create({
      data: { maCTKM: dto.code, ...promotionData(dto), trangThai: dto.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE' },
      include: { theLoai: true },
    });
    return toPromotion(created, todayInStore());
  }

  /**
   * Sửa thông tin hoặc đổi trạng thái (FE gửi đủ object kèm `status`).
   * Đã hủy / đã kết thúc → không cho sửa (đặc tả: "vui lòng tạo mới").
   */
  async updatePromotion(id: string, dto: PromotionDto) {
    const current = await this.prisma.chuongTrinhKhuyenMai.findUnique({ where: { maCTKM: id } });
    if (!current) throw new NotFoundException(`Không tìm thấy chương trình "${id}".`);

    const today = todayInStore();
    const status = promotionStatus(current.trangThai, formatDateOnly(current.ngayBatDau), formatDateOnly(current.ngayKetThuc), today);
    if (status === 'CANCELLED' || status === 'EXPIRED') {
      throw new BadRequestException(
        'Không thể chỉnh sửa chương trình đã kết thúc hoặc đã hủy, vui lòng tạo chương trình mới.',
      );
    }
    if (dto.code && dto.code !== id) throw new BadRequestException('Không thể đổi mã chương trình đã tạo.');
    await this.validatePromotion(dto);

    const updated = await this.prisma.chuongTrinhKhuyenMai.update({
      where: { maCTKM: id },
      data: { ...promotionData(dto), trangThai: nextStoredStatus(current.trangThai, dto.status) },
      include: { theLoai: true },
    });
    return toPromotion(updated, today);
  }

  /** Use case "Kiểm tra dữ liệu khuyến mãi". */
  private async validatePromotion(dto: PromotionDto) {
    validateDiscount(dto);
    if (dto.applicableCategoryId) {
      const category = await this.prisma.theLoai.findUnique({ where: { maTheLoai: dto.applicableCategoryId } });
      if (!category) throw new BadRequestException(`Thể loại "${dto.applicableCategoryId}" không tồn tại.`);
    }
  }

  // ───────────────────────── Voucher ─────────────────────────

  /** `onlyUsable` (vai trò SALES): chỉ trả voucher đang dùng được ở quầy. */
  async listVouchers(onlyUsable: boolean) {
    const rows = await this.prisma.maGiamGia.findMany({ orderBy: { hanSuDung: 'desc' } });
    const today = todayInStore();
    const result = rows.map((row) => toVoucher(row, today));
    return onlyUsable ? result.filter((v) => v.status === 'ACTIVE') : result;
  }

  async createVoucher(dto: VoucherDto) {
    const code = dto.code || (await this.generateVoucherCode());
    if (await this.prisma.maGiamGia.findUnique({ where: { maCode: code } })) {
      throw new ConflictException(`Mã voucher "${code}" đã tồn tại, vui lòng nhập mã khác.`);
    }
    validateDiscount(dto);

    const created = await this.prisma.maGiamGia.create({
      data: { maCode: code, ...voucherData(dto), dangHoatDong: dto.isActive ?? true },
    });
    return toVoucher(created, todayInStore());
  }

  /** Sửa voucher hoặc bật/tắt (FE gửi đủ object). Voucher đã hết hạn chỉ được xem. */
  async updateVoucher(id: string, dto: VoucherDto) {
    const current = await this.prisma.maGiamGia.findUnique({ where: { maCode: id } });
    if (!current) throw new NotFoundException(`Không tìm thấy voucher "${id}".`);

    const today = todayInStore();
    if (today > formatDateOnly(current.hanSuDung)) {
      throw new BadRequestException('Voucher đã hết hạn, chỉ được xem thông tin.');
    }
    if (dto.code && dto.code !== id) throw new BadRequestException('Không thể đổi mã voucher đã phát hành.');
    validateDiscount(dto);
    if (dto.usageLimit < current.soLanDaDung) {
      throw new BadRequestException(
        `Số lượt dùng tối đa không được nhỏ hơn số lượt đã dùng (${current.soLanDaDung}).`,
      );
    }

    const updated = await this.prisma.maGiamGia.update({
      where: { maCode: id },
      data: { ...voucherData(dto), dangHoatDong: dto.isActive ?? current.dangHoatDong },
    });
    return toVoucher(updated, today);
  }

  /** Lịch sử sử dụng voucher – lấy từ hóa đơn thật đã áp dụng mã. */
  async listVoucherUsages(code?: string) {
    const invoices = await this.prisma.hoaDon.findMany({
      where: code ? { maCode: code.toUpperCase() } : { maCode: { not: null } },
      include: { khachHang: true },
      orderBy: { ngayLap: 'desc' },
    });
    return invoices.map((invoice) => ({
      id: invoice.maHoaDon,
      voucherCode: invoice.maCode!,
      invoiceCode: invoice.maHoaDon,
      customerName: invoice.khachHang?.hoTen ?? 'Khách lẻ',
      usedAt: invoice.ngayLap.toISOString(),
      discountAmount: Number(invoice.tienGiamVoucher),
      orderTotal: Number(invoice.thanhToanCuoi),
    }));
  }

  /** Sinh mã ngẫu nhiên 8 ký tự (bỏ các ký tự dễ nhầm), thử lại nếu trùng. */
  private async generateVoucherCode(): Promise<string> {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = Array.from(randomBytes(8), (b) => alphabet[b % alphabet.length]).join('');
      if (!(await this.prisma.maGiamGia.findUnique({ where: { maCode: code } }))) return code;
    }
    throw new ConflictException('Không sinh được mã voucher, vui lòng nhập mã thủ công.');
  }
}

// ───────────────────────── Quy tắc dùng chung ─────────────────────────

/** Ràng buộc chéo của các trường giảm giá (đặc tả QLKM – Kiểm tra dữ liệu khuyến mãi / voucher). */
function validateDiscount(dto: PromotionDto | VoucherDto) {
  if (dto.discountType === 'PERCENT' && (dto.discountValue < 1 || dto.discountValue > 100)) {
    throw new BadRequestException('Mức giảm theo phần trăm phải từ 1% đến 100%.');
  }
  if (dto.discountType === 'FIXED' && !Number.isInteger(dto.discountValue)) {
    throw new BadRequestException('Mức giảm cố định phải là số nguyên (VNĐ).');
  }
  if (dto.discountType === 'FIXED' && dto.maxDiscountAmount) {
    throw new BadRequestException('Mức giảm tối đa chỉ dùng cho giảm theo phần trăm.');
  }
  if (dto.endDate < dto.startDate) {
    throw new BadRequestException('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.');
  }
  if (dto.endDate < todayInStore()) {
    throw new BadRequestException('Ngày kết thúc đã qua – không thể lưu chương trình/voucher đã hết hạn.');
  }
}

/** Trạng thái lưu tiếp theo theo yêu cầu FE. EXPIRED (suy ra) hoặc thiếu → giữ nguyên. */
function nextStoredStatus(current: TrangThaiCTKM, requested: PromotionDto['status']): TrangThaiCTKM {
  switch (requested) {
    case 'ACTIVE':
    case 'SCHEDULED':
      return 'ACTIVE'; // tiếp tục / bật lại
    case 'PAUSED':
      return 'PAUSED';
    case 'CANCELLED':
      return 'CANCELLED'; // trạng thái cuối
    default:
      return current;
  }
}

function promotionData(dto: PromotionDto) {
  return {
    tenCTKM: dto.name,
    moTa: dto.description ?? null,
    loaiGiam: dto.discountType,
    giaTriGiam: dto.discountValue,
    giamToiDa: dto.discountType === 'PERCENT' ? (dto.maxDiscountAmount ?? null) : null,
    donToiThieu: dto.minOrderValue,
    maTheLoai: dto.applicableCategoryId ?? null,
    ngayBatDau: toDateOnly(dto.startDate),
    ngayKetThuc: toDateOnly(dto.endDate),
  };
}

function voucherData(dto: VoucherDto) {
  return {
    moTa: dto.description ?? null,
    loaiGiam: dto.discountType,
    giaTriGiam: dto.discountValue,
    giamToiDa: dto.discountType === 'PERCENT' ? (dto.maxDiscountAmount ?? null) : null,
    donToiThieu: dto.minOrderValue,
    soLanToiDa: dto.usageLimit,
    ngayBatDau: toDateOnly(dto.startDate),
    hanSuDung: toDateOnly(dto.endDate),
  };
}

/** CTKM (DB) → `PromotionCampaign` của FE (+ applicableCategoryId). */
function toPromotion(row: PromotionRow, today: string) {
  const startDate = formatDateOnly(row.ngayBatDau);
  const endDate = formatDateOnly(row.ngayKetThuc);
  return {
    id: row.maCTKM,
    code: row.maCTKM,
    name: row.tenCTKM,
    description: row.moTa ?? '',
    discountType: row.loaiGiam,
    discountValue: Number(row.giaTriGiam),
    maxDiscountAmount: row.giamToiDa === null ? undefined : Number(row.giamToiDa),
    minOrderValue: Number(row.donToiThieu),
    applicableCategory: row.theLoai?.tenTheLoai ?? ALL_CATEGORIES_LABEL,
    applicableCategoryId: row.maTheLoai ?? '',
    startDate,
    endDate,
    status: promotionStatus(row.trangThai, startDate, endDate, today),
  };
}

/** Voucher (DB) → `Voucher` của FE (+ status suy ra). */
function toVoucher(row: MaGiamGia, today: string) {
  const voucher = {
    id: row.maCode,
    code: row.maCode,
    description: row.moTa ?? '',
    discountType: row.loaiGiam,
    discountValue: Number(row.giaTriGiam),
    maxDiscountAmount: row.giamToiDa === null ? undefined : Number(row.giamToiDa),
    minOrderValue: Number(row.donToiThieu),
    usageLimit: row.soLanToiDa,
    usedCount: row.soLanDaDung,
    startDate: formatDateOnly(row.ngayBatDau),
    endDate: formatDateOnly(row.hanSuDung),
    isActive: row.dangHoatDong,
  };
  return { ...voucher, status: voucherStatus(voucher, today) };
}
