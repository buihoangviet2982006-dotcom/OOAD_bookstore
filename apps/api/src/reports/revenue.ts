import { addDays, daysInRange, todayInStore } from '../common/store-time.js';

/**
 * Công thức báo cáo (quyết định review #12) – hàm thuần, dùng số đã lưu trên chứng từ:
 *
 * - Doanh thu thuần = Σ thanh toán cuối của hóa đơn lập trong kỳ
 *                   + Σ tiền khách bù khi đổi trong kỳ − Σ tiền hoàn khách trong kỳ.
 * - Giá vốn thuần  = Σ giá vốn sách bán trong kỳ (giá vốn lưu trên dòng hóa đơn)
 *                   − Σ giá vốn sách nhận lại trong kỳ (giá vốn của dòng hóa đơn gốc)
 *                   + Σ giá vốn sách đổi ra trong kỳ (giá vốn lưu trên phiếu đổi).
 * - Lợi nhuận gộp  = Doanh thu thuần − Giá vốn thuần.
 *
 * Phiếu đổi/trả tính vào ngày lập phiếu (kỳ phát sinh), hóa đơn gốc giữ nguyên ở kỳ của nó –
 * không loại hóa đơn gốc và không trừ tiền hoàn hai lần. Ngày được xét theo giờ Việt Nam.
 */

export interface InvoiceFact {
  date: Date;
  /** Thanh toán cuối của hóa đơn (= Σ thực trả các dòng). */
  total: number;
  lines: { bookId: string; title: string; quantity: number; netAmount: number; unitCost: number }[];
}

export interface ReturnFact {
  date: Date;
  extraPayment: number;
  refund: number;
  lines: {
    bookId: string;
    title: string;
    quantity: number;
    /** Giá trị thực của phần sách nhận lại (đã lưu trên phiếu). */
    value: number;
    /** Giá vốn đơn vị của dòng hóa đơn gốc. */
    unitCost: number;
    exchange: { bookId: string; title: string; unitPrice: number; unitCost: number } | null;
  }[];
}

export interface RevenueTotals {
  invoiceAmount: number;
  exchangeIn: number;
  refunds: number;
  revenue: number;
  saleCost: number;
  returnedCost: number;
  exchangeOutCost: number;
  cost: number;
  profit: number;
  orders: number;
  booksSold: number;
}

export interface RevenuePoint {
  date: string;
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  orders: number;
  booksSold: number;
}

export interface BestsellerRow {
  bookId: string;
  title: string;
  soldQty: number;
  returnedQty: number;
  exchangedOutQty: number;
  netQty: number;
  revenue: number;
}

/** Làm tròn tiền về 2 chữ số thập phân (cột tiền trong DB là Decimal(14,2)). */
const money = (n: number) => Math.round(n * 100) / 100;

function emptyTotals(): RevenueTotals {
  return {
    invoiceAmount: 0,
    exchangeIn: 0,
    refunds: 0,
    revenue: 0,
    saleCost: 0,
    returnedCost: 0,
    exchangeOutCost: 0,
    cost: 0,
    profit: 0,
    orders: 0,
    booksSold: 0,
  };
}

function finish(t: RevenueTotals): RevenueTotals {
  const revenue = money(t.invoiceAmount + t.exchangeIn - t.refunds);
  const cost = money(t.saleCost - t.returnedCost + t.exchangeOutCost);
  return {
    ...t,
    invoiceAmount: money(t.invoiceAmount),
    exchangeIn: money(t.exchangeIn),
    refunds: money(t.refunds),
    saleCost: money(t.saleCost),
    returnedCost: money(t.returnedCost),
    exchangeOutCost: money(t.exchangeOutCost),
    revenue,
    cost,
    profit: money(revenue - cost),
  };
}

function addInvoice(t: RevenueTotals, inv: InvoiceFact) {
  t.invoiceAmount += inv.total;
  t.orders += 1;
  for (const l of inv.lines) {
    t.saleCost += l.quantity * l.unitCost;
    t.booksSold += l.quantity;
  }
}

function addReturn(t: RevenueTotals, ret: ReturnFact) {
  t.exchangeIn += ret.extraPayment;
  t.refunds += ret.refund;
  for (const l of ret.lines) {
    t.returnedCost += l.quantity * l.unitCost;
    t.booksSold -= l.quantity;
    if (l.exchange) {
      t.exchangeOutCost += l.quantity * l.exchange.unitCost;
      t.booksSold += l.quantity;
    }
  }
}

/** Tổng kỳ + chuỗi theo từng ngày (đủ mọi ngày trong [from, to], ngày không phát sinh = 0). */
export function summarizeRevenue(
  invoices: InvoiceFact[],
  returns: ReturnFact[],
  from: string,
  to: string,
): { totals: RevenueTotals; series: RevenuePoint[] } {
  const total = emptyTotals();
  const byDay = new Map<string, RevenueTotals>();
  for (let i = 0; i < daysInRange(from, to); i++) byDay.set(addDays(from, i), emptyTotals());
  const dayOf = (d: Date) => byDay.get(todayInStore(d));

  for (const inv of invoices) {
    addInvoice(total, inv);
    const day = dayOf(inv.date);
    if (day) addInvoice(day, inv);
  }
  for (const ret of returns) {
    addReturn(total, ret);
    const day = dayOf(ret.date);
    if (day) addReturn(day, ret);
  }

  const series = [...byDay].map(([date, t]) => {
    const f = finish(t);
    const [, mm, dd] = date.split('-');
    return { date, label: `${dd}/${mm}`, revenue: f.revenue, cost: f.cost, profit: f.profit, orders: f.orders, booksSold: f.booksSold };
  });
  return { totals: finish(total), series };
}

/**
 * Sách bán chạy theo số lượng thuần = bán ra − nhận lại + đổi ra (trong kỳ).
 * Doanh thu từng sách: thực trả dòng hóa đơn − giá trị sách nhận lại + giá trị sách đổi ra
 * → tổng cột doanh thu bằng doanh thu thuần của kỳ.
 */
export function bestsellers(invoices: InvoiceFact[], returns: ReturnFact[]): BestsellerRow[] {
  const rows = new Map<string, BestsellerRow>();
  const row = (bookId: string, title: string) => {
    let r = rows.get(bookId);
    if (!r) {
      r = { bookId, title, soldQty: 0, returnedQty: 0, exchangedOutQty: 0, netQty: 0, revenue: 0 };
      rows.set(bookId, r);
    }
    return r;
  };

  for (const inv of invoices) {
    for (const l of inv.lines) {
      const r = row(l.bookId, l.title);
      r.soldQty += l.quantity;
      r.revenue += l.netAmount;
    }
  }
  for (const ret of returns) {
    for (const l of ret.lines) {
      const back = row(l.bookId, l.title);
      back.returnedQty += l.quantity;
      back.revenue -= l.value;
      if (l.exchange) {
        const out = row(l.exchange.bookId, l.exchange.title);
        out.exchangedOutQty += l.quantity;
        out.revenue += l.quantity * l.exchange.unitPrice;
      }
    }
  }

  return [...rows.values()]
    .map((r) => ({ ...r, netQty: r.soldQty - r.returnedQty + r.exchangedOutQty, revenue: money(r.revenue) }))
    .sort((a, b) => b.netQty - a.netQty || b.revenue - a.revenue || a.bookId.localeCompare(b.bookId));
}
