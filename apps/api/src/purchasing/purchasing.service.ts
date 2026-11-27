import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CurrentAccount } from '../auth/auth.types.js';
import { nextDocumentCode } from '../common/document-code.js';
import { todayInStore } from '../common/store-time.js';
import { formatDateOnly, toDateOnly } from '../common/transforms.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreatePurchaseOrderDto, CreateSupplierPaymentDto } from './dto/purchasing.dto.js';
import {
  paymentInclude,
  purchaseOrderInclude,
  toPurchaseOrder,
  toSupplierPayment,
} from './purchasing.mapper.js';

type Db = Prisma.TransactionClient;

const vnd = (n: number) => `${new Intl.NumberFormat('vi-VN').format(n)}đ`;

/** Dòng phiếu nhập sau khi gộp dòng trùng sách (cùng giá nhập). */
interface PurchaseLine {
  bookId: string;
  quantity: number;
  importPrice: number;
}

/**
 * Nhập hàng & thanh toán nhà cung cấp (đặc tả QLNH).
 *
 * Lập phiếu nhập – 1 transaction: phiếu + chi tiết, cộng tồn, cập nhật giá nhập hiện tại của sách
 * (giá vốn đã lưu trên hóa đơn cũ không đổi; sách ngừng kinh doanh vẫn giữ trạng thái), và nếu trả trước thì
 * ghi đúng 1 phiếu chi + `da_thanh_toan` = khoản đó (đã trả = Σ phiếu chi, không tính hai lần).
 *
 * Thanh toán – bắt buộc chọn phiếu nhập đúng NCC; NCC ngừng hợp tác vẫn trả được nợ cũ.
 * Cộng `da_thanh_toan` bằng UPDATE có điều kiện (đã trả + số tiền ≤ tổng) → 2 yêu cầu đồng thời không trả vượt nợ.
 *
 * Chống lặp (như hóa đơn / đổi trả): `requestKey` → cột unique `ma_yeu_cau`; cùng người + cùng nội dung
 * → trả chứng từ cũ; khác nội dung / khác người → 409.
 */
