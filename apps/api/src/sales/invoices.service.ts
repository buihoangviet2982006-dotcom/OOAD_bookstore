import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ChuongTrinhKhuyenMai, KhachHang, MaGiamGia, Sach, TheLoai } from '@prisma/client';
import type { CurrentAccount } from '../auth/auth.types.js';
import { nextDocumentCode } from '../common/document-code.js';
import { todayInStore } from '../common/store-time.js';
import { formatDateOnly } from '../common/transforms.js';
import { pointsFor } from '../customers/loyalty.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { calculatePricing, type DiscountOutcome, type PricingResult } from '../promotions/pricing.js';
import { promotionStatus, voucherStatus } from '../promotions/promotion-status.js';
import { contentDifferences, contentOfInvoice, contentOfRequest } from './checkout-content.js';
import type { CartDto, CreateInvoiceDto } from './dto/invoice.dto.js';
import { invoiceInclude, toInvoice } from './invoice.mapper.js';

type Db = Prisma.TransactionClient;
type PromotionRow = ChuongTrinhKhuyenMai & { theLoai: TheLoai | null };

/** Một dòng giỏ hàng sau khi gộp các dòng trùng sách và nạp sách từ DB. */
interface CartLine {
  bookId: string;
  quantity: number;
  book: Sach | null;
}

/** Kết quả kiểm tra giỏ hàng – dùng chung cho xem trước và lập hóa đơn. */
interface CartEvaluation {
  problems: string[];
  lines: CartLine[];
  pricing: PricingResult;
  customer: KhachHang | null;
  promotion: PromotionRow | null;
  voucher: MaGiamGia | null;
}

const vnd = (n: number) => `${new Intl.NumberFormat('vi-VN').format(n)}đ`;

const PROMOTION_STATUS_TEXT: Record<string, string> = {
  SCHEDULED: 'chưa đến ngày áp dụng',
  PAUSED: 'đang tạm dừng',
  CANCELLED: 'đã bị hủy',
  EXPIRED: 'đã kết thúc',
};

const VOUCHER_STATUS_TEXT: Record<string, string> = {
  EXPIRED: 'Mã giảm giá không hợp lệ hoặc đã hết hạn.',
  PAUSED: 'Mã giảm giá đang tạm ngừng.',
  USED_UP: 'Mã giảm giá đã hết lượt sử dụng.',
  SCHEDULED: 'Mã giảm giá chưa đến ngày áp dụng.',
};

/**
 * Bán hàng tại quầy (đặc tả QLBH – Lập hóa đơn và ghi nhận thanh toán, Áp dụng khuyến mãi).
 *
 * - Xem trước: chỉ đọc DB, không ghi gì.
 * - Lập hóa đơn: kiểm tra + tính lại toàn bộ trong MỘT transaction rồi mới ghi:
 *   hóa đơn, chi tiết (giá bán, giá vốn, tên sách, giảm phân bổ), thanh toán, trừ tồn, tăng lượt voucher, cộng điểm.
 * - Đồng thời: trừ tồn và tăng lượt voucher bằng UPDATE có điều kiện (tồn ≥ số mua, lượt < giới hạn) –
 *   giao dịch đến sau bị từ chối và rollback toàn bộ. CHECK constraint trong DB là lớp chặn cuối.
 * - Chống lặp: `requestKey` lưu vào cột unique `ma_yeu_cau`. Gửi lại cùng khóa + cùng nội dung → trả hóa đơn gốc;
 *   cùng khóa nhưng nội dung khác → 409 (checkout-content.ts).
 */
