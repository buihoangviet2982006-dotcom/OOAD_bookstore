/** Trạng thái công nợ của phiếu nhập (contract FE `DebtStatus`). */
export type DebtStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE';

/**
 * Suy ra từ số tiền và hạn thanh toán (không lưu cột). Thứ tự ưu tiên:
 * - Hết nợ → PAID (dù đã qua hạn – phiếu hết nợ không bị coi là quá hạn).
 * - Còn nợ và hôm nay (giờ cửa hàng) đã qua hạn → OVERDUE (đúng ngày hạn vẫn chưa quá hạn).
 * - Còn nợ, đã trả một phần → PARTIAL; chưa trả gì → UNPAID.
 */
export function debtStatus(total: number, paid: number, dueDate: string | null, today: string): DebtStatus {
  if (paid >= total) return 'PAID';
  if (dueDate && today > dueDate) return 'OVERDUE';
  return paid > 0 ? 'PARTIAL' : 'UNPAID';
}
