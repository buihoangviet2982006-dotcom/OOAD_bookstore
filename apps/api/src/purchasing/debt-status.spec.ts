import { debtStatus } from './debt-status.js';

describe('debtStatus', () => {
  const today = '2026-11-27';
  it('hết nợ → PAID kể cả đã qua hạn', () => {
    expect(debtStatus(100, 100, '2026-11-01', today)).toBe('PAID');
  });
  it('còn nợ, qua hạn → OVERDUE; đúng ngày hạn → chưa quá hạn', () => {
    expect(debtStatus(100, 40, '2026-11-26', today)).toBe('OVERDUE');
    expect(debtStatus(100, 40, '2026-11-27', today)).toBe('PARTIAL');
  });
  it('còn nợ trong hạn hoặc không có hạn: đã trả một phần → PARTIAL, chưa trả → UNPAID', () => {
    expect(debtStatus(100, 40, '2026-12-01', today)).toBe('PARTIAL');
    expect(debtStatus(100, 0, null, today)).toBe('UNPAID');
  });
});
