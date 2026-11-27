import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ChiTietDoiTra, ChiTietHoaDon, HoaDon, PhieuDoiTra, Sach } from '@prisma/client';
import type { CurrentAccount } from '../auth/auth.types.js';
import { nextDocumentCode } from '../common/document-code.js';
import { todayInStore } from '../common/store-time.js';
import { pointsFor } from '../customers/loyalty.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateReturnDto, ReturnPreviewDto } from './dto/return.dto.js';
import { isWithinReturnWindow, returnCredit, returnDeadline, settle } from './refund.js';
import { returnInclude, toReturnOrder } from './return.mapper.js';

type Db = Prisma.TransactionClient;
type InvoiceForReturn = HoaDon & {
  chiTiets: ChiTietHoaDon[];
  doiTras: (PhieuDoiTra & { chiTiets: ChiTietDoiTra[] })[];
};

/** Một dòng trả sau khi gộp, kèm dòng hóa đơn gốc và giá trị tính được. */
interface ReturnLine {
  bookId: string;
  quantity: number;
  condition: string;
  invoiceLine: ChiTietHoaDon | null;
  alreadyReturned: number;
  value: number;
}

interface ReturnEvaluation {
  problems: string[];
  invoice: InvoiceForReturn;
  deadline: string;
  lines: ReturnLine[];
  exchangeBook: Sach | null;
  returnedValue: number;
  newBooksValue: number;
  refund: number;
  extraPayment: number;
}

const vnDate = (ymd: string) => ymd.split('-').reverse().join('/');

/**
 * Đổi / trả hàng (đặc tả QLBH – Quản lý trả hàng / đổi hàng).
 * - Chỉ trên hóa đơn gốc, trong 7 ngày (lịch Việt Nam), sách thuộc hóa đơn, không vượt số còn được trả.
 * - Giá trị sách trả tính từ tiền thực trả đã lưu ở dòng hóa đơn gốc (refund.ts) – không dùng giá / CTKM hiện tại.
 * - Đổi hàng: sách mới phải đang kinh doanh và đủ tồn; giá sách mới = giá bán hiện tại (không áp khuyến mãi).
 * - Một transaction: phiếu + chi tiết, cộng tồn sách nhận lại (không tự mở kinh doanh lại sách đã ngừng),
 *   trừ tồn sách đổi ra (UPDATE có điều kiện), trạng thái hóa đơn, điểm khách.
 * - Đồng thời: khóa dòng hóa đơn gốc (SELECT … FOR UPDATE) → các phiếu cùng hóa đơn chạy lần lượt.
 * - Chống lặp: `requestKey` → cột unique `ma_yeu_cau`; cùng nội dung trả phiếu cũ, khác nội dung → 409.
 */
