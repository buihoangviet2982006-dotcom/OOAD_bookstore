import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ChiTietKiemKe, NhanVien, PhieuKiemKe, Sach } from '@prisma/client';
import type { CurrentAccount } from '../auth/auth.types.js';
import { nextDocumentCode } from '../common/document-code.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateStockAdjustmentDto, StockAdjustmentItemDto } from './dto/stock-adjustment.dto.js';

type Db = Prisma.TransactionClient;

const adjustmentInclude = {
  nhanVien: true,
  chiTiets: { include: { sach: true }, orderBy: { maSach: 'asc' } },
} as const;

type AdjustmentWithRelations = PhieuKiemKe & {
  nhanVien: NhanVien;
  chiTiets: (ChiTietKiemKe & { sach: Sach })[];
};

/**
 * Kiểm kê & điều chỉnh kho (đặc tả QLK – gộp "Kiểm kê" và "Lập phiếu điều chỉnh" thành 1 phiếu, áp dụng ngay).
 * 1 transaction:
 *  1. Khóa các dòng sách trong phiếu (`SELECT … FOR UPDATE`, theo thứ tự mã sách) → bán / nhập / kiểm kê
 *     đồng thời phải chờ.
 *  2. So tồn hiện tại với tồn FE thấy lúc mở form: khác → 409, không ghi đè giao dịch mới.
 *  3. Lưu phiếu + chi tiết (tồn hệ thống lấy từ DB, chênh lệch tự tính) và đặt tồn = số thực tế.
 * Một dòng lỗi → cả phiếu không được áp dụng. Không đổi trạng thái sách (ngừng kinh doanh vẫn ngừng).
 * Chống lặp: `requestKey` → `ma_yeu_cau` unique; cùng nội dung → phiếu cũ (không áp dụng lại); khác → 409.
 */
@Injectable()
export class StockAdjustmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.phieuKiemKe.findMany({ include: adjustmentInclude, orderBy: { ngayKiemKe: 'desc' } });
    return rows.map(toStockAdjustment);
  }

  async create(dto: CreateStockAdjustmentDto, staff: CurrentAccount) {
    const existing = await this.findByRequestKey(dto, staff);
    if (existing) return existing;

    validateItems(dto.items);
    try {
      const code = await this.prisma.$transaction((tx) => this.createInTransaction(tx, dto, staff), { timeout: 15_000 });
      const row = await this.prisma.phieuKiemKe.findUniqueOrThrow({ where: { maKiemKe: code }, include: adjustmentInclude });
      return toStockAdjustment(row);
    } catch (error) {
      // Request cùng khóa chạy song song: request sau chờ khóa dòng sách, đến lượt thì tồn đã đổi (409)
      // hoặc vi phạm unique ma_yeu_cau. Nếu khóa đã được lưu → trả phiếu của request trước.
      const replay = await this.findByRequestKey(dto, staff);
      if (replay) return replay;
      throw error;
    }
  }

  private async createInTransaction(tx: Db, dto: CreateStockAdjustmentDto, staff: CurrentAccount): Promise<string> {
    const bookIds = dto.items.map((i) => i.bookId).sort();
    // Khóa dòng sách theo thứ tự cố định (tránh deadlock giữa 2 phiếu cùng sách) và đọc tồn mới nhất.
    const locked = await tx.$queryRaw<{ ma_sach: string; so_luong_ton: number }[]>`
      SELECT "ma_sach", "so_luong_ton" FROM "sach"
      WHERE "ma_sach" IN (${Prisma.join(bookIds)}) ORDER BY "ma_sach" FOR UPDATE`;
    const currentStock = new Map(locked.map((r) => [r.ma_sach, r.so_luong_ton]));

    const missing = bookIds.filter((id) => !currentStock.has(id));
    if (missing.length > 0) throw new BadRequestException(`Sách không tồn tại: ${missing.join(', ')}.`);

    const changed = dto.items.filter((i) => currentStock.get(i.bookId) !== i.systemStock);
    if (changed.length > 0) {
      const detail = changed
        .map((i) => `${i.bookId} (lúc mở form: ${i.systemStock}, hiện tại: ${currentStock.get(i.bookId)})`)
        .join('; ');
      throw new ConflictException(
        `Tồn kho đã thay đổi kể từ lúc mở form: ${detail}. Vui lòng tải lại và kiểm kê lại – phiếu chưa được áp dụng.`,
      );
    }

    const code = await nextDocumentCode(tx, 'KK');
    await tx.phieuKiemKe.create({
      data: {
        maKiemKe: code,
        ghiChu: dto.note ?? null,
        maNV: staff.maNV, // người lập = tài khoản đăng nhập
        maYeuCau: dto.requestKey,
        chiTiets: {
          create: dto.items.map((i) => ({
            maSach: i.bookId,
            soLuongHeThong: currentStock.get(i.bookId)!,
            soLuongThucTe: i.actualStock,
            lyDo: i.reason ?? null,
          })),
        },
      },
    });

    // Cân bằng kho: tồn = số thực tế (chỉ dòng có chênh lệch). Không đụng trạng thái sách.
    for (const i of dto.items) {
      if (i.actualStock !== i.systemStock) {
        await tx.sach.update({ where: { maSach: i.bookId }, data: { soLuongTon: i.actualStock } });
      }
    }
    return code;
  }

  private async findByRequestKey(dto: CreateStockAdjustmentDto, staff: CurrentAccount) {
    const row = await this.prisma.phieuKiemKe.findUnique({ where: { maYeuCau: dto.requestKey }, include: adjustmentInclude });
    if (!row) return null;
    if (row.maNV !== staff.maNV) {
      throw new ConflictException('Khóa yêu cầu đã được dùng cho phiếu của nhân viên khác.');
    }
    const requested = adjustmentContent(dto.items.map((i) => [i.bookId, i.systemStock, i.actualStock]));
    const stored = adjustmentContent(row.chiTiets.map((l) => [l.maSach, l.soLuongHeThong, l.soLuongThucTe]));
    if (requested !== stored) {
      throw new ConflictException(
        `Yêu cầu này đã được lập thành phiếu kiểm kê ${row.maKiemKe} với nội dung khác. ` +
          'Hãy kiểm tra lịch sử kiểm kê; nếu cần lập phiếu mới, mở lại form.',
      );
    }
    return toStockAdjustment(row);
  }
}

