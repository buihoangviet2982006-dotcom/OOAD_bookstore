import { todayInStore } from '../common/store-time.js';
import { allocate, calculatePricing, type PricingLine } from './pricing.js';
import { promotionStatus, voucherStatus } from './promotion-status.js';

const line = (bookId: string, categoryId: string, quantity: number, unitPrice: number): PricingLine => ({
  bookId,
  categoryId,
  quantity,
  unitPrice,
});

describe('calculatePricing', () => {
  // Giống hóa đơn seed HD-2511-1039: 3 × 245.000 + 1 × 155.000 = 890.000
  const lines = [line('SP004', 'CN', 3, 245000), line('SP002', 'VH', 1, 155000)];

  it('CTKM 10% toàn cửa hàng, tối đa 100.000 → 89.000, phân bổ theo tỷ lệ', () => {
    const r = calculatePricing(lines, { type: 'PERCENT', value: 10, maxDiscount: 100000, minOrderValue: 400000, categoryId: null }, null);
    expect(r).toMatchObject({ subtotal: 890000, discountTotal: 89000, total: 801000, lineDiscounts: [73500, 15500] });
  });

  it('mức giảm tối đa chặn phần trăm', () => {
    const r = calculatePricing(lines, { type: 'PERCENT', value: 50, maxDiscount: 100000, minOrderValue: 0, categoryId: null }, null);
    expect(r.discountTotal).toBe(100000);
  });

  it('CTKM theo thể loại: chỉ giảm và phân bổ trên dòng đúng thể loại; đơn tối thiểu xét trên dòng đủ điều kiện', () => {
    const scoped = { type: 'PERCENT' as const, value: 10, maxDiscount: null, categoryId: 'VH' };
    const r = calculatePricing(lines, { ...scoped, minOrderValue: 100000 }, null);
    expect(r).toMatchObject({ discountTotal: 15500, lineDiscounts: [0, 15500] });

    // Tổng đơn 890.000 nhưng phần thuộc VH chỉ 155.000 < 200.000 → không áp dụng
    const below = calculatePricing(lines, { ...scoped, minOrderValue: 200000 }, null);
    expect(below.promotion).toEqual({ applied: false, amount: 0, reason: 'BELOW_MIN_ORDER' });
    expect(below.discountTotal).toBe(0);

    const none = calculatePricing([line('SP004', 'CN', 1, 245000)], { ...scoped, minOrderValue: 0 }, null);
    expect(none.promotion).toMatchObject({ applied: false, reason: 'NO_ELIGIBLE_ITEMS' });
  });

  it('voucher tính SAU CTKM: đơn tối thiểu và % xét trên phần còn lại', () => {
    const promo = { type: 'FIXED' as const, value: 400000, maxDiscount: null, minOrderValue: 0, categoryId: null };
    // còn lại 490.000 < 500.000 → voucher không áp dụng
    const r1 = calculatePricing(lines, promo, { type: 'FIXED', value: 50000, maxDiscount: null, minOrderValue: 500000 });
    expect(r1.voucher).toMatchObject({ applied: false, reason: 'BELOW_MIN_ORDER' });
    // 15% × 490.000 = 73.500, tối đa 60.000 → 60.000
    const r2 = calculatePricing(lines, promo, { type: 'PERCENT', value: 15, maxDiscount: 60000, minOrderValue: 200000 });
    expect(r2).toMatchObject({ discountTotal: 460000, total: 430000 });
    expect(r2.lineDiscounts.reduce((s, v) => s + v, 0)).toBe(460000);
  });

  it('tổng giảm không vượt tổng tiền hàng', () => {
    const r = calculatePricing(
      [line('SP006', 'TN', 1, 98000)],
      { type: 'FIXED', value: 80000, maxDiscount: null, minOrderValue: 0, categoryId: null },
      { type: 'FIXED', value: 50000, maxDiscount: null, minOrderValue: 0 },
    );
    expect(r).toMatchObject({ discountTotal: 98000, total: 0, lineDiscounts: [98000] });
  });

  it('không dòng nào bị giảm vượt giá trị dòng: 3 dòng × 1.000đ, voucher cố định 2.999đ', () => {
    const r = calculatePricing(
      [line('B1', 'X', 1, 1000), line('B2', 'X', 1, 1000), line('B3', 'X', 1, 1000)],
      null,
      { type: 'FIXED', value: 2999, maxDiscount: null, minOrderValue: 0 },
    );
    expect(r.lineDiscounts).toEqual([1000, 1000, 999]);
    expect(r.discountTotal).toBe(2999);
    expect(r.total).toBe(1);
  });
});

