import { isWithinReturnWindow, returnCredit, returnDeadline, settle } from './refund.js';

describe('returnCredit – giá trị phần trả theo lũy kế', () => {
  it('trả từng cuốn: không vượt, trả hết thì hoàn đủ', () => {
    // 3 cuốn, thực trả 100.000 → 33.333 + 33.333 + 33.334 = 100.000
    const parts = [returnCredit(100000, 3, 0, 1), returnCredit(100000, 3, 1, 1), returnCredit(100000, 3, 2, 1)];
    expect(parts).toEqual([33333, 33333, 33334]);
    expect(parts.reduce((s, p) => s + p, 0)).toBe(100000);
  });

  it('kết quả không phụ thuộc cách chia các lần trả', () => {
    const twoThenOne = returnCredit(100000, 3, 0, 2) + returnCredit(100000, 3, 2, 1);
    const oneThenTwo = returnCredit(100000, 3, 0, 1) + returnCredit(100000, 3, 1, 2);
    expect(twoThenOne).toBe(100000);
    expect(oneThenTwo).toBe(100000);
  });

  it('dùng tiền thực trả sau giảm (dòng 269.000 bị phân bổ giảm 21.728)', () => {
    expect(returnCredit(269000 - 21728, 1, 0, 1)).toBe(247272);
  });

  it('dữ liệu seed: Dế Mèn 3 × 98.000, không giảm → trả 1 cuốn = 98.000', () => {
    expect(returnCredit(294000, 3, 0, 1)).toBe(98000);
  });

  it('trả vượt số còn lại hoặc số lượng ≤ 0 → lỗi lập trình', () => {
    expect(() => returnCredit(100000, 3, 2, 2)).toThrow();
    expect(() => returnCredit(100000, 3, 0, 0)).toThrow();
  });
});

describe('hạn đổi/trả 7 ngày theo lịch Việt Nam', () => {
  it('tính từ ngày lập theo giờ Việt Nam, hết hạn sau hết ngày thứ 7', () => {
    const lateEvening = new Date('2026-11-20T23:30:00+07:00');
    expect(returnDeadline(lateEvening)).toBe('2026-11-27');
    expect(isWithinReturnWindow(lateEvening, '2026-11-27')).toBe(true);
    expect(isWithinReturnWindow(lateEvening, '2026-11-28')).toBe(false);
  });

  it('00:30 ngày 21 giờ Việt Nam (= 17:30 UTC ngày 20) tính là ngày 21', () => {
    expect(returnDeadline(new Date('2026-11-20T17:30:00Z'))).toBe('2026-11-28');
  });
});

describe('settle – quyết toán', () => {
  it('trả hàng: hoàn đúng giá trị sách trả', () => {
    expect(settle('RETURN', 98000, 0)).toEqual({ refund: 98000, extraPayment: 0 });
  });
  it('đổi sang sách đắt hơn: khách bù; rẻ hơn: hoàn; ngang giá: 0', () => {
    expect(settle('EXCHANGE', 98000, 115000)).toEqual({ refund: 0, extraPayment: 17000 });
    expect(settle('EXCHANGE', 115000, 98000)).toEqual({ refund: 17000, extraPayment: 0 });
    expect(settle('EXCHANGE', 98000, 98000)).toEqual({ refund: 0, extraPayment: 0 });
  });
});
