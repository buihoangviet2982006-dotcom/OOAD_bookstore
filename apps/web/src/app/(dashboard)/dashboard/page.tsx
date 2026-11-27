"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  PackageOpen,
  Plus,
  RotateCcw,
  ShoppingBag,
  Truck,
  Users,
} from "lucide-react";
import { Badge, StatCard } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { downloadCsv } from "@/lib/export";
import {
  daysUntil,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatIsoDate,
  formatNumber,
  percentChange,
  shiftIsoDate,
  todayIsoDate,
} from "@/lib/format";
import { adminService, inventoryService, salesService } from "@/services";
import type { Book, DashboardCard, DashboardSummary, Invoice, PurchaseOrder, Supplier } from "@/types";

type PeriodKey = "TODAY" | "7D" | "MONTH" | "CUSTOM";

const CARD_STYLE: Record<string, { icon: React.ReactNode; bg: string }> = {
  revenue: { icon: <CircleDollarSign className="h-5 w-5" />, bg: "bg-[#E8F3EE] text-[#2D6A4F]" },
  orders: { icon: <ShoppingBag className="h-5 w-5" />, bg: "bg-[#EFF6FF] text-[#1D4ED8]" },
  myOrders: { icon: <ShoppingBag className="h-5 w-5" />, bg: "bg-[#EFF6FF] text-[#1D4ED8]" },
  booksSold: { icon: <BookOpen className="h-5 w-5" />, bg: "bg-[#FEF3C7] text-[#B45309]" },
  myBooksSold: { icon: <BookOpen className="h-5 w-5" />, bg: "bg-[#FEF3C7] text-[#B45309]" },
  myReturns: { icon: <RotateCcw className="h-5 w-5" />, bg: "bg-[#FEE2E2] text-[#B91C1C]" },
  newCustomers: { icon: <Users className="h-5 w-5" />, bg: "bg-[#F3E8FF] text-[#6B21A8]" },
  imports: { icon: <Truck className="h-5 w-5" />, bg: "bg-[#E8F3EE] text-[#2D6A4F]" },
  importedQty: { icon: <PackageOpen className="h-5 w-5" />, bg: "bg-[#EFF6FF] text-[#1D4ED8]" },
  audits: { icon: <ClipboardCheck className="h-5 w-5" />, bg: "bg-[#FEF3C7] text-[#B45309]" },
  lowStock: { icon: <AlertTriangle className="h-5 w-5" />, bg: "bg-[#FEE2E2] text-[#B91C1C]" },
};

/** Khoảng ngày (giờ Việt Nam) của bộ lọc; "Tháng này" = từ ngày 1 đến hôm nay. */
function periodRange(period: PeriodKey, customFrom: string, customTo: string): { from: string; to: string } {
  const today = todayIsoDate();
  if (period === "TODAY") return { from: today, to: today };
  if (period === "7D") return { from: shiftIsoDate(today, -6), to: today };
  if (period === "MONTH") return { from: `${today.slice(0, 8)}01`, to: today };
  return { from: customFrom, to: customTo };
}

const formatValue = (card: DashboardCard) =>
  card.format === "currency" ? formatCurrency(card.value) : formatNumber(card.value);