describe('allocate', () => {
  it('làm tròn xuống; phần dư chia từng đồng cho các phần có phần lẻ lớn nhất', () => {
    // 50.000 × 269/619 = 21.728,59…; 50.000 × 350/619 = 28.271,40… → dư 1đ vào phần lẻ lớn hơn
    expect(allocate(50000, [269000, 350000])).toEqual([21729, 28271]);
    expect(allocate(2, [1, 1, 1])).toEqual([1, 1, 0]); // phần lẻ bằng nhau → dòng đứng trước
    expect(allocate(100, [300, 300, 300])).toEqual([34, 33, 33]);
    expect(allocate(0, [5, 5])).toEqual([0, 0]);
    expect(allocate(7, [0, 0])).toEqual([0, 0]);
  });

  it('bất biến: tổng đúng bằng số tiền, mỗi phần trong [0, trọng số]', () => {
    // Bộ sinh số giả ngẫu nhiên cố định để test lặp lại được.
    let seed = 12345;
    const next = (max: number) => (seed = (seed * 1103515245 + 12345) % 2 ** 31) % max;
    for (let round = 0; round < 500; round++) {
      const weights = Array.from({ length: 1 + next(6) }, () => next(5) === 0 ? 0 : 1 + next(500_000));
      const total = weights.reduce((s, w) => s + w, 0);
      const amount = total === 0 ? 0 : next(total + 1);
      const parts = allocate(amount, weights);
      expect(parts.reduce((s, p) => s + p, 0)).toBe(total === 0 ? 0 : amount);
      parts.forEach((p, i) => {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(weights[i]);
      });
    }
  });

  it('số lớn không mất chính xác (dùng số nguyên lớn)', () => {
    const parts = allocate(999_999_999, [999_999_999, 1_000_000_000, 7]);
    expect(parts.reduce((s, p) => s + p, 0)).toBe(999_999_999);
    parts.forEach((p, i) => expect(p).toBeLessThanOrEqual([999_999_999, 1_000_000_000, 7][i]));
  });

  it('số tiền vượt tổng trọng số là lỗi lập trình → ném lỗi', () => {
    expect(() => allocate(11, [5, 5])).toThrow();
  });
});

describe('promotionStatus', () => {
  const s = (stored: 'ACTIVE' | 'PAUSED' | 'CANCELLED', today: string) =>
    promotionStatus(stored, '2026-11-10', '2026-11-20', today);

  it('theo ngày, tính cả hai đầu khoảng', () => {
    expect(s('ACTIVE', '2026-11-09')).toBe('SCHEDULED');
    expect(s('ACTIVE', '2026-11-10')).toBe('ACTIVE');
    expect(s('ACTIVE', '2026-11-20')).toBe('ACTIVE');
    expect(s('ACTIVE', '2026-11-21')).toBe('EXPIRED');
  });

  it('PAUSED giữ nguyên trong hạn, quá hạn thành EXPIRED; CANCELLED luôn là CANCELLED', () => {
    expect(s('PAUSED', '2026-11-09')).toBe('PAUSED');
    expect(s('PAUSED', '2026-11-21')).toBe('EXPIRED');
    expect(s('CANCELLED', '2026-11-15')).toBe('CANCELLED');
    expect(s('CANCELLED', '2026-11-30')).toBe('CANCELLED');
  });
});

describe('voucherStatus', () => {
  const base = { isActive: true, usedCount: 0, usageLimit: 10, startDate: '2026-11-10', endDate: '2026-11-20' };
  it('các trạng thái', () => {
    expect(voucherStatus(base, '2026-11-15')).toBe('ACTIVE');
    expect(voucherStatus(base, '2026-11-09')).toBe('SCHEDULED');
    expect(voucherStatus(base, '2026-11-21')).toBe('EXPIRED');
    expect(voucherStatus({ ...base, isActive: false }, '2026-11-15')).toBe('PAUSED');
    expect(voucherStatus({ ...base, usedCount: 10 }, '2026-11-15')).toBe('USED_UP');
  });
});

describe('todayInStore', () => {
  it('dùng giờ Việt Nam (UTC+7)', () => {
    expect(todayInStore(new Date('2026-11-26T17:30:00Z'))).toBe('2026-11-27'); // 00:30 ngày 27 giờ VN
    expect(todayInStore(new Date('2026-11-26T16:59:00Z'))).toBe('2026-11-26');
  });
});
