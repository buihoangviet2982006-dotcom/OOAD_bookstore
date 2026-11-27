import { BadRequestException, Injectable } from '@nestjs/common';
import type { CurrentAccount } from '../auth/auth.types.js';
import { addDays, daysInRange, startOfStoreDay, todayInStore } from '../common/store-time.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ReportPeriodDto } from './dto/report-period.dto.js';
import { bestsellers, summarizeRevenue, type InvoiceFact, type ReturnFact } from './revenue.js';

/** Giới hạn độ dài kỳ để một yêu cầu không quét quá nhiều chứng từ. */
const MAX_DAYS = 366;

interface Period {
  from: string;
  to: string;
}

export interface DashboardCard {
  key: string;
  label: string;
  value: number;
  format: 'currency' | 'number';
  /** Giá trị kỳ trước (cùng số ngày, liền trước); null nếu là số liệu tại thời điểm hiện tại. */
  previous: number | null;
  /** Giá trị theo từng ngày trong kỳ (vẽ sparkline); null nếu không áp dụng. */
  series: number[] | null;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────── Báo cáo (MANAGER) ─────────────

  async revenue(dto: ReportPeriodDto) {
    const period = checkPeriod(dto);
    const previous = previousPeriod(period);
    const [current, before] = await Promise.all([this.loadFacts(period), this.loadFacts(previous)]);
    const { totals, series } = summarizeRevenue(current.invoices, current.returns, period.from, period.to);
    return {
      ...period,
      previousFrom: previous.from,
      previousTo: previous.to,
      totals,
      previousTotals: summarizeRevenue(before.invoices, before.returns, previous.from, previous.to).totals,
      series,
    };
  }

  async bestsellers(dto: ReportPeriodDto) {
    const period = checkPeriod(dto);
    const { invoices, returns } = await this.loadFacts(period);
    return bestsellers(invoices, returns);
  }

  // ───────────── Trang Tổng quan (mọi vai trò) ─────────────

  /**
   * Chỉ số theo vai trò – quyết định ở backend, FE không chọn được:
   * - MANAGER: doanh thu thuần, số hóa đơn, số sách bán thuần, khách hàng mới (toàn cửa hàng).
   * - SALES: hóa đơn / sách / phiếu đổi trả do chính mình lập, khách hàng mới – không có doanh thu cửa hàng.
   * - WAREHOUSE: phiếu nhập, số sách nhập, phiếu kiểm kê trong kỳ, số đầu sách dưới định mức.
   */
  async dashboard(dto: ReportPeriodDto, user: CurrentAccount) {
    const period = checkPeriod(dto);
    const previous = previousPeriod(period);
    const load = (p: Period) =>
      user.vaiTro === 'MANAGER'
        ? this.managerCards(p)
        : user.vaiTro === 'SALES'
          ? this.salesCards(p, user.maNV)
          : this.warehouseCards(p);
    const [current, before] = await Promise.all([load(period), load(previous)]);

    const cards: DashboardCard[] = current.map((c, i) => ({
      ...c,
      previous: c.series ? before[i].value : null,
    }));
    if (user.vaiTro === 'WAREHOUSE') cards.push(await this.lowStockCard());
    return { ...period, previousFrom: previous.from, previousTo: previous.to, role: user.vaiTro, cards };
  }

  private async managerCards(p: Period): Promise<Omit<DashboardCard, 'previous'>[]> {
    const [{ invoices, returns }, customers] = await Promise.all([
      this.loadFacts(p),
      this.prisma.khachHang.findMany({ where: { ngayTao: dateRange(p) }, select: { ngayTao: true } }),
    ]);
    const { totals, series } = summarizeRevenue(invoices, returns, p.from, p.to);
    return [
      { key: 'revenue', label: 'Doanh thu thuần', format: 'currency', value: totals.revenue, series: series.map((s) => s.revenue) },
      { key: 'orders', label: 'Số hóa đơn', format: 'number', value: totals.orders, series: series.map((s) => s.orders) },
      { key: 'booksSold', label: 'Số sách bán (thuần)', format: 'number', value: totals.booksSold, series: series.map((s) => s.booksSold) },
      newCustomersCard(p, customers.map((c) => c.ngayTao)),
    ];
  }

  private async salesCards(p: Period, maNV: string): Promise<Omit<DashboardCard, 'previous'>[]> {
    const [invoices, returns, customers] = await Promise.all([
      this.prisma.hoaDon.findMany({
        where: { maNV, ngayLap: dateRange(p) },
        select: { ngayLap: true, chiTiets: { select: { soLuongBan: true } } },
      }),
      this.prisma.phieuDoiTra.findMany({ where: { maNV, ngayDoiTra: dateRange(p) }, select: { ngayDoiTra: true } }),
      this.prisma.khachHang.findMany({ where: { ngayTao: dateRange(p) }, select: { ngayTao: true } }),
    ]);
    const qty = invoices.map((i) => ({ date: i.ngayLap, value: i.chiTiets.reduce((s, l) => s + l.soLuongBan, 0) }));
    return [
      countCard(p, 'myOrders', 'Hóa đơn tôi lập', invoices.map((i) => i.ngayLap)),
      sumCard(p, 'myBooksSold', 'Sách bán trên hóa đơn của tôi', qty),
      countCard(p, 'myReturns', 'Phiếu đổi/trả tôi xử lý', returns.map((r) => r.ngayDoiTra)),
      newCustomersCard(p, customers.map((c) => c.ngayTao)),
    ];
  }

