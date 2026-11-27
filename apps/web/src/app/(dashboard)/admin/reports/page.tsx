"use client";

import React, { useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { Badge, PageHeader } from "@/components/ui";
import { downloadCsv, triggerPrint } from "@/lib/export";
import { formatCurrency, formatDate, formatIsoDate, percentChange, shiftIsoDate, todayIsoDate } from "@/lib/format";
import { adminService, inventoryService } from "@/services";
import type { BestsellerRow, Book, RevenueReport, Supplier } from "@/types";

type ReportTab = "REVENUE" | "BESTSELLERS" | "INVENTORY" | "SUPPLIER_DEBT";
type DataState = { status: "loading" | "ready" | "error"; message?: string };

function Change({ current, previous }: { current: number; previous: number }) {
  const pct = percentChange(current, previous);
  if (pct === null) return <span className="text-zinc-400">Kỳ trước: 0 – không tính được %</span>;
  return (
    <span className={pct >= 0 ? "text-[#2D6A4F]" : "text-[#B91C1C]"}>
      {pct >= 0 ? "↗" : "↘"} {Math.abs(pct).toFixed(1).replace(".", ",")}% so kỳ trước ({formatCurrency(previous)})
    </span>
  );
}

function TotalCard({
  title,
  value,
  previous,
  accent,
  children,
}: {
  title: string;
  value: number;
  previous: number;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#E6E8E5] bg-white p-5">
      <div className="text-xs font-semibold uppercase text-zinc-500">{title}</div>
      <div className={`mt-2 text-2xl font-bold ${accent ? "text-[#2D6A4F]" : "text-zinc-900"}`}>
        {formatCurrency(value)}
      </div>
      <div className="mt-1 text-xs">
        <Change current={value} previous={previous} />
      </div>
      <div className="mt-3 space-y-0.5 text-xs text-zinc-500">{children}</div>
    </div>
  );
}

const TH = "px-5 py-3.5";
const CHART_HEIGHT = 160;

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("REVENUE");
  const [from, setFrom] = useState(() => shiftIsoDate(todayIsoDate(), -6));
  const [to, setTo] = useState(() => todayIsoDate());
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [bestSellers, setBestSellers] = useState<BestsellerRow[]>([]);
  const [error, setError] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockState, setStockState] = useState<DataState>({ status: "loading" });
  const [debtState, setDebtState] = useState<DataState>({ status: "loading" });

  // Tồn kho, công nợ NCC: số liệu tại thời điểm hiện tại (không theo kỳ).
  useEffect(() => {
    let cancelled = false;
    inventoryService.getBooks().then((bk) => {
      if (cancelled) return;
      setBooks(bk);
      setStockState({ status: "ready" });
    }).catch((err: unknown) => {
      if (!cancelled) setStockState({ status: "error", message: err instanceof Error ? err.message : "Không tải được tồn kho." });
    });
    adminService.getSuppliers().then((sup) => {
      if (cancelled) return;
      setSuppliers(sup);
      setDebtState({ status: "ready" });
    }).catch((err: unknown) => {
      if (!cancelled) setDebtState({ status: "error", message: err instanceof Error ? err.message : "Không tải được công nợ NCC." });
    });
    return () => { cancelled = true; };
  }, []);

  // Doanh thu, sách bán chạy: theo kỳ (ngày giờ Việt Nam, tính cả hai đầu).
  useEffect(() => {
    if (!from || !to || from > to) return;
    let cancelled = false;
    Promise.all([adminService.getRevenueReport(from, to), adminService.getBestsellers(from, to)])
      .then(([rev, best]) => {
        if (cancelled) return;
        setReport(rev);
        setBestSellers(best);
        setError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setReport(null);
        setBestSellers([]);
        setError(err instanceof Error ? err.message : "Không tải được báo cáo.");
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const series = report?.series ?? [];
  // Thang biểu đồ gồm cả phần âm (ngày hoàn tiền nhiều hơn bán): mốc 0 nằm giữa nếu có số âm.
  const values = series.flatMap((r) => [r.revenue, r.profit]);
  const maxPos = Math.max(0, ...values);
  const maxNeg = Math.max(0, ...values.map((v) => -v));
  const span = maxPos + maxNeg || 1;
  const zeroTop = Math.round((maxPos / span) * CHART_HEIGHT);
  const ChartBar = ({ value, label, color }: { value: number; label: string; color: string }) => {
    const height = Math.round((Math.abs(value) / span) * CHART_HEIGHT);
    return (
      <div className="relative w-4 sm:w-6">
        <div
          title={`${label}: ${formatCurrency(value)}`}
          className={`absolute inset-x-0 ${color} ${value >= 0 ? "rounded-t-md" : "rounded-b-md opacity-80"}`}
          style={value >= 0 ? { top: zeroTop - height, height } : { top: zeroTop, height }}
        />
      </div>
    );
  };

  const handleExportCurrentReport = () => {
    if ((tab === "INVENTORY" && stockState.status !== "ready") ||
        (tab === "SUPPLIER_DEBT" && debtState.status !== "ready")) return;
    if (tab === "REVENUE") {
      downloadCsv(
        `doanh-thu_${from}_${to}.csv`,
        ["Ngày", "Số hóa đơn", "Sách bán (thuần)", "Doanh thu thuần", "Giá vốn thuần", "Lợi nhuận gộp"],
        series.map((r) => [r.date, r.orders, r.booksSold, r.revenue, r.cost, r.profit]),
      );
    } else if (tab === "BESTSELLERS") {
      downloadCsv(
        `sach-ban-chay_${from}_${to}.csv`,
        ["Mã sách", "Tên sách", "Bán ra", "Nhận lại", "Đổi ra", "Số lượng thuần", "Doanh thu thuần"],
        bestSellers.map((b) => [b.bookId, b.title, b.soldQty, b.returnedQty, b.exchangedOutQty, b.netQty, b.revenue]),
      );
    } else if (tab === "INVENTORY") {
      downloadCsv(
        "bao-cao-ton-kho.csv",
        ["Mã sách", "Tên sách", "Thể loại", "Tồn hiện tại", "Giá nhập gần nhất", "Giá trị tồn (ước tính)"],
        books.map((b) => [b.sku, b.title, b.categoryName, b.stock, b.importPrice, b.stock * b.importPrice]),
      );
    } else {
      downloadCsv(
        "bao-cao-cong-no-ncc.csv",
        ["Mã NCC", "Tên Nhà cung cấp", "Tổng kim ngạch nhập", "Dư nợ hiện tại", "Hạn thanh toán gần nhất"],
        suppliers.map((s) => [s.code, s.name, s.totalImportAmount, s.currentDebt, formatDate(s.dueDate)]),
      );
    }
  };

  const byPeriod = tab === "REVENUE" || tab === "BESTSELLERS";
  const currentDataState: DataState = tab === "INVENTORY" ? stockState : tab === "SUPPLIER_DEBT" ? debtState : { status: "ready" };

  return (
    <div>
      <PageHeader
        title="Thống kê &amp; Báo cáo điều hành"
        subtitle="Doanh thu, lợi nhuận gộp, sách bán chạy theo kỳ; tồn kho và công nợ NCC tại thời điểm hiện tại"
        actions={
          <>
            <button
              type="button"
              onClick={triggerPrint}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E6E8E5] bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Printer className="h-4 w-4" />
              In báo cáo
            </button>
            <button
              type="button"
              onClick={handleExportCurrentReport}
              disabled={currentDataState.status !== "ready"}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23533D]"
            >
              <Download className="h-4 w-4" />
              Xuất file CSV
            </button>
          </>
        }
      />

      <div className="no-print mb-6 inline-flex flex-wrap rounded-xl border border-[#E6E8E5] bg-white p-1">
        {(
          [
            ["REVENUE", "Thống kê doanh thu"],
            ["BESTSELLERS", "Sách bán chạy"],
            ["INVENTORY", "Báo cáo tồn kho"],
            ["SUPPLIER_DEBT", "Báo cáo công nợ NCC"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold ${
              tab === key ? "bg-[#E8F3EE] text-[#2D6A4F]" : "text-zinc-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {byPeriod && (
        <div className="no-print mb-5 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-zinc-600">Kỳ báo cáo (giờ Việt Nam):</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-xl border border-[#E6E8E5] bg-white px-3 py-1.5"
          />
          <span>→</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-xl border border-[#E6E8E5] bg-white px-3 py-1.5"
          />
          {report && (
            <span className="text-zinc-400">
              Kỳ trước để so sánh: {formatIsoDate(report.previousFrom)} – {formatIsoDate(report.previousTo)}
            </span>
          )}
        </div>
      )}

      {byPeriod && error && (
        <div className="mb-5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
          {error}
        </div>
      )}
      {!byPeriod && currentDataState.status !== "ready" && (
        <div role={currentDataState.status === "loading" ? "status" : "alert"} className="mb-5 rounded-xl border px-4 py-3 text-sm">
          {currentDataState.status === "loading" ? "Đang tải báo cáo…" : currentDataState.message}
        </div>
      )}

      {/* Tab 1: Doanh thu */}
      {tab === "REVENUE" && report && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <TotalCard title="Doanh thu thuần" value={report.totals.revenue} previous={report.previousTotals.revenue}>
              <div>
                Tiền hóa đơn ({report.totals.orders} HĐ): {formatCurrency(report.totals.invoiceAmount)}
              </div>
              <div>+ Khách bù khi đổi: {formatCurrency(report.totals.exchangeIn)}</div>
              <div>− Hoàn tiền đổi/trả: {formatCurrency(report.totals.refunds)}</div>
            </TotalCard>
            <TotalCard title="Giá vốn thuần" value={report.totals.cost} previous={report.previousTotals.cost}>
              <div>Giá vốn sách bán: {formatCurrency(report.totals.saleCost)}</div>
              <div>− Giá vốn sách nhận lại: {formatCurrency(report.totals.returnedCost)}</div>
              <div>+ Giá vốn sách đổi ra: {formatCurrency(report.totals.exchangeOutCost)}</div>
            </TotalCard>
            <TotalCard
              title="Lợi nhuận gộp"
              value={report.totals.profit}
              previous={report.previousTotals.profit}
              accent
            >
              <div>= Doanh thu thuần − Giá vốn thuần.</div>
              <div>Giá vốn theo giá đã lưu trên chứng từ; đổi/trả tính vào ngày lập phiếu.</div>
            </TotalCard>
          </div>

          <div className="rounded-2xl border border-[#E6E8E5] bg-white p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">
                  Doanh thu thuần &amp; Lợi nhuận gộp theo ngày
                </h3>
                <p className="text-xs text-zinc-500">
                  Đơn vị: VNĐ. Ngày có tiền hoàn lớn hơn tiền bán có giá trị âm – cột vẽ xuống dưới đường mốc 0.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-[#2D6A4F]" /> Doanh thu thuần
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-[#A7C9B8]" /> Lợi nhuận gộp
                </span>
              </div>
            </div>

            <div className="flex gap-3 overflow-x-auto border-b border-[#E6E8E5] pb-3 pt-4">
              {series.map((pt) => (
                <div key={pt.date} className="flex min-w-[44px] flex-1 flex-col items-center gap-2">
                  <div className="relative flex h-40 gap-1.5">
                    {/* Đường mốc 0: cột dương vẽ lên trên, cột âm vẽ xuống dưới */}
                    <div
                      className="pointer-events-none absolute -inset-x-1.5 border-t border-zinc-300"
                      style={{ top: `${zeroTop}px` }}
                    />
                    <ChartBar value={pt.revenue} label="Doanh thu thuần" color="bg-[#2D6A4F]" />
                    <ChartBar value={pt.profit} label="Lợi nhuận gộp" color="bg-[#A7C9B8]" />
                  </div>
                  <span className="text-xs font-medium text-zinc-600">{pt.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
                <tr>
                  <th className={TH}>Ngày</th>
                  <th className={`${TH} text-center`}>Số hóa đơn</th>
                  <th className={`${TH} text-center`}>Sách bán (thuần)</th>
                  <th className={`${TH} text-right`}>Doanh thu thuần</th>
                  <th className={`${TH} text-right`}>Giá vốn thuần</th>
                  <th className={`${TH} text-right`}>Lợi nhuận gộp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8E5]">
                {series.map((r) => (
                  <tr key={r.date}>
                    <td className="px-5 py-3 font-medium">{formatIsoDate(r.date)}</td>
                    <td className="px-5 py-3 text-center">{r.orders}</td>
                    <td className="px-5 py-3 text-center">{r.booksSold}</td>
                    <td className="px-5 py-3 text-right font-semibold">{formatCurrency(r.revenue)}</td>
                    <td className="px-5 py-3 text-right text-zinc-600">{formatCurrency(r.cost)}</td>
                    <td className="px-5 py-3 text-right font-bold text-[#2D6A4F]">{formatCurrency(r.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Sách bán chạy */}
      {tab === "BESTSELLERS" && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className={TH}>Hạng</th>
                <th className={TH}>Mã sách</th>
                <th className={TH}>Tên đầu sách</th>
                <th className={`${TH} text-center`}>Bán ra</th>
                <th className={`${TH} text-center`}>Nhận lại</th>
                <th className={`${TH} text-center`}>Đổi ra</th>
                <th className={`${TH} text-center`}>Số lượng thuần</th>
                <th className={`${TH} text-right`}>Doanh thu thuần</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {bestSellers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-6 text-center text-xs text-zinc-400">
                    Không có giao dịch bán / đổi trả trong kỳ.
                  </td>
                </tr>
              )}
              {bestSellers.map((item, idx) => (
                <tr key={item.bookId}>
                  <td className="px-5 py-3.5 font-bold text-[#2D6A4F]">#{idx + 1}</td>
                  <td className="px-5 py-3.5 font-mono text-xs">{item.bookId}</td>
                  <td className="px-5 py-3.5 font-semibold text-zinc-900">{item.title}</td>
                  <td className="px-5 py-3.5 text-center">{item.soldQty}</td>
                  <td className="px-5 py-3.5 text-center text-zinc-500">{item.returnedQty}</td>
                  <td className="px-5 py-3.5 text-center text-zinc-500">{item.exchangedOutQty}</td>
                  <td className="px-5 py-3.5 text-center font-bold">{item.netQty} cuốn</td>
                  <td className="px-5 py-3.5 text-right font-bold text-[#2D6A4F]">{formatCurrency(item.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Tồn kho (hiện tại) */}
      {tab === "INVENTORY" && stockState.status === "ready" && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
          <p className="border-b border-[#E6E8E5] px-5 py-3 text-xs text-zinc-500">
            Tồn kho tại thời điểm hiện tại. Giá trị tồn là ước tính theo giá nhập gần nhất của từng sách.
          </p>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className={TH}>Mã SP</th>
                <th className={TH}>Tên sách</th>
                <th className={TH}>Thể loại</th>
                <th className={`${TH} text-center`}>Tồn hiện tại</th>
                <th className={`${TH} text-right`}>Giá nhập gần nhất</th>
                <th className={`${TH} text-right`}>Giá trị tồn (ước tính)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {books.map((b) => (
                <tr key={b.id}>
                  <td className="px-5 py-3.5 font-mono text-xs font-semibold">{b.sku}</td>
                  <td className="px-5 py-3.5 font-medium text-zinc-900">{b.title}</td>
                  <td className="px-5 py-3.5 text-xs text-zinc-500">{b.categoryName}</td>
                  <td className="px-5 py-3.5 text-center font-semibold">{b.stock}</td>
                  <td className="px-5 py-3.5 text-right text-zinc-600">{formatCurrency(b.importPrice)}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-zinc-900">
                    {formatCurrency(b.stock * b.importPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Công nợ NCC (hiện tại) */}
      {tab === "SUPPLIER_DEBT" && debtState.status === "ready" && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className={TH}>Mã NCC</th>
                <th className={TH}>Nhà cung cấp</th>
                <th className={`${TH} text-right`}>Tổng phát sinh mua</th>
                <th className={`${TH} text-right`}>Đã thanh toán</th>
                <th className={`${TH} text-right`}>Dư nợ phải trả</th>
                <th className={`${TH} text-center`}>Hạn thanh toán</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-3.5 font-mono text-xs font-bold">{s.code}</td>
                  <td className="px-5 py-3.5 font-semibold text-zinc-900">{s.name}</td>
                  <td className="px-5 py-3.5 text-right">{formatCurrency(s.totalImportAmount)}</td>
                  <td className="px-5 py-3.5 text-right text-[#2D6A4F]">
                    {formatCurrency(s.totalImportAmount - s.currentDebt)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-[#B91C1C]">{formatCurrency(s.currentDebt)}</td>
                  <td className="px-5 py-3.5 text-center">
                    {s.currentDebt === 0 ? (
                      <Badge variant="sage">Đã tất toán</Badge>
                    ) : (
                      <Badge variant="amber">{formatDate(s.dueDate)}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
