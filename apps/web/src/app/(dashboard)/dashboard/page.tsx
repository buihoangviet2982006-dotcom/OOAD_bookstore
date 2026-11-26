"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  CircleDollarSign,
  Download,
  Plus,
  ShoppingBag,
  Users,
} from "lucide-react";
import { Badge, StatCard } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { downloadCsv } from "@/lib/export";
import { daysUntil, formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { adminService, inventoryService, salesService } from "@/services";
import type { Book, Customer, Invoice, Supplier } from "@/types";

type PeriodKey = "TODAY" | "7D" | "MONTH" | "CUSTOM";

export default function DashboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>("7D");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    Promise.all([
      salesService.getInvoices(),
      inventoryService.getBooks(),
      salesService.getCustomers(),
      adminService.getSuppliers(),
    ]).then(([inv, bk, cus, sup]) => {
      setInvoices(inv);
      setBooks(bk);
      setCustomers(cus);
      setSuppliers(sup);
    });
  }, []);

  const multiplier = period === "TODAY" ? 0.35 : period === "7D" ? 1 : period === "MONTH" ? 3.8 : 1.5;

  const stats = useMemo(() => {
    const baseRev = invoices.reduce((acc, item) => acc + item.totalAmount, 0);
    const baseBooksSold = invoices.reduce(
      (acc, inv) => acc + inv.items.reduce((s, it) => s + it.quantity, 0),
      0,
    );
    return {
      revenue: Math.round(baseRev * multiplier),
      orders: Math.max(1, Math.round(invoices.length * multiplier)),
      booksSold: Math.max(1, Math.round(baseBooksSold * multiplier)),
      customerCount: customers.length,
    };
  }, [invoices, customers, multiplier]);

  const lowStockBooks = useMemo(
    () => books.filter((b) => b.stock <= b.minStock).sort((a, b) => a.stock - b.stock),
    [books],
  );

  const debtSuppliers = useMemo(
    () => suppliers.filter((s) => s.currentDebt > 0),
    [suppliers],
  );

  const handleExportOverview = () => {
    downloadCsv(
      "tong-quan-nha-sach.csv",
      ["Mã hóa đơn", "Thời gian", "Khách hàng", "Thu ngân", "Tổng thanh toán"],
      invoices.map((i) => [i.code, formatDateTime(i.createdAt), i.customerName, i.cashierName, i.totalAmount]),
    );
  };

  const todayFormatted = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* Top Greeting Header inspired by Mộc Books reference */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            <span className="capitalize">{todayFormatted}</span>
            <span>•</span>
            <span className="text-[#2D6A4F]">Một ngày kinh doanh hiệu quả</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            Tổng quan cửa hàng
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Chào {user?.fullName.split(" ").slice(-2).join(" ") ?? "bạn"}, cùng xem nhà sách của bạn hôm nay nhé.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportOverview}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E6E8E5] bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Download className="h-4 w-4 text-zinc-500" />
            Xuất báo cáo
          </button>

          {user?.role !== "WAREHOUSE" ? (
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

      {/* Period Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-1 rounded-xl border border-[#E6E8E5] bg-white p-1 self-start">
          {(
            [
              ["TODAY", "Hôm nay"],
              ["7D", "7 ngày qua"],
              ["MONTH", "Tháng này"],
              ["CUSTOM", "Tùy chỉnh"],
            ] as Array<[PeriodKey, string]>
          ).map(([key, label]) => {
            const active = period === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-[#E8F3EE] font-semibold text-[#2D6A4F]"
                    : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-[#E6E8E5] bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 self-start">
          <Calendar className="h-4 w-4 text-zinc-400" />
          <span>20/11/2026 – 26/11/2026</span>
        </div>
      </div>

      {/* 4 Main KPI Cards matching Mộc Books reference */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <StatCard
          label="Tổng doanh thu"
          value={formatCurrency(stats.revenue)}
          trendText="12,8%"
          subText="so với kỳ trước"
          icon={<CircleDollarSign className="h-5 w-5" />}
          iconBg="bg-[#E8F3EE] text-[#2D6A4F]"
          sparkline={[18, 26, 22, 34, 30, 42, 38, 52]}
        />
        <StatCard
          label="Tổng đơn hàng"
          value={String(stats.orders)}
          trendText="8,2%"
          subText="so với kỳ trước"
          icon={<ShoppingBag className="h-5 w-5" />}
          iconBg="bg-[#EFF6FF] text-[#1D4ED8]"
          sparkline={[12, 16, 15, 22, 20, 29, 27, 32]}
        />
        <StatCard
          label="Số sách đã bán"
          value={String(stats.booksSold)}
          trendText="15,3%"
          subText="so với kỳ trước"
          icon={<BookOpen className="h-5 w-5" />}
          iconBg="bg-[#FEF3C7] text-[#B45309]"
          sparkline={[15, 19, 24, 21, 31, 29, 39, 44]}
        />
        <StatCard
          label="Khách hàng thành viên"
          value={String(stats.customerCount)}
          trendText="6,4%"
          subText="khách hàng mới"
          icon={<Users className="h-5 w-5" />}
          iconBg="bg-[#F3E8FF] text-[#6B21A8]"
          sparkline={[10, 14, 13, 19, 18, 23, 22, 28]}
        />
      </div>

      {/* Operational Insights Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Recent Invoices */}
        <div className="rounded-2xl border border-[#E6E8E5] bg-white p-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Hóa đơn giao dịch gần đây</h2>
              <p className="text-xs text-zinc-500">Các đơn bán tại quầy mới nhất trong ca</p>
            </div>
            {user?.role !== "WAREHOUSE" && (
              <Link
                href="/sales/invoices"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2D6A4F] hover:underline"
              >
                Xem tất cả <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
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
                    <td className="py-3 font-mono text-xs font-semibold text-zinc-900">
                      {inv.code}
                    </td>
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
        </div>

        {/* Stock & Supplier Debt Alerts */}
        <div className="space-y-5 lg:col-span-5">
          {/* Low stock alert card */}
          <div className="rounded-2xl border border-[#E6E8E5] bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#B45309]" />
                <h3 className="text-sm font-semibold text-zinc-900">
                  Cảnh báo tồn kho thấp ({lowStockBooks.length})
                </h3>
              </div>
              {user?.role !== "SALES" && (
                <Link
                  href="/inventory/stock"
                  className="text-xs font-medium text-[#2D6A4F] hover:underline"
                >
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

          {/* Supplier Debt Due Soon */}
          <div className="rounded-2xl border border-[#E6E8E5] bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">
                Công nợ Nhà cung cấp cần lưu ý ({debtSuppliers.length})
              </h3>
              {user?.role !== "SALES" && (
                <Link
                  href="/inventory/imports"
                  className="text-xs font-medium text-[#2D6A4F] hover:underline"
                >
                  Quản lý công nợ
                </Link>
              )}
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
                      <div className="text-zinc-500">
                        Hạn thanh toán: {formatDate(sup.dueDate)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-zinc-900">
                        {formatCurrency(sup.currentDebt)}
                      </div>
                      <Badge variant={overdue ? "crimson" : "amber"}>
                        {overdue ? `Quá hạn ${Math.abs(days)} ngày` : `Còn ${days ?? 0} ngày`}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