  private async warehouseCards(p: Period): Promise<Omit<DashboardCard, 'previous'>[]> {
    const [imports, audits] = await Promise.all([
      this.prisma.phieuNhap.findMany({
        where: { ngayNhap: dateRange(p) },
        select: { ngayNhap: true, chiTiets: { select: { soLuongNhap: true } } },
      }),
      this.prisma.phieuKiemKe.findMany({ where: { ngayKiemKe: dateRange(p) }, select: { ngayKiemKe: true } }),
    ]);
    const qty = imports.map((i) => ({ date: i.ngayNhap, value: i.chiTiets.reduce((s, l) => s + l.soLuongNhap, 0) }));
    return [
      countCard(p, 'imports', 'Phiếu nhập', imports.map((i) => i.ngayNhap)),
      sumCard(p, 'importedQty', 'Số sách nhập', qty),
      countCard(p, 'audits', 'Phiếu kiểm kê', audits.map((a) => a.ngayKiemKe)),
    ];
  }

  /** Số đầu sách đang kinh doanh có tồn ≤ định mức – số liệu hiện tại, không theo kỳ. */
  private async lowStockCard(): Promise<DashboardCard> {
    const [row] = await this.prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM sach WHERE trang_thai = 'ACTIVE' AND so_luong_ton <= muc_ton_toi_thieu`;
    return { key: 'lowStock', label: 'Đầu sách dưới định mức (hiện tại)', format: 'number', value: Number(row.n), previous: null, series: null };
  }

  // ───────────── Nạp chứng từ trong kỳ ─────────────

  private async loadFacts(p: Period): Promise<{ invoices: InvoiceFact[]; returns: ReturnFact[] }> {
    const [invoiceRows, returnRows] = await Promise.all([
      this.prisma.hoaDon.findMany({ where: { ngayLap: dateRange(p) }, include: { chiTiets: true } }),
      this.prisma.phieuDoiTra.findMany({
        where: { ngayDoiTra: dateRange(p) },
        include: {
          chiTiets: { include: { sachDoi: { select: { tenSach: true } } } },
          hoaDon: { select: { chiTiets: { select: { maSach: true, tenSach: true, giaVon: true } } } },
        },
      }),
    ]);

    const invoices: InvoiceFact[] = invoiceRows.map((inv) => ({
      date: inv.ngayLap,
      total: Number(inv.thanhToanCuoi),
      lines: inv.chiTiets.map((l) => ({
        bookId: l.maSach,
        title: l.tenSach,
        quantity: l.soLuongBan,
        netAmount: l.soLuongBan * Number(l.donGiaBan) - Number(l.giamGia),
        unitCost: Number(l.giaVon),
      })),
    }));

    const returns: ReturnFact[] = returnRows.map((r) => ({
      date: r.ngayDoiTra,
      extraPayment: Number(r.tienKhachBu),
      refund: Number(r.tienHoanTra),
      lines: r.chiTiets.map((l) => {
        const original = r.hoaDon.chiTiets.find((o) => o.maSach === l.maSach);
        return {
          bookId: l.maSach,
          title: original?.tenSach ?? l.maSach,
          quantity: l.soLuongTra,
          value: Number(l.giaTriTra),
          unitCost: Number(original?.giaVon ?? 0),
          exchange: l.maSachDoi
            ? {
                bookId: l.maSachDoi,
                title: l.sachDoi?.tenSach ?? l.maSachDoi,
                unitPrice: Number(l.donGiaSachDoi ?? 0),
                unitCost: Number(l.giaVonSachDoi ?? 0),
              }
            : null,
        };
      }),
    }));
    return { invoices, returns };
  }
}

// ───────────── Hàm hỗ trợ ─────────────

function checkPeriod({ from, to }: ReportPeriodDto): Period {
  for (const d of [from, to]) {
    if (Number.isNaN(Date.parse(`${d}T00:00:00Z`)) || addDays(d, 0) !== d) {
      throw new BadRequestException(`Ngày "${d}" không hợp lệ.`);
    }
  }
  if (from > to) throw new BadRequestException('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
  if (daysInRange(from, to) > MAX_DAYS) {
    throw new BadRequestException(`Kỳ báo cáo tối đa ${MAX_DAYS} ngày.`);
  }
  return { from, to };
}

/** Kỳ trước: cùng số ngày, kết thúc ngay trước ngày bắt đầu của kỳ hiện tại. */
function previousPeriod({ from, to }: Period): Period {
  const days = daysInRange(from, to);
  return { from: addDays(from, -days), to: addDays(from, -1) };
}

/** Khoảng thời gian [00:00 ngày from, 00:00 ngày sau to) theo giờ Việt Nam. */
function dateRange({ from, to }: Period) {
  return { gte: startOfStoreDay(from), lt: startOfStoreDay(addDays(to, 1)) };
}

function dailySums(p: Period, items: { date: Date; value: number }[]): number[] {
  const index = new Map<string, number>();
  const days = daysInRange(p.from, p.to);
  for (let i = 0; i < days; i++) index.set(addDays(p.from, i), i);
  const sums = Array.from({ length: days }, () => 0);
  for (const { date, value } of items) {
    const i = index.get(todayInStore(date));
    if (i !== undefined) sums[i] += value;
  }
  return sums;
}

function sumCard(p: Period, key: string, label: string, items: { date: Date; value: number }[]) {
  const series = dailySums(p, items);
  return { key, label, format: 'number' as const, value: series.reduce((s, n) => s + n, 0), series };
}

function countCard(p: Period, key: string, label: string, dates: Date[]) {
  return sumCard(p, key, label, dates.map((date) => ({ date, value: 1 })));
}

function newCustomersCard(p: Period, dates: Date[]) {
  return countCard(p, 'newCustomers', 'Khách hàng mới', dates);
}
