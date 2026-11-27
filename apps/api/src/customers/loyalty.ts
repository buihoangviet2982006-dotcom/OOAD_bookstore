/**
 * Quy tắc tích điểm & hạng thành viên (quyết định review #6, lấy theo FE vì tài liệu chưa nêu số):
 * - 1 điểm cho mỗi 10.000đ giá trị thực trả của từng hóa đơn (sau đổi/trả), làm tròn xuống.
 * - Hạng tính từ tổng chi tiêu thực tế (Σ thanh toán cuối + tiền khách bù − tiền hoàn).
 */
export const VND_PER_POINT = 10_000;

export const TIER_THRESHOLDS = [
  { tier: 'DIAMOND', minSpent: 8_000_000 },
  { tier: 'GOLD', minSpent: 3_500_000 },
  { tier: 'SILVER', minSpent: 1_200_000 },
] as const;

export type CustomerTier = 'STANDARD' | (typeof TIER_THRESHOLDS)[number]['tier'];

export function pointsFor(netValue: number): number {
  return Math.max(0, Math.floor(netValue / VND_PER_POINT));
}

export function tierFor(totalSpent: number): CustomerTier {
  return TIER_THRESHOLDS.find((t) => totalSpent >= t.minSpent)?.tier ?? 'STANDARD';
}
