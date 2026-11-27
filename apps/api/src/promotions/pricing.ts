/**
 * Tính tiền giảm cho một hóa đơn (quyết định review #5) – hàm thuần, không đọc DB.
 * Nghiệp vụ bán hàng (preview + lập hóa đơn) dùng chung hàm này; khi lập hóa đơn luôn tính lại từ đầu.
 *
 * Quy tắc (tiền là số nguyên VNĐ):
 * 1. Tối đa 1 CTKM + 1 voucher.
 * 2. CTKM: dòng đủ điều kiện = mọi dòng (toàn cửa hàng) hoặc các dòng thuộc thể loại của CTKM.
 *    Đơn tối thiểu xét trên tổng giá trị các dòng đủ điều kiện.
 *    PERCENT: giảm = làm tròn xuống(% × giá trị đủ điều kiện), không vượt mức giảm tối đa;
 *    FIXED: giảm = số tiền cố định. Luôn không vượt giá trị đủ điều kiện.
 * 3. Voucher: tính SAU CTKM trên phần còn lại = tổng tiền hàng − giảm CTKM.
 *    Đơn tối thiểu của voucher xét trên phần còn lại này. Cách tính PERCENT/FIXED như trên,
 *    không vượt phần còn lại ⇒ tổng giảm ≤ tổng tiền hàng.
 * 4. Phân bổ xuống từng dòng (để tính giá hoàn khi trả hàng):
 *    giảm CTKM chia cho các dòng đủ điều kiện theo tỷ lệ giá trị dòng;
 *    giảm voucher chia cho mọi dòng theo tỷ lệ giá trị còn lại của dòng (sau giảm CTKM).
 *    Mỗi phần làm tròn xuống đến đồng, phần dư cộng vào dòng có tỷ trọng lớn nhất.
 */

export interface PricingLine {
  bookId: string;
  categoryId: string;
  quantity: number;
  unitPrice: number;
}

export interface DiscountRule {
  type: 'PERCENT' | 'FIXED';
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
}

export interface PromotionRule extends DiscountRule {
  /** null = áp dụng toàn cửa hàng. */
  categoryId: string | null;
}

export type DiscountOutcome =
  | { applied: true; amount: number }
  | { applied: false; amount: 0; reason: 'BELOW_MIN_ORDER' | 'NO_ELIGIBLE_ITEMS' };

export interface PricingResult {
  subtotal: number;
  promotion: DiscountOutcome | null;
  voucher: DiscountOutcome | null;
  discountTotal: number;
  total: number;
  /** Tổng giảm đã phân bổ cho từng dòng (cùng thứ tự với `lines`). */
  lineDiscounts: number[];
}

export function calculatePricing(
  lines: PricingLine[],
  promotion: PromotionRule | null,
  voucher: DiscountRule | null,
): PricingResult {
  const lineValues = lines.map((l) => l.quantity * l.unitPrice);
  const subtotal = sum(lineValues);

  // CTKM trên các dòng đủ điều kiện
  const eligibleValues = lines.map((line, i) =>
    promotion && (promotion.categoryId === null || line.categoryId === promotion.categoryId) ? lineValues[i] : 0,
  );
  const promotionOutcome = promotion ? applyRule(promotion, sum(eligibleValues)) : null;
  const promotionAmount = promotionOutcome?.amount ?? 0;
  const promotionParts = allocate(promotionAmount, eligibleValues);

  // Voucher trên phần còn lại
  const remainingValues = lineValues.map((v, i) => v - promotionParts[i]);
  const voucherOutcome = voucher ? applyRule(voucher, subtotal - promotionAmount) : null;
  const voucherParts = allocate(voucherOutcome?.amount ?? 0, remainingValues);

  const discountTotal = promotionAmount + (voucherOutcome?.amount ?? 0);
  return {
    subtotal,
    promotion: promotionOutcome,
    voucher: voucherOutcome,
    discountTotal,
    total: subtotal - discountTotal,
    lineDiscounts: lineValues.map((_, i) => promotionParts[i] + voucherParts[i]),
  };
}

/** Áp một quy tắc giảm lên giá trị `base` (đã là phần được xét). */
function applyRule(rule: DiscountRule, base: number): DiscountOutcome {
  if (base <= 0) return { applied: false, amount: 0, reason: 'NO_ELIGIBLE_ITEMS' };
  if (base < rule.minOrderValue) return { applied: false, amount: 0, reason: 'BELOW_MIN_ORDER' };

  let amount = rule.type === 'PERCENT' ? Math.floor((base * rule.value) / 100) : rule.value;
  if (rule.type === 'PERCENT' && rule.maxDiscount !== null) amount = Math.min(amount, rule.maxDiscount);
  return { applied: true, amount: Math.min(amount, base) };
}

/**
 * Chia `amount` (đồng) theo tỷ lệ `weights` – phương pháp phần dư lớn nhất:
 * 1. Mỗi phần = phần nguyên của amount × w / tổng (làm tròn xuống).
 * 2. Số đồng còn dư (luôn nhỏ hơn số phần có phần lẻ) được cộng mỗi lần 1đ cho các phần có phần lẻ lớn nhất
 *    (hòa thì phần đứng trước).
 * Vì chỉ phần có phần lẻ > 0 mới được +1đ nên mỗi phần không vượt trọng số của nó
 * (vd 2.999đ chia cho 3 dòng 1.000đ → 1.000 / 1.000 / 999, không có dòng nào bị giảm 1.001đ).
 * Dùng BigInt để tích amount × w không mất chính xác với số tiền lớn.
 * Yêu cầu: 0 ≤ amount ≤ tổng trọng số (calculatePricing luôn bảo đảm).
 */
export function allocate(amount: number, weights: number[]): number[] {
  const total = sum(weights);
  if (amount === 0 || total === 0) return weights.map(() => 0);
  if (amount < 0 || amount > total) {
    throw new Error(`Không thể phân bổ ${amount} cho tổng giá trị ${total}.`);
  }

  const bigAmount = BigInt(amount);
  const bigTotal = BigInt(total);
  const parts = weights.map((w) => Number((bigAmount * BigInt(w)) / bigTotal));
  const fractions = weights.map((w) => (bigAmount * BigInt(w)) % bigTotal); // phần lẻ (tử số)

  let remainder = amount - sum(parts);
  const byLargestFraction = weights
    .map((_, i) => i)
    .sort((a, b) => (fractions[b] > fractions[a] ? 1 : fractions[b] < fractions[a] ? -1 : a - b));
  for (const i of byLargestFraction) {
    if (remainder === 0) break;
    parts[i] += 1;
    remainder -= 1;
  }
  return parts;
}

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);
