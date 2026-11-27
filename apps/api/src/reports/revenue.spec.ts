import { bestsellers, summarizeRevenue, type InvoiceFact, type ReturnFact } from './revenue.js';

/**
 * Kịch bản tính tay, kỳ 01/03 – 03/03/2026 (giờ VN):
 * - HĐ 01/03 10:00: A ×2 giá 100.000 giảm 20.000 (thực trả 180.000, vốn 60.000/cuốn);
 *                   B ×1 giá 50.000 (vốn 30.000) → thanh toán 230.000, giá vốn 150.000.
 * - Phiếu trả 02/03 23:30: trả 1 A của HĐ trên, giá trị 90.000 → hoàn 90.000, vốn nhận lại 60.000.
 * - Phiếu đổi 03/03 00:10 (hóa đơn gốc ở kỳ trước): trả 1 B giá trị 45.000 (vốn 30.000),
 *   đổi sang C giá 70.000 (vốn 40.000) → khách bù 25.000.
 * Doanh thu thuần = 230.000 + 25.000 − 90.000 = 165.000
 * Giá vốn thuần  = 150.000 − (60.000 + 30.000) + 40.000 = 100.000 → Lợi nhuận gộp 65.000.
 */
const invoices: InvoiceFact[] = [
  {
    date: new Date('2026-03-01T10:00:00+07:00'),
    total: 230_000,
    lines: [
      { bookId: 'A', title: 'Sách A', quantity: 2, netAmount: 180_000, unitCost: 60_000 },
      { bookId: 'B', title: 'Sách B', quantity: 1, netAmount: 50_000, unitCost: 30_000 },
    ],
  },
];
const returns: ReturnFact[] = [
  {
    date: new Date('2026-03-02T23:30:00+07:00'),
    extraPayment: 0,
    refund: 90_000,
    lines: [{ bookId: 'A', title: 'Sách A', quantity: 1, value: 90_000, unitCost: 60_000, exchange: null }],
  },
  {
    date: new Date('2026-03-03T00:10:00+07:00'),
    extraPayment: 25_000,
    refund: 0,
    lines: [
      {
        bookId: 'B',
        title: 'Sách B',
        quantity: 1,
        value: 45_000,
        unitCost: 30_000,
        exchange: { bookId: 'C', title: 'Sách C', unitPrice: 70_000, unitCost: 40_000 },
      },
    ],
  },
];

describe('summarizeRevenue', () => {
  const { totals, series } = summarizeRevenue(invoices, returns, '2026-03-01', '2026-03-03');

  it('tính đúng doanh thu thuần, giá vốn thuần, lợi nhuận gộp', () => {
    expect(totals).toEqual({
      invoiceAmount: 230_000,
      exchangeIn: 25_000,
      refunds: 90_000,
      revenue: 165_000,
      saleCost: 150_000,
      returnedCost: 90_000,
      exchangeOutCost: 40_000,
      cost: 100_000,
      profit: 65_000,
      orders: 1,
      booksSold: 2,
    });
  });

  it('chia theo ngày giờ VN (23:30 thuộc ngày 02, 00:10 thuộc ngày 03), tổng các ngày = tổng kỳ', () => {
    expect(series.map((p) => [p.label, p.revenue, p.cost, p.profit, p.booksSold])).toEqual([
      ['01/03', 230_000, 150_000, 80_000, 3],
      ['02/03', -90_000, -60_000, -30_000, -1],
      ['03/03', 25_000, 10_000, 15_000, 0],
    ]);
    expect(series.reduce((s, p) => s + p.revenue, 0)).toBe(totals.revenue);
  });

  it('kỳ không phát sinh → đủ ngày, giá trị 0', () => {
    const empty = summarizeRevenue([], [], '2026-02-27', '2026-03-01');
    expect(empty.series.map((p) => p.date)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
    expect(empty.totals.revenue).toBe(0);
  });
});

describe('bestsellers', () => {
  it('số lượng thuần = bán − nhận lại + đổi ra; tổng doanh thu = doanh thu thuần', () => {
    const rows = bestsellers(invoices, returns);
    expect(rows.map((r) => [r.bookId, r.soldQty, r.returnedQty, r.exchangedOutQty, r.netQty, r.revenue])).toEqual([
      ['A', 2, 1, 0, 1, 90_000],
      ['C', 0, 0, 1, 1, 70_000],
      ['B', 1, 1, 0, 0, 5_000],
    ]);
    expect(rows.reduce((s, r) => s + r.revenue, 0)).toBe(165_000);
  });
});