@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.phieuDoiTra.findMany({ include: returnInclude, orderBy: { ngayDoiTra: 'desc' } });
    return rows.map(toReturnOrder);
  }

  /** Xem trước – không ghi DB. */
  async preview(dto: ReturnPreviewDto) {
    const e = await this.evaluate(this.prisma, dto);
    return {
      valid: e.problems.length === 0,
      messages: e.problems,
      deadline: e.deadline,
      lines: e.lines.map((l) => ({
        bookId: l.bookId,
        title: l.invoiceLine?.tenSach ?? l.bookId,
        quantity: l.quantity,
        purchasedQuantity: l.invoiceLine?.soLuongBan ?? 0,
        alreadyReturned: l.alreadyReturned,
        value: l.value,
      })),
      returnedValue: e.returnedValue,
      exchangeBook: e.exchangeBook && {
        id: e.exchangeBook.maSach,
        title: e.exchangeBook.tenSach,
        unitPrice: Number(e.exchangeBook.giaBan),
        stock: e.exchangeBook.soLuongTon,
      },
      newBooksValue: e.newBooksValue,
      refundAmount: e.refund,
      extraPayment: e.extraPayment,
    };
  }

  async create(dto: CreateReturnDto, staff: CurrentAccount) {
    const existing = await this.findByRequestKey(dto, staff);
    if (existing) return existing;

    try {
      const code = await this.prisma.$transaction((tx) => this.createInTransaction(tx, dto, staff), {
        timeout: 15_000,
      });
      const row = await this.prisma.phieuDoiTra.findUniqueOrThrow({ where: { maDoiTra: code }, include: returnInclude });
      return toReturnOrder(row);
    } catch (error) {
      // Request cùng khóa chạy song song: request sau chờ khóa hóa đơn, đến lượt có thể báo "đã trả hết" (400)
      // hoặc vi phạm unique ma_yeu_cau. Nếu khóa đã được lưu → trả phiếu của request trước.
      const replay = await this.findByRequestKey(dto, staff);
      if (replay) return replay;
      throw error;
    }
  }

  // ───────────────────────── Lập phiếu ─────────────────────────

  private async createInTransaction(tx: Db, dto: CreateReturnDto, staff: CurrentAccount): Promise<string> {
    // Khóa hóa đơn gốc: phiếu đổi/trả khác của cùng hóa đơn phải chờ → không trả vượt số còn lại.
    const locked = await tx.$queryRaw<{ ma_hoa_don: string }[]>`
      SELECT "ma_hoa_don" FROM "hoa_don" WHERE "ma_hoa_don" = ${dto.invoiceId} FOR UPDATE`;
    if (locked.length === 0) throw new NotFoundException(`Không tìm thấy hóa đơn "${dto.invoiceId}".`);

    const e = await this.evaluate(tx, dto);
    if (e.problems.length > 0) throw new BadRequestException(e.problems.join(' '));

    if (
      (dto.expectedRefundAmount !== undefined && dto.expectedRefundAmount !== e.refund) ||
      (dto.expectedExtraPayment !== undefined && dto.expectedExtraPayment !== e.extraPayment)
    ) {
      throw new ConflictException('Số tiền đổi/trả đã thay đổi. Vui lòng xem preview mới và xác nhận lại.');
    }

    const code = await nextDocumentCode(tx, 'DT');
    const exchange = e.exchangeBook;
    await tx.phieuDoiTra.create({
      data: {
        maDoiTra: code,
        lyDo: dto.reason,
        hinhThucXuLy: dto.type,
        tienHoanTra: e.refund,
        tienKhachBu: e.extraPayment,
        maHoaDon: e.invoice.maHoaDon,
        maNV: staff.maNV, // người xử lý = tài khoản đăng nhập
        maYeuCau: dto.requestKey,
        chiTiets: {
          create: e.lines.map((l) => ({
            maSach: l.bookId,
            soLuongTra: l.quantity,
            tinhTrangSach: l.condition,
            donGiaHoan: Math.round((l.value / l.quantity) * 100) / 100,
            giaTriTra: l.value,
            maSachDoi: exchange?.maSach ?? null,
            donGiaSachDoi: exchange?.giaBan ?? null,
            giaVonSachDoi: exchange?.giaNhap ?? null,
          })),
        },
      },
    });

    // Cộng lại tồn sách nhận về – chỉ đổi số lượng, KHÔNG đổi trạng thái (sách đã ngừng vẫn ngừng).
    for (const l of e.lines) {
      await tx.sach.update({ where: { maSach: l.bookId }, data: { soLuongTon: { increment: l.quantity } } });
    }

    // Trừ tồn sách đổi ra có điều kiện (đang kinh doanh, đủ tồn).
    if (exchange) {
      const quantity = totalQuantity(e.lines);
      const { count } = await tx.sach.updateMany({
        where: { maSach: exchange.maSach, trangThai: 'ACTIVE', soLuongTon: { gte: quantity } },
        data: { soLuongTon: { decrement: quantity } },
      });
      if (count === 0) throw new ConflictException('Sách muốn đổi hiện không đủ tồn kho.');
    }

    // Trạng thái hóa đơn theo tổng số đã xử lý đổi/trả.
    const fullyReturned = e.invoice.chiTiets.every((line) => {
      const thisTime = e.lines.find((l) => l.bookId === line.maSach)?.quantity ?? 0;
      return returnedQuantity(e.invoice, line.maSach) + thisTime >= line.soLuongBan;
    });
    await tx.hoaDon.update({
      where: { maHoaDon: e.invoice.maHoaDon },
      data: { trangThai: fullyReturned ? 'RETURNED' : 'PARTIAL_RETURN' },
    });

    // Điểm: tính lại theo giá trị thực trả của hóa đơn (trước / sau phiếu này) và chỉ cộng/trừ phần chênh –
    // không trừ lặp, không lệch do làm tròn qua nhiều lần đổi/trả. Không để điểm âm.
    if (e.invoice.maKH) {
      const before = invoiceNetValue(e.invoice);
      const delta = pointsFor(before + e.extraPayment - e.refund) - pointsFor(before);
      if (delta !== 0) {
        await tx.$executeRaw`
          UPDATE "khach_hang" SET "diem_tich_luy" = GREATEST("diem_tich_luy" + ${delta}, 0)
          WHERE "ma_kh" = ${e.invoice.maKH}`;
      }
    }
    return code;
  }

  /** Cùng khóa: cùng người + cùng nội dung → phiếu cũ; khác nội dung / khác người → 409. */
  private async findByRequestKey(dto: CreateReturnDto, staff: CurrentAccount) {
    const row = await this.prisma.phieuDoiTra.findUnique({ where: { maYeuCau: dto.requestKey }, include: returnInclude });
    if (!row) return null;
    if (row.maNV !== staff.maNV) {
      throw new ConflictException('Khóa yêu cầu đã được dùng cho phiếu của nhân viên khác.');
    }
    const requested = normalizeContent(
      dto.invoiceId,
      dto.type,
      dto.returnItems.map((i) => [i.bookId, i.quantity]),
      dto.type === 'EXCHANGE' ? (dto.exchangeBookId ?? null) : null,
    );
    const stored = normalizeContent(
      row.maHoaDon,
      row.hinhThucXuLy,
      row.chiTiets.map((l) => [l.maSach, l.soLuongTra]),
      row.chiTiets.find((l) => l.maSachDoi)?.maSachDoi ?? null,
    );
    if (requested !== stored) {
      throw new ConflictException(
        `Yêu cầu này đã được lập thành phiếu ${row.maDoiTra} với nội dung khác. ` +
          'Hãy kiểm tra danh sách phiếu đổi/trả; nếu cần lập phiếu mới, mở lại form.',
      );
    }
    return toReturnOrder(row);
  }

  // ───────────────────────── Kiểm tra & tính tiền ─────────────────────────

  private async evaluate(db: Db, dto: ReturnPreviewDto): Promise<ReturnEvaluation> {
    const invoice = await db.hoaDon.findUnique({
      where: { maHoaDon: dto.invoiceId },
      include: { chiTiets: true, doiTras: { include: { chiTiets: true } } },
    });
    if (!invoice) throw new NotFoundException(`Không tìm thấy hóa đơn "${dto.invoiceId}".`);

    const problems: string[] = [];
    const deadline = returnDeadline(invoice.ngayLap);
    if (!isWithinReturnWindow(invoice.ngayLap, todayInStore())) {
      problems.push(`Hóa đơn đã quá thời hạn đổi/trả cho phép (hạn đến hết ngày ${vnDate(deadline)}).`);
    }

    // Gộp các dòng trùng sách.
    const merged = new Map<string, { quantity: number; condition: string }>();
    for (const item of dto.returnItems) {
      const current = merged.get(item.bookId);
      merged.set(item.bookId, {
        quantity: (current?.quantity ?? 0) + item.quantity,
        condition: current?.condition ?? item.condition ?? 'Không ghi nhận',
      });
    }

    const lines: ReturnLine[] = [];
    for (const [bookId, { quantity, condition }] of merged) {
      const invoiceLine = invoice.chiTiets.find((l) => l.maSach === bookId) ?? null;
      const alreadyReturned = returnedQuantity(invoice, bookId);
      let value = 0;
      if (!invoiceLine) {
        problems.push(`Sách "${bookId}" không có trong hóa đơn ${invoice.maHoaDon}.`);
      } else {
        const remaining = invoiceLine.soLuongBan - alreadyReturned;
        if (remaining <= 0) {
          problems.push(`Sách ${bookId} – ${invoiceLine.tenSach} đã được đổi/trả hết.`);
        } else if (quantity > remaining) {
          problems.push(
            `Sách ${bookId} – ${invoiceLine.tenSach} chỉ còn ${remaining} cuốn được trả ` +
              `(đã mua ${invoiceLine.soLuongBan}, đã đổi/trả ${alreadyReturned}).`,
          );
        } else {
          value = returnCredit(lineNetValue(invoiceLine), invoiceLine.soLuongBan, alreadyReturned, quantity);
        }
      }
      lines.push({ bookId, quantity, condition, invoiceLine, alreadyReturned, value });
    }

    let exchangeBook: Sach | null = null;
    const quantity = totalQuantity(lines);
    if (dto.type === 'RETURN' && dto.exchangeBookId) {
      problems.push('Trả hàng hoàn tiền không chọn sách đổi.');
    }
    if (dto.type === 'EXCHANGE') {
      if (!dto.exchangeBookId) {
        problems.push('Vui lòng chọn sách muốn đổi sang.');
      } else {
        exchangeBook = await db.sach.findUnique({ where: { maSach: dto.exchangeBookId } });
        // Sách nhận lại cùng mã được cộng tồn trước khi trừ → tính vào tồn khả dụng.
        const sameBookBack = lines.find((l) => l.bookId === dto.exchangeBookId)?.quantity ?? 0;
        if (!exchangeBook) problems.push(`Sách muốn đổi "${dto.exchangeBookId}" không tồn tại.`);
        else if (exchangeBook.trangThai === 'DISCONTINUED') {
          problems.push(`Sách ${exchangeBook.maSach} – ${exchangeBook.tenSach} đã ngừng kinh doanh, không thể đổi sang.`);
        } else if (exchangeBook.soLuongTon + sameBookBack < quantity) {
          problems.push('Sách muốn đổi hiện không đủ tồn kho.');
        }
      }
    }

    const returnedValue = lines.reduce((s, l) => s + l.value, 0);
    const newBooksValue = exchangeBook ? Number(exchangeBook.giaBan) * quantity : 0;
    const { refund, extraPayment } = settle(dto.type, returnedValue, newBooksValue);
    return { problems, invoice, deadline, lines, exchangeBook, returnedValue, newBooksValue, refund, extraPayment };
  }
}

