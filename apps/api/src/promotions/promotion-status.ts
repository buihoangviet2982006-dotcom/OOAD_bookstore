import type { TrangThaiCTKM } from '@prisma/client';

/** Trạng thái hiển thị của CTKM (contract FE `PromotionStatus`). */
export type PromotionStatus = 'ACTIVE' | 'SCHEDULED' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';

/** Trạng thái hiển thị của voucher (bổ sung cho FE hiển thị nhãn). */
export type VoucherStatus = 'ACTIVE' | 'SCHEDULED' | 'PAUSED' | 'USED_UP' | 'EXPIRED';

/**
 * Trạng thái CTKM tại ngày `today` (YYYY-MM-DD, giờ cửa hàng). Khoảng ngày tính cả hai đầu.
 * Thứ tự ưu tiên: Đã hủy → Đã kết thúc (qua ngày kết thúc) → Tạm dừng → Sắp diễn ra → Đang diễn ra.
 */
export function promotionStatus(
  stored: TrangThaiCTKM,
  startDate: string,
  endDate: string,
  today: string,
): PromotionStatus {
  if (stored === 'CANCELLED') return 'CANCELLED';
  if (today > endDate) return 'EXPIRED';
  if (stored === 'PAUSED') return 'PAUSED';
  if (today < startDate) return 'SCHEDULED';
  return 'ACTIVE';
}

/**
 * Trạng thái voucher tại ngày `today`.
 * Thứ tự: Hết hạn → Tạm ngừng → Hết lượt → Chưa đến ngày bắt đầu → Đang dùng được.
 */
export function voucherStatus(
  v: { isActive: boolean; usedCount: number; usageLimit: number; startDate: string; endDate: string },
  today: string,
): VoucherStatus {
  if (today > v.endDate) return 'EXPIRED';
  if (!v.isActive) return 'PAUSED';
  if (v.usedCount >= v.usageLimit) return 'USED_UP';
  if (today < v.startDate) return 'SCHEDULED';
  return 'ACTIVE';
}