@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.hoaDon.findMany({ include: invoiceInclude, orderBy: { ngayLap: 'desc' } });
    return rows.map(toInvoice);
  }

  async get(id: string) {
    const row = await this.prisma.hoaDon.findUnique({ where: { maHoaDon: id }, include: invoiceInclude });
    if (!row) throw new NotFoundException(`Không tìm thấy hóa đơn "${id}".`);
    return toInvoice(row);
  }

  /** Xem trước – không ghi DB. Vấn đề nghiệp vụ trả trong `messages`, `valid = false`. */
  async preview(dto: CartDto) {
    const evaluation = await this.evaluateCart(this.prisma, dto);
    const { pricing } = evaluation;
    const total = pricing.total;
    const given = dto.paymentMethod === 'CASH' ? dto.amountPaid : undefined;

    return {
      valid: evaluation.problems.length === 0,
      messages: evaluation.problems,
      lines: evaluation.lines.map((line, i) => ({
        bookId: line.bookId,
        sku: line.bookId,
        title: line.book?.tenSach ?? line.bookId,
        quantity: line.quantity,
        unitPrice: line.book ? Number(line.book.giaBan) : 0,
        subtotal: line.book ? line.quantity * Number(line.book.giaBan) : 0,
        discount: pricing.lineDiscounts[i] ?? 0,
        stock: line.book?.soLuongTon ?? 0,
      })),
      subtotal: pricing.subtotal,
      promotion: evaluation.promotion && {
        id: evaluation.promotion.maCTKM,
        name: evaluation.promotion.tenCTKM,
        applied: pricing.promotion?.applied ?? false,
        amount: pricing.promotion?.amount ?? 0,
      },
      voucher: evaluation.voucher && {
        code: evaluation.voucher.maCode,
        applied: pricing.voucher?.applied ?? false,
        amount: pricing.voucher?.amount ?? 0,
      },
      discountAmount: pricing.discountTotal,
      totalAmount: total,
      amountPaid: given ?? total,
      changeAmount: given !== undefined && given >= total ? given - total : 0,
    };
  }

  async create(dto: CreateInvoiceDto, cashier: CurrentAccount) {
    // Gửi lại cùng khóa (bấm 2 lần, thử lại sau lỗi mạng): trả hóa đơn gốc nếu cùng nội dung –
    // không kiểm tra lại tồn / voucher vì giao dịch gốc đã ghi nhận xong.
    const existing = await this.findByRequestKey(dto, cashier);
    if (existing) return existing;

    try {
      const maHoaDon = await this.prisma.$transaction((tx) => this.createInTransaction(tx, dto, cashier), {
        timeout: 15_000,
      });
      return this.get(maHoaDon);
    } catch (error) {
      // Hai request cùng khóa chạy song song: request sau có thể vi phạm unique ma_yeu_cau hoặc gặp lỗi nghiệp vụ
      // do request trước vừa ghi (vd vừa hết tồn). Nếu khóa đã được lưu → trả hóa đơn của request trước.
      const replay = await this.findByRequestKey(dto, cashier);
      if (replay) return replay;
      throw error;
    }
  }

  // ───────────────────────── Lập hóa đơn ─────────────────────────

  private async createInTransaction(tx: Db, dto: CreateInvoiceDto, cashier: CurrentAccount): Promise<string> {
    const evaluation = await this.evaluateCart(tx, dto);
    const { pricing, lines, customer, promotion, voucher } = evaluation;

    const problems = [...evaluation.problems];
    if (dto.paymentMethod === 'CASH' && dto.amountPaid === undefined) {
      problems.push('Vui lòng nhập số tiền khách đưa.');
    }
    if (problems.length > 0) throw new BadRequestException(problems.join(' '));
    if (dto.expectedTotal !== undefined && dto.expectedTotal !== pricing.total) {
      throw new ConflictException(
        `Tổng tiền đã thay đổi (${vnd(dto.expectedTotal)} → ${vnd(pricing.total)}) do giá hoặc khuyến mãi vừa cập nhật. ` +
          'Vui lòng kiểm tra lại giỏ hàng.',
      );
    }

    const maHoaDon = await nextDocumentCode(tx, 'HD');
    await tx.hoaDon.create({
      data: {
        maHoaDon,
        tongTienHang: pricing.subtotal,
        tienGiamCTKM: pricing.promotion?.amount ?? 0,
        tienGiamVoucher: pricing.voucher?.amount ?? 0,
        thanhToanCuoi: pricing.total,
        maKH: customer?.maKH ?? null,
        maNV: cashier.maNV, // người lập = tài khoản đang đăng nhập
        maCTKM: promotion?.maCTKM ?? null,
        maCode: voucher?.maCode ?? null,
        ghiChu: dto.note ?? null,
        maYeuCau: dto.requestKey,
        chiTiets: {
          create: lines.map((line, i) => ({
            maSach: line.bookId,
            tenSach: line.book!.tenSach,
            soLuongBan: line.quantity,
            donGiaBan: line.book!.giaBan,
            giaVon: line.book!.giaNhap,
            giamGia: pricing.lineDiscounts[i],
          })),
        },
        thanhToans: {
          create: {
            maThanhToan: `TT-${maHoaDon}`,
            soTien: pricing.total,
            phuongThuc: dto.paymentMethod,
            // Chuyển khoản / thẻ: ghi nhận tại quầy, không tích hợp cổng thanh toán.
            tienKhachDua: dto.paymentMethod === 'CASH' ? dto.amountPaid : null,
          },
        },
      },
    });

    // Trừ tồn có điều kiện: giao dịch khác vừa mua hết thì điều kiện sai → 0 dòng → rollback.
    for (const line of lines) {
      const { count } = await tx.sach.updateMany({
        where: { maSach: line.bookId, trangThai: 'ACTIVE', soLuongTon: { gte: line.quantity } },
        data: { soLuongTon: { decrement: line.quantity } },
      });
      if (count === 0) {
        throw new ConflictException(
          `Sách ${line.bookId} – ${line.book!.tenSach} vừa không còn đủ tồn kho. Vui lòng kiểm tra lại giỏ hàng.`,
        );
      }
    }

    // Tăng lượt voucher có điều kiện (chưa vượt giới hạn, còn hoạt động).
    if (voucher && pricing.voucher?.applied) {
      const used = await tx.$executeRaw`
        UPDATE "ma_giam_gia" SET "so_lan_da_dung" = "so_lan_da_dung" + 1
        WHERE "ma_code" = ${voucher.maCode} AND "dang_hoat_dong" = true AND "so_lan_da_dung" < "so_lan_toi_da"`;
      if (used === 0) throw new ConflictException(`Mã giảm giá ${voucher.maCode} vừa hết lượt sử dụng.`);
    }

    // Cộng điểm: 1 điểm / 10.000đ thực trả.
    const points = pointsFor(pricing.total);
    if (customer && points > 0) {
      await tx.khachHang.update({ where: { maKH: customer.maKH }, data: { diemTichLuy: { increment: points } } });
    }
    return maHoaDon;
  }

  /**
   * Hóa đơn đã tạo với cùng `requestKey`:
   * - khác người lập → 409;
   * - khác nội dung nghiệp vụ (sách/số lượng, khách, CTKM, voucher, phương thức, tiền khách đưa) → 409,
   *   không trả hóa đơn cũ như một lần thanh toán mới;
   * - cùng nội dung → trả hóa đơn gốc.
   */
  private async findByRequestKey(dto: CreateInvoiceDto, cashier: CurrentAccount) {
    const row = await this.prisma.hoaDon.findUnique({ where: { maYeuCau: dto.requestKey }, include: invoiceInclude });
    if (!row) return null;
    if (row.maNV !== cashier.maNV) {
      throw new ConflictException('Khóa yêu cầu đã được dùng cho hóa đơn của nhân viên khác.');
    }
    const differences = contentDifferences(contentOfRequest(dto), contentOfInvoice(row));
    if (differences.length > 0) {
      throw new ConflictException(
        `Đơn tạm này đã được lập thành hóa đơn ${row.maHoaDon} với nội dung khác (${differences.join(', ')}). ` +
          'Hãy kiểm tra trang Hóa đơn; nếu cần bán tiếp, mở đơn tạm mới.',
      );
    }
    return toInvoice(row);
  }

  // ───────────────────────── Kiểm tra giỏ hàng ─────────────────────────

  /**
   * Đọc giá, tồn, khách hàng, CTKM, voucher từ DB và tính tiền bằng `calculatePricing`.
   * Không ném lỗi nghiệp vụ – gom vào `problems` để preview hiển thị; lập hóa đơn thì từ chối nếu có.
   */
  private async evaluateCart(db: Db, dto: CartDto): Promise<CartEvaluation> {
    const problems: string[] = [];
    const today = todayInStore();

    // Gộp các dòng trùng sách để kiểm tra tồn trên tổng số lượng.
    const quantities = new Map<string, number>();
    for (const item of dto.items) quantities.set(item.bookId, (quantities.get(item.bookId) ?? 0) + item.quantity);

    const books = await db.sach.findMany({ where: { maSach: { in: [...quantities.keys()] } } });
    const lines: CartLine[] = [...quantities].map(([bookId, quantity]) => ({
      bookId,
      quantity,
      book: books.find((b) => b.maSach === bookId) ?? null,
    }));

    for (const { bookId, quantity, book } of lines) {
      if (!book) problems.push(`Sách "${bookId}" không tồn tại.`);
      else if (book.trangThai === 'DISCONTINUED') problems.push(`Sách ${bookId} – ${book.tenSach} đã ngừng kinh doanh.`);
      else if (book.soLuongTon === 0) problems.push(`Sách ${bookId} – ${book.tenSach} hiện đã hết hàng.`);
      else if (quantity > book.soLuongTon) {
        problems.push(`Sách ${bookId} – ${book.tenSach} chỉ còn ${book.soLuongTon} cuốn (yêu cầu ${quantity}).`);
      }
    }

    let customer: KhachHang | null = null;
    if (dto.customerId) {
      customer = await db.khachHang.findUnique({ where: { maKH: dto.customerId } });
      if (!customer) problems.push(`Khách hàng "${dto.customerId}" không tồn tại.`);
    }

    let promotion: PromotionRow | null = null;
    if (dto.promotionId) {
      promotion = await db.chuongTrinhKhuyenMai.findUnique({
        where: { maCTKM: dto.promotionId },
        include: { theLoai: true },
      });
      if (!promotion) {
        problems.push(`Chương trình khuyến mãi "${dto.promotionId}" không tồn tại.`);
      } else {
        const status = promotionStatus(
          promotion.trangThai,
          formatDateOnly(promotion.ngayBatDau),
          formatDateOnly(promotion.ngayKetThuc),
          today,
        );
        if (status !== 'ACTIVE') {
          problems.push(`Chương trình "${promotion.tenCTKM}" ${PROMOTION_STATUS_TEXT[status]}.`);
          promotion = null;
        }
      }
    }

    let voucher: MaGiamGia | null = null;
    if (dto.voucherCode) {
      voucher = await db.maGiamGia.findUnique({ where: { maCode: dto.voucherCode } });
      if (!voucher) {
        problems.push(VOUCHER_STATUS_TEXT.EXPIRED);
      } else {
        const status = voucherStatus(
          {
            isActive: voucher.dangHoatDong,
            usedCount: voucher.soLanDaDung,
            usageLimit: voucher.soLanToiDa,
            startDate: formatDateOnly(voucher.ngayBatDau),
            endDate: formatDateOnly(voucher.hanSuDung),
          },
          today,
        );
        if (status !== 'ACTIVE') {
          problems.push(VOUCHER_STATUS_TEXT[status]);
          voucher = null;
        }
      }
    }

    // Chỉ tính tiền trên các dòng có sách thật (để preview vẫn hiện số tạm).
    const priced = lines.filter((l) => l.book);
    const pricing = calculatePricing(
      priced.map((l) => ({
        bookId: l.bookId,
        categoryId: l.book!.maTheLoai,
        quantity: l.quantity,
        unitPrice: Number(l.book!.giaBan),
      })),
      promotion && {
        type: promotion.loaiGiam,
        value: Number(promotion.giaTriGiam),
        maxDiscount: promotion.giamToiDa === null ? null : Number(promotion.giamToiDa),
        minOrderValue: Number(promotion.donToiThieu),
        categoryId: promotion.maTheLoai,
      },
      voucher && {
        type: voucher.loaiGiam,
        value: Number(voucher.giaTriGiam),
        maxDiscount: voucher.giamToiDa === null ? null : Number(voucher.giamToiDa),
        minOrderValue: Number(voucher.donToiThieu),
      },
    );
    // Phân bổ giảm theo thứ tự `priced`; đưa về thứ tự `lines` (dòng không có sách → 0).
    const lineDiscounts = lines.map((l) => (l.book ? pricing.lineDiscounts[priced.indexOf(l)] : 0));

    if (promotion && pricing.promotion && !pricing.promotion.applied) {
      problems.push(promotionNotAppliedMessage(promotion, pricing.promotion));
    }
    if (voucher && pricing.voucher && !pricing.voucher.applied) {
      problems.push(
        `Đơn hàng chưa đạt giá trị tối thiểu ${vnd(Number(voucher.donToiThieu))} để áp dụng mã ${voucher.maCode}` +
          ' (xét trên số tiền sau khi trừ khuyến mãi).',
      );
    }
    if (dto.paymentMethod === 'CASH' && dto.amountPaid !== undefined && dto.amountPaid < pricing.total) {
      problems.push('Số tiền khách đưa nhỏ hơn tổng tiền cần thanh toán.');
    }

    return { problems, lines, pricing: { ...pricing, lineDiscounts }, customer, promotion, voucher };
  }
}

function promotionNotAppliedMessage(promotion: PromotionRow, outcome: DiscountOutcome): string {
  const scope = promotion.theLoai ? ` thuộc thể loại "${promotion.theLoai.tenTheLoai}"` : '';
  if (!outcome.applied && outcome.reason === 'NO_ELIGIBLE_ITEMS') {
    return `Giỏ hàng không có sách${scope} để áp dụng "${promotion.tenCTKM}".`;
  }
  return `Chưa đạt đơn tối thiểu ${vnd(Number(promotion.donToiThieu))} của "${promotion.tenCTKM}" (tính trên sách${scope || ' trong giỏ'}).`;
}