@Injectable()
export class PurchasingService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── Phiếu nhập ─────────────────────────

  async listPurchaseOrders() {
    const rows = await this.prisma.phieuNhap.findMany({ include: purchaseOrderInclude, orderBy: { ngayNhap: 'desc' } });
    const today = todayInStore();
    return rows.map((row) => toPurchaseOrder(row, today));
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, staff: CurrentAccount) {
    const existing = await this.findPurchaseOrderByKey(dto, staff);
    if (existing) return existing;

    try {
      const code = await this.prisma.$transaction((tx) => this.createPurchaseOrderInTx(tx, dto, staff), {
        timeout: 15_000,
      });
      const row = await this.prisma.phieuNhap.findUniqueOrThrow({
        where: { maPhieuNhap: code },
        include: purchaseOrderInclude,
      });
      return toPurchaseOrder(row, todayInStore());
    } catch (error) {
      // Request cùng khóa chạy song song: nếu khóa đã được lưu (dù request này lỗi gì) → trả phiếu của request trước.
      const replay = await this.findPurchaseOrderByKey(dto, staff);
      if (replay) return replay;
      throw error;
    }
  }

  private async createPurchaseOrderInTx(tx: Db, dto: CreatePurchaseOrderDto, staff: CurrentAccount) {
    const supplier = await tx.nhaCungCap.findUnique({ where: { maNCC: dto.supplierId } });
    if (!supplier) throw new BadRequestException(`Nhà cung cấp "${dto.supplierId}" không tồn tại.`);
    if (supplier.trangThai !== 'ACTIVE') {
      throw new BadRequestException(`Nhà cung cấp ${supplier.tenNCC} đã ngừng hợp tác, không thể lập phiếu nhập mới.`);
    }

    const lines = mergeLines(dto);
    const books = await tx.sach.findMany({ where: { maSach: { in: lines.map((l) => l.bookId) } } });
    const missing = lines.filter((l) => !books.some((b) => b.maSach === l.bookId)).map((l) => l.bookId);
    if (missing.length > 0) throw new BadRequestException(`Sách không tồn tại: ${missing.join(', ')}.`);

    const total = lines.reduce((s, l) => s + l.quantity * l.importPrice, 0);
    const paid = dto.paidAmount ?? 0;
    if (paid > total) {
      throw new BadRequestException(`Số tiền trả trước (${vnd(paid)}) không được lớn hơn tổng phiếu nhập (${vnd(total)}).`);
    }
    const dueDate = paid < total ? dto.dueDate : null;
    if (paid < total && !dueDate) throw new BadRequestException('Vui lòng nhập hạn trả công nợ cho phần còn nợ.');
    if (dueDate && dueDate < todayInStore()) throw new BadRequestException('Hạn trả công nợ không được ở quá khứ.');

    const code = await nextDocumentCode(tx, 'PN');
    await tx.phieuNhap.create({
      data: {
        maPhieuNhap: code,
        tongTien: total,
        daThanhToan: paid,
        maNCC: supplier.maNCC,
        maNV: staff.maNV, // người lập = tài khoản đăng nhập
        hanThanhToan: dueDate ? toDateOnly(dueDate) : null,
        ghiChu: dto.note ?? null,
        maYeuCau: dto.requestKey,
        chiTiets: {
          create: lines.map((l) => ({ maSach: l.bookId, soLuongNhap: l.quantity, donGiaNhap: l.importPrice })),
        },
      },
    });

    // Cộng tồn + giá nhập hiện tại = giá lô mới nhất. Không đụng trạng thái sách.
    for (const l of lines) {
      await tx.sach.update({
        where: { maSach: l.bookId },
        data: { soLuongTon: { increment: l.quantity }, giaNhap: l.importPrice },
      });
    }

    // Trả trước: đúng 1 phiếu chi (đã tính vào daThanhToan ở trên).
    if (paid > 0) {
      await tx.phieuThanhToanNCC.create({
        data: {
          maThanhToanNCC: await nextDocumentCode(tx, 'PC'),
          soTienThanhToan: paid,
          phuongThuc: dto.prepaymentMethod ?? 'TRANSFER',
          ghiChu: `Thanh toán khi lập phiếu nhập ${code}`,
          maPhieuNhap: code,
          maNV: staff.maNV,
        },
      });
    }
    return code;
  }

  private async findPurchaseOrderByKey(dto: CreatePurchaseOrderDto, staff: CurrentAccount) {
    const row = await this.prisma.phieuNhap.findUnique({
      where: { maYeuCau: dto.requestKey },
      include: { ...purchaseOrderInclude, thanhToans: true },
    });
    if (!row) return null;
    assertSameStaff(row.maNV, staff);
    // Khoản trả trước = phiếu chi tạo cùng phiếu nhập (không có ma_yeu_cau); thanh toán sau qua API luôn có khóa.
    const prepaid = row.thanhToans
      .filter((p) => p.maYeuCau === null)
      .reduce((s, p) => s + Number(p.soTienThanhToan), 0);
    const requested = purchaseContent(dto.supplierId, mergeLines(dto, false), dto.paidAmount ?? 0, dto.dueDate ?? null);
    const stored = purchaseContent(
      row.maNCC,
      row.chiTiets.map((l) => ({ bookId: l.maSach, quantity: l.soLuongNhap, importPrice: Number(l.donGiaNhap) })),
      prepaid,
      row.hanThanhToan ? formatDateOnly(row.hanThanhToan) : null,
    );
    if (requested !== stored) {
      throw new ConflictException(
        `Yêu cầu này đã được lập thành phiếu nhập ${row.maPhieuNhap} với nội dung khác. ` +
          'Hãy kiểm tra danh sách phiếu nhập; nếu cần lập phiếu mới, mở lại form.',
      );
    }
    return toPurchaseOrder(row, todayInStore());
  }

  // ───────────────────────── Thanh toán NCC ─────────────────────────

  async listPayments() {
    const rows = await this.prisma.phieuThanhToanNCC.findMany({ include: paymentInclude, orderBy: { ngayThanhToan: 'desc' } });
    return rows.map(toSupplierPayment);
  }

  async createPayment(dto: CreateSupplierPaymentDto, staff: CurrentAccount) {
    const existing = await this.findPaymentByKey(dto, staff);
    if (existing) return existing;

    try {
      const code = await this.prisma.$transaction((tx) => this.createPaymentInTx(tx, dto, staff), { timeout: 15_000 });
      const row = await this.prisma.phieuThanhToanNCC.findUniqueOrThrow({
        where: { maThanhToanNCC: code },
        include: paymentInclude,
      });
      return toSupplierPayment(row);
    } catch (error) {
      // Request cùng khóa chạy song song: request sau có thể gặp "vượt nợ" (409) vì request trước vừa trả,
      // hoặc vi phạm unique ma_yeu_cau. Nếu khóa đã được lưu → trả phiếu chi của request trước.
      const replay = await this.findPaymentByKey(dto, staff);
      if (replay) return replay;
      throw error;
    }
  }

  private async createPaymentInTx(tx: Db, dto: CreateSupplierPaymentDto, staff: CurrentAccount) {
    const order = await tx.phieuNhap.findUnique({ where: { maPhieuNhap: dto.purchaseOrderId } });
    if (!order) throw new NotFoundException(`Không tìm thấy phiếu nhập "${dto.purchaseOrderId}".`);
    if (order.maNCC !== dto.supplierId) {
      throw new BadRequestException(`Phiếu nhập ${order.maPhieuNhap} không thuộc nhà cung cấp đã chọn.`);
    }
    // NCC ngừng hợp tác vẫn được trả nợ cũ – không kiểm tra trạng thái NCC ở đây.
    const remaining = Number(order.tongTien) - Number(order.daThanhToan);
    if (remaining <= 0) throw new BadRequestException(`Phiếu nhập ${order.maPhieuNhap} đã thanh toán đủ.`);
    if (dto.amount > remaining) {
      throw new BadRequestException(
        `Số tiền thanh toán (${vnd(dto.amount)}) vượt quá số nợ còn lại của phiếu ${order.maPhieuNhap} (${vnd(remaining)}).`,
      );
    }

    // Cộng có điều kiện: giao dịch khác vừa trả thì điều kiện sai → 0 dòng → rollback.
    const updated = await tx.$executeRaw`
      UPDATE "phieu_nhap" SET "da_thanh_toan" = "da_thanh_toan" + ${dto.amount}
      WHERE "ma_phieu_nhap" = ${order.maPhieuNhap} AND "da_thanh_toan" + ${dto.amount} <= "tong_tien"`;
    if (updated === 0) {
      throw new ConflictException(`Phiếu nhập ${order.maPhieuNhap} vừa được thanh toán, số tiền vượt quá nợ còn lại.`);
    }

    const code = await nextDocumentCode(tx, 'PC');
    await tx.phieuThanhToanNCC.create({
      data: {
        maThanhToanNCC: code,
        soTienThanhToan: dto.amount,
        phuongThuc: dto.paymentMethod,
        ghiChu: dto.note ?? null,
        maPhieuNhap: order.maPhieuNhap,
        maNV: staff.maNV, // người ghi nhận = tài khoản đăng nhập
        maYeuCau: dto.requestKey,
      },
    });
    return code;
  }

  private async findPaymentByKey(dto: CreateSupplierPaymentDto, staff: CurrentAccount) {
    const row = await this.prisma.phieuThanhToanNCC.findUnique({ where: { maYeuCau: dto.requestKey }, include: paymentInclude });
    if (!row) return null;
    assertSameStaff(row.maNV, staff);
    const requested = [dto.supplierId, dto.purchaseOrderId, dto.amount, dto.paymentMethod].join('#');
    const stored = [row.phieuNhap.maNCC, row.maPhieuNhap, Number(row.soTienThanhToan), row.phuongThuc].join('#');
    if (requested !== stored) {
      throw new ConflictException(
        `Yêu cầu này đã được ghi thành phiếu chi ${row.maThanhToanNCC} với nội dung khác. ` +
          'Hãy kiểm tra lịch sử thanh toán; nếu cần ghi khoản mới, mở lại form.',
      );
    }
    return toSupplierPayment(row);
  }
}

