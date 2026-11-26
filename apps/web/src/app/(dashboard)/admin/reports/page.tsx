"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { Badge, PageHeader } from "@/components/ui";
import { downloadCsv, triggerPrint } from "@/lib/export";
import { formatCurrency, formatDate } from "@/lib/format";
import { adminService, inventoryService, salesService } from "@/services";
import type { Book, Invoice, RevenuePoint, Supplier } from "@/types";

type ReportTab = "REVENUE" | "BESTSELLERS" | "INVENTORY" | "SUPPLIER_DEBT";

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("REVENUE");
  const [revenueSeries, setRevenueSeries] = useState<RevenuePoint[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    Promise.all([
      adminService.getRevenueSeries(),
      salesService.getInvoices(),
      inventoryService.getBooks(),
      adminService.getSuppliers(),
    ]).then(([rev, inv, bk, sup]) => {
      setRevenueSeries(rev);
      setInvoices(inv);
      setBooks(bk);
      setSuppliers(sup);
    });
  }, []);

  const bestSellers = useMemo(() => {
    const map = new Map<
      string,
      { sku: string; title: string; qtySold: number; revenue: number }
    >();
    invoices.forEach((inv) => {
      inv.items.forEach((it) => {
        const prev = map.get(it.bookId) ?? {
          sku: it.sku,
          title: it.title,
          qtySold: 0,
          revenue: 0,
        };
        prev.qtySold += it.quantity;
        prev.revenue += it.subtotal;
        map.set(it.bookId, prev);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.qtySold - a.qtySold);
  }, [invoices]);

  const maxRev = Math.max(1, ...revenueSeries.map((r) => r.revenue));

  const handleExportCurrentReport = () => {
    if (tab === "REVENUE") {
      downloadCsv(
        "bao-cao-doanh-thu.csv",
        ["Ngày", "Số đơn", "Doanh thu", "Giá vốn", "Lợi nhuận gộp"],
        revenueSeries.map((r) => [r.label, r.orders, r.revenue, r.cost, r.profit]),
      );
    } else if (tab === "BESTSELLERS") {
      downloadCsv(
        "thong-ke-sach-ban-chay.csv",
        ["Mã sách", "Tên sách", "Số lượng đã bán", "Doanh thu mang lại"],
        bestSellers.map((b) => [b.sku, b.title, b.qtySold, b.revenue]),
      );
    } else if (tab === "INVENTORY") {
      downloadCsv(
        "bao-cao-ton-kho.csv",
        ["Mã sách", "Tên sách", "Thể loại", "Tồn kho", "Giá vốn", "Giá trị tồn kho"],
        books.map((b) => [
          b.sku,
          b.title,
          b.categoryName,
          b.stock,
          b.importPrice,
          b.stock * b.importPrice,
        ]),
      );
    } else {
      downloadCsv(
        "bao-cao-cong-no-ncc.csv",
        ["Mã NCC", "Tên Nhà cung cấp", "Tổng kim ngạch nhập", "Dư nợ cuối kỳ", "Hạn thanh toán"],
        suppliers.map((s) => [
          s.code,
          s.name,
          s.totalImportAmount,
          s.currentDebt,
          formatDate(s.dueDate),
        ]),
      );
    }
  };

  return (
    <div>
      <PageHeader
        title="Thống kê &amp; Báo cáo điều hành"
        subtitle="Phân tích doanh thu, sách bán chạy, tồn kho và công nợ nhà cung cấp; hỗ trợ xuất CSV và in ấn"
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
              className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23533D]"
            >
              <Download className="h-4 w-4" />
              Xuất file CSV
            </button>
          </>
        }
      />

      {/* Report Tabs */}
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

      {/* Tab 1: Revenue */}
      {tab === "REVENUE" && (
        <div className="space-y-6">
          {/* Flat Bar Chart */}
          <div className="rounded-2xl border border-[#E6E8E5] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">
                  Biểu đồ Doanh thu &amp; Lợi nhuận gộp (7 ngày gần nhất)
                </h3>
                <p className="text-xs text-zinc-500">Đơn vị tính: Đồng Việt Nam (VNĐ)</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-[#2D6A4F]" /> Doanh thu
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-[#A7C9B8]" /> Lợi nhuận gộp
                </span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-3 items-end h-52 pt-4 border-b border-[#E6E8E5] pb-3">
              {revenueSeries.map((pt) => {
                const revH = Math.round((pt.revenue / maxRev) * 160);
                const profH = Math.round((pt.profit / maxRev) * 160);
                return (
                  <div key={pt.label} className="flex flex-col items-center gap-2">
                    <div className="flex items-end gap-1.5 h-40">
                      <div
                        style={{ height: `${revH}px` }}
                        title={`Doanh thu: ${formatCurrency(pt.revenue)}`}
                        className="w-4 sm:w-6 rounded-t-md bg-[#2D6A4F]"
                      />
                      <div
                        style={{ height: `${profH}px` }}
                        title={`Lợi nhuận: ${formatCurrency(pt.profit)}`}
                        className="w-4 sm:w-6 rounded-t-md bg-[#A7C9B8]"
                      />
                    </div>
                    <span className="text-xs font-medium text-zinc-600">{pt.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
                <tr>
                  <th className="px-5 py-3.5">Ngày</th>
                  <th className="px-5 py-3.5 text-center">Số đơn hàng</th>
                  <th className="px-5 py-3.5 text-right">Doanh thu thuần</th>
                  <th className="px-5 py-3.5 text-right">Giá vốn hàng bán</th>
                  <th className="px-5 py-3.5 text-right">Lợi nhuận gộp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8E5]">
                {revenueSeries.map((r) => (
                  <tr key={r.label}>
                    <td className="px-5 py-3 font-medium">{r.label}/2026</td>
                    <td className="px-5 py-3 text-center">{r.orders}</td>
                    <td className="px-5 py-3 text-right font-semibold">
                      {formatCurrency(r.revenue)}
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-600">{formatCurrency(r.cost)}</td>
                    <td className="px-5 py-3 text-right font-bold text-[#2D6A4F]">
                      {formatCurrency(r.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Bestsellers */}
      {tab === "BESTSELLERS" && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Hạng</th>
                <th className="px-5 py-3.5">Mã sách</th>
                <th className="px-5 py-3.5">Tên đầu sách</th>
                <th className="px-5 py-3.5 text-center">Số lượng bán ra</th>
                <th className="px-5 py-3.5 text-right">Doanh thu đóng góp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {bestSellers.map((item, idx) => (
                <tr key={item.sku}>
                  <td className="px-5 py-3.5 font-bold text-[#2D6A4F]">#{idx + 1}</td>
                  <td className="px-5 py-3.5 font-mono text-xs">{item.sku}</td>
                  <td className="px-5 py-3.5 font-semibold text-zinc-900">{item.title}</td>
                  <td className="px-5 py-3.5 text-center font-bold">{item.qtySold} cuốn</td>
                  <td className="px-5 py-3.5 text-right font-bold text-[#2D6A4F]">
                    {formatCurrency(item.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Inventory Report */}
      {tab === "INVENTORY" && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Mã SP</th>
                <th className="px-5 py-3.5">Tên sách</th>
                <th className="px-5 py-3.5">Thể loại</th>
                <th className="px-5 py-3.5 text-center">Tồn cuối kỳ</th>
                <th className="px-5 py-3.5 text-right">Đơn giá vốn</th>
                <th className="px-5 py-3.5 text-right">Tổng giá trị tồn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {books.map((b) => (
                <tr key={b.id}>
                  <td className="px-5 py-3.5 font-mono text-xs font-semibold">{b.sku}</td>
                  <td className="px-5 py-3.5 font-medium text-zinc-900">{b.title}</td>
                  <td className="px-5 py-3.5 text-xs text-zinc-500">{b.categoryName}</td>
                  <td className="px-5 py-3.5 text-center font-semibold">{b.stock}</td>
                  <td className="px-5 py-3.5 text-right text-zinc-600">
                    {formatCurrency(b.importPrice)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-zinc-900">
                    {formatCurrency(b.stock * b.importPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Supplier Debt Report */}
      {tab === "SUPPLIER_DEBT" && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Mã NCC</th>
                <th className="px-5 py-3.5">Nhà cung cấp</th>
                <th className="px-5 py-3.5 text-right">Tổng phát sinh mua</th>
                <th className="px-5 py-3.5 text-right">Đã thanh toán</th>
                <th className="px-5 py-3.5 text-right">Dư nợ phải trả</th>
                <th className="px-5 py-3.5 text-center">Hạn thanh toán</th>
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
                  <td className="px-5 py-3.5 text-right font-bold text-[#B91C1C]">
                    {formatCurrency(s.currentDebt)}
                  </td>
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