function trendOf(card: DashboardCard): { text?: string; tone: "up" | "down" | "flat"; sub: string } {
  if (card.previous === null) return { tone: "flat", sub: "Số liệu tại thời điểm hiện tại" };
  const pct = percentChange(card.value, card.previous);
  const previousText = card.format === "currency" ? formatCurrency(card.previous) : formatNumber(card.previous);
  if (pct === null) return { tone: "flat", sub: `Kỳ trước: ${previousText} (không tính được %)` };
  const tone = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  return {
    text: `${Math.abs(pct).toFixed(1).replace(".", ",")}%`,
    tone,
    sub: `so với kỳ trước (${previousText})`,
  };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>("7D");
  const [customFrom, setCustomFrom] = useState(() => shiftIsoDate(todayIsoDate(), -6));
  const [customTo, setCustomTo] = useState(() => todayIsoDate());
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const role = user?.role;
  const canSeeSales = role === "MANAGER" || role === "SALES";
  const canSeeWarehouse = role === "MANAGER" || role === "WAREHOUSE";
  const { from, to } = periodRange(period, customFrom, customTo);

  // Danh sách hỗ trợ (chỉ tải phần vai trò được phép – backend vẫn trả 403 nếu gọi sai quyền).
  useEffect(() => {
    if (!role) return;
    const sales = role === "MANAGER" || role === "SALES";
    const warehouse = role === "MANAGER" || role === "WAREHOUSE";
    Promise.all([
      sales ? salesService.getInvoices() : Promise.resolve([] as Invoice[]),
      role === "WAREHOUSE" ? inventoryService.getPurchaseOrders() : Promise.resolve([] as PurchaseOrder[]),
      inventoryService.getBooks(),
      warehouse ? adminService.getSuppliers() : Promise.resolve([] as Supplier[]),
    ])
      .then(([inv, po, bk, sup]) => {
        setInvoices(inv);
        setPurchaseOrders(po);
        setBooks(bk);
        setSuppliers(sup);
      })
      .catch(() => undefined);
  }, [role]);

  // Chỉ số theo kỳ – backend chọn số liệu theo vai trò.
  useEffect(() => {
    if (!role || !from || !to || from > to) return;
    let cancelled = false;
    adminService
      .getDashboardSummary(from, to)
      .then((res) => {
        if (cancelled) return;
        setSummary(res);
        setSummaryError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSummary(null);
        setSummaryError(err instanceof Error ? err.message : "Không tải được chỉ số.");
      });
    return () => {
      cancelled = true;
    };
  }, [role, from, to]);

  const lowStockBooks = useMemo(
    () =>
      books
        .filter((b) => b.status !== "DISCONTINUED" && b.stock <= b.minStock)
        .sort((a, b) => a.stock - b.stock),
    [books],
  );

  const debtSuppliers = useMemo(() => suppliers.filter((s) => s.currentDebt > 0), [suppliers]);

  const handleExportOverview = () => {
    if (!summary) return;
    downloadCsv(
      `tong-quan_${summary.from}_${summary.to}.csv`,
      ["Chỉ số", `Kỳ này (${summary.from} → ${summary.to})`, `Kỳ trước (${summary.previousFrom} → ${summary.previousTo})`],
      summary.cards.map((c) => [c.label, c.value, c.previous ?? ""]),
    );
  };

  const todayFormatted = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            <span className="capitalize">{todayFormatted}</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            Tổng quan cửa hàng
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Chào {user?.fullName.split(" ").slice(-2).join(" ") ?? "bạn"}
            {role === "MANAGER"
              ? ", đây là số liệu kinh doanh toàn cửa hàng."
              : role === "SALES"
                ? ", đây là số liệu bán hàng của bạn."
                : ", đây là số liệu kho trong kỳ."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportOverview}
            disabled={!summary}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E6E8E5] bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-zinc-500" />
            Xuất chỉ số
          </button>

          {role !== "WAREHOUSE" ? (
            <Link
              href="/sales/pos"
              className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#23533D]"
            >
              <Plus className="h-4 w-4" />
              Tạo đơn hàng
            </Link>
          ) : (
            <Link
              href="/inventory/imports"
              className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#23533D]"
            >
              <Plus className="h-4 w-4" />
              Lập phiếu nhập
            </Link>
          )}
        </div>
      </div>

      {/* Bộ lọc kỳ – ngày theo giờ Việt Nam; kỳ trước = cùng số ngày liền trước */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-1 rounded-xl border border-[#E6E8E5] bg-white p-1 self-start">
          {(
            [
              ["TODAY", "Hôm nay"],
              ["7D", "7 ngày qua"],
              ["MONTH", "Tháng này"],
              ["CUSTOM", "Tùy chỉnh"],
            ] as Array<[PeriodKey, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                period === key ? "bg-[#E8F3EE] font-semibold text-[#2D6A4F]" : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {period === "CUSTOM" ? (
          <div className="inline-flex flex-wrap items-center gap-2 text-xs self-start">
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-xl border border-[#E6E8E5] bg-white px-3 py-1.5"
            />
            <span>→</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-xl border border-[#E6E8E5] bg-white px-3 py-1.5"
            />
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-xl border border-[#E6E8E5] bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 self-start">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <span>
              {formatIsoDate(from)} – {formatIsoDate(to)}
            </span>
          </div>
        )}
      </div>

      {summaryError && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
          {summaryError}
        </div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {summary.cards.map((card) => {
              const trend = trendOf(card);
              const style = CARD_STYLE[card.key] ?? CARD_STYLE.orders;
              return (
                <StatCard
                  key={card.key}
                  label={card.label}
                  value={formatValue(card)}
                  trendText={trend.text}
                  trendTone={trend.tone}
                  subText={trend.sub}
                  icon={style.icon}
                  iconBg={style.bg}
                  sparkline={card.series}
                />
              );
            })}
          </div>
          <p className="text-xs text-zinc-400">
            Kỳ trước để so sánh: {formatIsoDate(summary.previousFrom)} – {formatIsoDate(summary.previousTo)}.
            {role === "MANAGER" && " Doanh thu thuần = tiền hóa đơn + tiền khách bù khi đổi − tiền hoàn trong kỳ."}
          </p>
        </>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Chứng từ gần đây: hóa đơn (bán hàng / quản lý) hoặc phiếu nhập (kho) */}
        <div className="rounded-2xl border border-[#E6E8E5] bg-white p-6 lg:col-span-7">
          {canSeeSales ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900">Hóa đơn gần đây</h2>
                  <p className="text-xs text-zinc-500">5 hóa đơn mới nhất của cửa hàng</p>
                </div>
                <Link
                  href="/sales/invoices"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#2D6A4F] hover:underline"
                >
                  Xem tất cả <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E6E8E5] text-xs font-medium text-zinc-400">
                      <th className="pb-2.5">Mã HĐ</th>
                      <th className="pb-2.5">Khách hàng</th>
                      <th className="pb-2.5">Thời gian</th>
                      <th className="pb-2.5 text-right">Tổng tiền</th>
                      <th className="pb-2.5 text-right">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E8E5]">
                    {invoices.slice(0, 5).map((inv) => (
                      <tr key={inv.id} className="hover:bg-[#F7F8F6]">
                        <td className="py-3 font-mono text-xs font-semibold text-zinc-900">{inv.code}</td>
                        <td className="py-3 text-zinc-700">{inv.customerName}</td>
                        <td className="py-3 text-xs text-zinc-500">{formatDateTime(inv.createdAt)}</td>
                        <td className="py-3 text-right font-semibold text-zinc-900">
                          {formatCurrency(inv.totalAmount)}
                        </td>
                        <td className="py-3 text-right">
                          {inv.status === "COMPLETED" ? (
                            <Badge variant="sage">Hoàn tất</Badge>
                          ) : (
                            <Badge variant="amber">Có đổi/trả</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900">Phiếu nhập gần đây</h2>
                  <p className="text-xs text-zinc-500">5 phiếu nhập mới nhất</p>
                </div>
                <Link
                  href="/inventory/imports"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#2D6A4F] hover:underline"
                >
                  Xem tất cả <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E6E8E5] text-xs font-medium text-zinc-400">
                      <th className="pb-2.5">Mã phiếu</th>
                      <th className="pb-2.5">Nhà cung cấp</th>
                      <th className="pb-2.5">Thời gian</th>
                      <th className="pb-2.5 text-right">Tổng tiền</th>
                      <th className="pb-2.5 text-right">Còn nợ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E8E5]">
                    {purchaseOrders.slice(0, 5).map((po) => (
                      <tr key={po.id} className="hover:bg-[#F7F8F6]">
                        <td className="py-3 font-mono text-xs font-semibold text-zinc-900">{po.code}</td>
                        <td className="py-3 text-zinc-700">{po.supplierName}</td>
                        <td className="py-3 text-xs text-zinc-500">{formatDateTime(po.createdAt)}</td>
                        <td className="py-3 text-right font-semibold text-zinc-900">
                          {formatCurrency(po.totalAmount)}
                        </td>
                        <td className="py-3 text-right">{formatCurrency(po.debtAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="space-y-5 lg:col-span-5">
          <div className="rounded-2xl border border-[#E6E8E5] bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#B45309]" />
                <h3 className="text-sm font-semibold text-zinc-900">
                  Cảnh báo tồn kho thấp ({lowStockBooks.length})
                </h3>
              </div>
              {canSeeWarehouse && (
                <Link href="/inventory/stock" className="text-xs font-medium text-[#2D6A4F] hover:underline">
                  Kiểm tra kho
                </Link>
              )}
            </div>
            <div className="mt-3 space-y-2.5">
              {lowStockBooks.slice(0, 4).map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-xl bg-[#F7F8F6] px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0 pr-3">
                    <div className="truncate font-medium text-zinc-800">{b.title}</div>
                    <div className="text-zinc-400">
                      {b.sku} • Định mức tối thiểu: {b.minStock}
                    </div>
                  </div>
                  <Badge variant={b.stock === 0 ? "crimson" : "amber"}>
                    {b.stock === 0 ? "Hết hàng" : `Còn ${b.stock}`}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {canSeeWarehouse && (
            <div className="rounded-2xl border border-[#E6E8E5] bg-white p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Công nợ Nhà cung cấp cần lưu ý ({debtSuppliers.length})
                </h3>
                <Link href="/inventory/imports" className="text-xs font-medium text-[#2D6A4F] hover:underline">
                  Quản lý công nợ
                </Link>
              </div>
              <div className="mt-3 space-y-2.5">
                {debtSuppliers.map((sup) => {
                  const days = daysUntil(sup.dueDate);
                  const overdue = days !== null && days < 0;
                  return (
                    <div
                      key={sup.id}
                      className="flex items-center justify-between rounded-xl bg-[#F7F8F6] px-3.5 py-2.5 text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="truncate font-medium text-zinc-800">{sup.name}</div>
                        <div className="text-zinc-500">Hạn thanh toán: {formatDate(sup.dueDate)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold text-zinc-900">{formatCurrency(sup.currentDebt)}</div>
                        <Badge variant={overdue ? "crimson" : "amber"}>
                          {overdue ? `Quá hạn ${Math.abs(days)} ngày` : `Còn ${days ?? 0} ngày`}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