// ───────────────────────── Hàm hỗ trợ ─────────────────────────

/** Tiền thực trả của một dòng hóa đơn = số lượng × đơn giá − giảm đã phân bổ (số đã lưu). */
function lineNetValue(line: ChiTietHoaDon): number {
  return line.soLuongBan * Number(line.donGiaBan) - Number(line.giamGia);
}

/** Tổng số cuốn của một sách đã đổi/trả qua các phiếu trước của hóa đơn. */
function returnedQuantity(invoice: InvoiceForReturn, maSach: string): number {
  return invoice.doiTras.flatMap((r) => r.chiTiets).filter((l) => l.maSach === maSach).reduce((s, l) => s + l.soLuongTra, 0);
}

/** Giá trị thực trả của hóa đơn tính đến hiện tại = thanh toán cuối + khách bù − đã hoàn. */
function invoiceNetValue(invoice: InvoiceForReturn): number {
  return invoice.doiTras.reduce(
    (sum, r) => sum + Number(r.tienKhachBu) - Number(r.tienHoanTra),
    Number(invoice.thanhToanCuoi),
  );
}

const totalQuantity = (lines: { quantity: number }[]) => lines.reduce((s, l) => s + l.quantity, 0);

/** Nội dung nghiệp vụ chuẩn hóa để so khi gửi lại cùng requestKey (không gồm lý do / tình trạng). */
function normalizeContent(invoiceId: string, type: string, items: [string, number][], exchangeBookId: string | null) {
  const totals = new Map<string, number>();
  for (const [bookId, quantity] of items) totals.set(bookId, (totals.get(bookId) ?? 0) + quantity);
  const itemText = [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([b, q]) => `${b}×${q}`).join('|');
  return [invoiceId, type, itemText, exchangeBookId ?? '-'].join('#');
}
