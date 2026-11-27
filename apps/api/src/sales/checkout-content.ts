import type { ChiTietHoaDon, HoaDon, ThanhToan } from '@prisma/client';
import type { CartDto } from './dto/invoice.dto.js';

/**
 * Nội dung nghiệp vụ của một lần thanh toán, đã chuẩn hóa để so sánh khi gửi lại cùng `requestKey`.
 * Chỉ gồm những gì quyết định hóa đơn: sách + số lượng (gộp dòng trùng, không phụ thuộc thứ tự),
 * khách hàng, CTKM, voucher, phương thức thanh toán và tiền khách đưa (chỉ khi trả tiền mặt).
 * KHÔNG gồm các trường FE gửi nhưng backend bỏ qua (giá, tổng tiền, người lập…), ghi chú, expectedTotal.
 */
export interface CheckoutContent {
  items: string; // "SP001×2|SP005×1" – sắp theo mã sách
  customerId: string | null;
  promotionId: string | null;
  voucherCode: string | null;
  paymentMethod: string;
  amountPaid: number | null;
}

function normalizeItems(entries: [string, number][]): string {
  const totals = new Map<string, number>();
  for (const [bookId, quantity] of entries) totals.set(bookId, (totals.get(bookId) ?? 0) + quantity);
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bookId, quantity]) => `${bookId}×${quantity}`)
    .join('|');
}

/** Nội dung từ yêu cầu (sau ValidationPipe: voucherCode đã viết hoa, trường thừa đã bị loại). */
export function contentOfRequest(dto: CartDto): CheckoutContent {
  return {
    items: normalizeItems(dto.items.map((i) => [i.bookId, i.quantity])),
    customerId: dto.customerId || null,
    promotionId: dto.promotionId || null,
    voucherCode: dto.voucherCode || null,
    paymentMethod: dto.paymentMethod,
    amountPaid: dto.paymentMethod === 'CASH' ? (dto.amountPaid ?? null) : null,
  };
}

/** Nội dung từ hóa đơn đã lưu. */
export function contentOfInvoice(
  invoice: HoaDon & { chiTiets: ChiTietHoaDon[]; thanhToans: ThanhToan[] },
): CheckoutContent {
  const payment = invoice.thanhToans[0];
  return {
    items: normalizeItems(invoice.chiTiets.map((line) => [line.maSach, line.soLuongBan])),
    customerId: invoice.maKH,
    promotionId: invoice.maCTKM,
    voucherCode: invoice.maCode,
    paymentMethod: payment?.phuongThuc ?? '',
    amountPaid:
      payment?.phuongThuc === 'CASH' && payment.tienKhachDua !== null ? Number(payment.tienKhachDua) : null,
  };
}

/** Danh sách các mục khác nhau (rỗng = cùng nội dung). */
export function contentDifferences(a: CheckoutContent, b: CheckoutContent): string[] {
  const labels: Record<keyof CheckoutContent, string> = {
    items: 'sách / số lượng',
    customerId: 'khách hàng',
    promotionId: 'chương trình khuyến mãi',
    voucherCode: 'mã giảm giá',
    paymentMethod: 'phương thức thanh toán',
    amountPaid: 'tiền khách đưa',
  };
  return (Object.keys(labels) as (keyof CheckoutContent)[])
    .filter((key) => a[key] !== b[key])
    .map((key) => labels[key]);
}