// ───────────────────────── Hàm hỗ trợ ─────────────────────────

/**
 * Gộp dòng trùng sách cùng giá nhập; trùng sách khác giá → lỗi rõ ràng (mỗi phiếu 1 dòng / sách).
 * `strict = false`: chỉ chuẩn hóa để so nội dung khi gửi lại cùng requestKey.
 */
function mergeLines(dto: CreatePurchaseOrderDto, strict = true): PurchaseLine[] {
  const merged = new Map<string, PurchaseLine>();
  for (const item of dto.items) {
    const current = merged.get(item.bookId);
    if (!current) {
      merged.set(item.bookId, { bookId: item.bookId, quantity: item.quantity, importPrice: item.importPrice });
    } else if (current.importPrice === item.importPrice || !strict) {
      current.quantity += item.quantity;
    } else {
      throw new BadRequestException(
        `Sách ${item.bookId} xuất hiện nhiều dòng với giá nhập khác nhau – vui lòng gộp thành 1 dòng.`,
      );
    }
  }
  return [...merged.values()];
}

function purchaseContent(supplierId: string, lines: PurchaseLine[], paid: number, dueDate: string | null) {
  const items = [...lines]
    .sort((a, b) => a.bookId.localeCompare(b.bookId))
    .map((l) => `${l.bookId}×${l.quantity}@${l.importPrice}`)
    .join('|');
  // Hạn chỉ có ý nghĩa khi còn nợ (khi trả đủ, backend lưu null).
  const total = lines.reduce((s, l) => s + l.quantity * l.importPrice, 0);
  return [supplierId, items, paid, paid < total ? dueDate : null].join('#');
}

function assertSameStaff(owner: string, staff: CurrentAccount) {
  if (owner !== staff.maNV) throw new ConflictException('Khóa yêu cầu đã được dùng cho chứng từ của nhân viên khác.');
}
