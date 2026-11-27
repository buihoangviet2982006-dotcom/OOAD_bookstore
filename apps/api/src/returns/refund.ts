import { todayInStore } from '../common/store-time.js';

/** Hạn đổi/trả: 7 ngày (quy tắc chọn cho demo – quyết định review #7). */
export const RETURN_WINDOW_DAYS = 7;

/**
 * Hạn chót đổi/trả (YYYY-MM-DD, lịch Việt Nam): ngày lập hóa đơn theo giờ Việt Nam + 7 ngày,
 * được đổi/trả đến hết ngày đó. Vd hóa đơn 20/11 (kể cả 23:59) → hạn hết ngày 27/11.
 */
export function returnDeadline(invoiceDate: Date): string {
  const day = new Date(`${todayInStore(invoiceDate)}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + RETURN_WINDOW_DAYS);
  return day.toISOString().slice(0, 10);
}

/** Còn trong hạn đổi/trả tại ngày `today` (YYYY-MM-DD giờ Việt Nam)? */
export function isWithinReturnWindow(invoiceDate: Date, today: string = todayInStore()): boolean {
  return today <= returnDeadline(invoiceDate);
}

/**
 * Giá trị (đồng) của `quantity` cuốn trả lại từ một dòng hóa đơn, tính LŨY KẾ trên tiền thực trả của dòng:
 *   phần(k) = làm tròn xuống(thực trả × k / số mua)
 *   giá trị lần này = phần(đã trả + quantity) − phần(đã trả)
 * - thực trả của dòng = số lượng × đơn giá − giảm giá đã phân bổ (đọc từ hóa đơn gốc, không dùng giá hiện tại);
 * - trả một dòng qua nhiều lần: tổng các lần = phần(tổng đã trả) ≤ thực trả;
 * - trả hết: tổng = phần(số mua) = đúng toàn bộ thực trả (không thiếu / dư đồng nào do làm tròn).
 * Dùng BigInt để tích không mất chính xác.
 */
export function returnCredit(lineNet: number, soldQuantity: number, alreadyReturned: number, quantity: number): number {
  if (quantity <= 0 || alreadyReturned < 0 || alreadyReturned + quantity > soldQuantity) {
    throw new Error(`Số lượng trả không hợp lệ (${alreadyReturned} + ${quantity} / ${soldQuantity}).`);
  }
  const portion = (count: number) => (BigInt(lineNet) * BigInt(count)) / BigInt(soldQuantity);
  return Number(portion(alreadyReturned + quantity) - portion(alreadyReturned));
}

/**
 * Quyết toán phiếu:
 * - Trả hàng: hoàn = giá trị sách trả.
 * - Đổi hàng: chênh lệch = giá trị sách mới − giá trị sách trả; > 0 khách bù, < 0 cửa hàng hoàn.
 * Hai khoản lưu riêng (tien_khach_bu, tien_hoan_tra) để báo cáo doanh thu thuần không tính hai lần.
 */
export function settle(type: 'RETURN' | 'EXCHANGE', returnedValue: number, newBooksValue: number) {
  if (type === 'RETURN') return { refund: returnedValue, extraPayment: 0 };
  const diff = newBooksValue - returnedValue;
  return { refund: Math.max(0, -diff), extraPayment: Math.max(0, diff) };
}