/** Không trùng sách trong 1 phiếu; dòng có chênh lệch bắt buộc có lý do. Lỗi → cả phiếu bị từ chối. */
function validateItems(items: StockAdjustmentItemDto[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const i of items) {
    if (seen.has(i.bookId)) duplicates.add(i.bookId);
    seen.add(i.bookId);
  }
  if (duplicates.size > 0) {
    throw new BadRequestException(`Mỗi đầu sách chỉ được kiểm kê 1 dòng trong phiếu (trùng: ${[...duplicates].join(', ')}).`);
  }
  const missingReason = items.filter((i) => i.actualStock !== i.systemStock && !i.reason).map((i) => i.bookId);
  if (missingReason.length > 0) {
    throw new BadRequestException(`Vui lòng nhập lý do chênh lệch cho: ${missingReason.join(', ')}.`);
  }
}

/** Nội dung chuẩn hóa khi gửi lại cùng requestKey: sách, tồn lúc mở form, số thực tế (không so lý do / ghi chú). */
function adjustmentContent(lines: [string, number, number][]) {
  return [...lines]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([book, system, actual]) => `${book}:${system}->${actual}`)
    .join('|');
}

/** Phiếu kiểm kê (DB) → `StockAdjustment` của FE. Chênh lệch = thực tế − hệ thống. */
function toStockAdjustment(row: AdjustmentWithRelations) {
  return {
    id: row.maKiemKe,
    code: row.maKiemKe,
    createdAt: row.ngayKiemKe.toISOString(),
    createdBy: row.nhanVien.hoTen,
    note: row.ghiChu ?? '',
    status: 'APPLIED' as const,
    items: row.chiTiets.map((line) => ({
      bookId: line.maSach,
      sku: line.maSach,
      title: line.sach.tenSach,
      systemStock: line.soLuongHeThong,
      actualStock: line.soLuongThucTe,
      diff: line.soLuongThucTe - line.soLuongHeThong,
      reason: line.lyDo ?? '',
    })),
  };
}
