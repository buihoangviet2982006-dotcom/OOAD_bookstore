"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, Plus, Printer, RotateCcw, Search } from "lucide-react";
import { Badge, Drawer, PageHeader } from "@/components/ui";
import { BRAND_CONFIG } from "@/config/brand";
import { useToast } from "@/context/ToastContext";
import { InvoiceReceipt, printInvoice } from "@/components/invoice/InvoiceReceipt";
import { downloadCsv } from "@/lib/export";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { salesService } from "@/services";
import type { Invoice, PaymentMethod } from "@/types";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  TRANSFER: "Chuyển khoản",
  CARD: "Thẻ POS",
};

export default function InvoicesPage() {
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    salesService
      .getInvoices()
      .then(setInvoices)
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Không tải được danh sách hóa đơn.", "error"),
      );
  }, [showToast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (paymentFilter !== "ALL" && inv.paymentMethod !== paymentFilter) return false;
      if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;
      if (!q) return true;
      return (
        inv.code.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.customerPhone.toLowerCase().includes(q) ||
        inv.cashierName.toLowerCase().includes(q)
      );
    });
  }, [invoices, query, paymentFilter, statusFilter]);

  const handleExport = () => {
    downloadCsv(
      "danh-sach-hoa-don.csv",
      ["Mã hóa đơn", "Thời gian", "Khách hàng", "SĐT", "Thu ngân", "Giảm giá", "Tổng tiền", "Thanh toán"],
      filtered.map((i) => [
        i.code,
        formatDateTime(i.createdAt),
        i.customerName,
        i.customerPhone,
        i.cashierName,
        i.discountAmount,
        i.totalAmount,
        PAYMENT_LABELS[i.paymentMethod],
      ]),
    );
  };

  return (
    <div>
      <PageHeader
        title="Tra cứu hóa đơn bán hàng"
        subtitle="Theo dõi toàn bộ chứng từ thanh toán, khuyến mãi đã áp dụng và in lại hóa đơn"
        actions={
          <>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E6E8E5] bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Download className="h-4 w-4" />
              Xuất CSV
            </button>
            <Link
              href="/sales/pos"
              className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23533D]"
            >
              <Plus className="h-4 w-4" />
              Lập hóa đơn mới
            </Link>
          </>
        }
      />

      {/* Filter Bar */}
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#E6E8E5] bg-white p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo mã HĐ, tên khách hàng, SĐT hoặc thu ngân..."
            className="w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] py-2 pl-10 pr-4 text-sm focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
          />
        </div>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3.5 py-2 text-sm text-zinc-700"
        >
          <option value="ALL">Tất cả hình thức TT</option>
          <option value="CASH">Tiền mặt</option>
          <option value="TRANSFER">Chuyển khoản</option>
          <option value="CARD">Thẻ POS</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3.5 py-2 text-sm text-zinc-700"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="COMPLETED">Hoàn tất</option>
          <option value="PARTIAL_RETURN">Có đổi / trả</option>
        </select>
      </div>

      {/* Invoices Table */}
      <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Mã hóa đơn</th>
                <th className="px-5 py-3.5">Thời gian</th>
                <th className="px-5 py-3.5">Khách hàng</th>
                <th className="px-5 py-3.5">Thu ngân</th>
                <th className="px-5 py-3.5">Thanh toán</th>
                <th className="px-5 py-3.5 text-right">Tổng cộng</th>
                <th className="px-5 py-3.5 text-center">Trạng thái</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-[#F7F8F6]/70">
                  <td className="px-5 py-3.5 font-mono text-xs font-bold text-[#2D6A4F]">
                    {inv.code}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-600">
                    {formatDateTime(inv.createdAt)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-zinc-900">{inv.customerName}</div>
                    <div className="text-xs text-zinc-400">{inv.customerPhone}</div>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-600">{inv.cashierName}</td>
                  <td className="px-5 py-3.5">
                    <Badge variant="slate">{PAYMENT_LABELS[inv.paymentMethod]}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-zinc-900">
                    {formatCurrency(inv.totalAmount)}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {inv.status === "COMPLETED" ? (
                      <Badge variant="sage">Hoàn tất</Badge>
                    ) : (
                      <Badge variant="amber">Có đổi / trả</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedInvoice(inv)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E6E8E5] px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                      <Eye className="h-3.5 w-3.5" /> Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Detail Drawer */}
      <Drawer
        open={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        title={`Chi tiết hóa đơn ${selectedInvoice?.code ?? ""}`}
        subtitle={selectedInvoice ? formatDateTime(selectedInvoice.createdAt) : ""}
        footer={
          <>
            <Link
              href="/sales/returns"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6E8E5] bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Tạo phiếu đổi / trả
            </Link>
            <button
              type="button"
              onClick={() => selectedInvoice && printInvoice(selectedInvoice)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D6A4F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#23533D]"
            >
              <Printer className="h-3.5 w-3.5" />
              In lại hóa đơn
            </button>
          </>
        }
      >
        {selectedInvoice && (
          <div className="space-y-5 text-sm">
            <div className="text-center text-xs text-zinc-500">
              <div className="text-sm font-bold text-zinc-900">{BRAND_CONFIG.name}</div>
              {BRAND_CONFIG.store.name} – {BRAND_CONFIG.store.address}
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#F7F8F6] p-4 text-xs">
              <div>
                <span className="text-zinc-400">Khách hàng:</span>
                <div className="mt-0.5 font-semibold text-zinc-900">
                  {selectedInvoice.customerName}
                </div>
                <div className="text-zinc-500">{selectedInvoice.customerPhone}</div>
              </div>
              <div>
                <span className="text-zinc-400">Nhân viên thu ngân:</span>
                <div className="mt-0.5 font-semibold text-zinc-900">
                  {selectedInvoice.cashierName}
                </div>
                <div className="text-zinc-500">
                  Hình thức: {PAYMENT_LABELS[selectedInvoice.paymentMethod]}
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Danh mục sách đã mua ({selectedInvoice.items.length})
              </h4>
              <div className="divide-y divide-[#E6E8E5] rounded-xl border border-[#E6E8E5]">
                {selectedInvoice.items.map((item) => (
                  <div key={item.bookId} className="flex items-center justify-between p-3 text-xs">
                    <div>
                      <div className="font-semibold text-zinc-900">{item.title}</div>
                      <div className="text-zinc-500">
                        {item.sku} • {formatCurrency(item.unitPrice)} × {item.quantity}
                      </div>
                    </div>
                    <div className="font-bold text-zinc-900">{formatCurrency(item.subtotal)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Tổng tiền hàng:</span>
                <span className="font-medium">{formatCurrency(selectedInvoice.subtotal)}</span>
              </div>
              {selectedInvoice.promotionName && (
                <div className="flex justify-between text-[#2D6A4F]">
                  <span>Chương trình KM:</span>
                  <span>{selectedInvoice.promotionName}</span>
                </div>
              )}
              {selectedInvoice.voucherCode && (
                <div className="flex justify-between text-[#2D6A4F]">
                  <span>Mã giảm giá:</span>
                  <span className="font-mono font-semibold">{selectedInvoice.voucherCode}</span>
                </div>
              )}
              <div className="flex justify-between text-[#2D6A4F]">
                <span>Tổng giảm giá:</span>
                <span>-{formatCurrency(selectedInvoice.discountAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-[#E6E8E5] pt-2 text-sm font-bold text-zinc-900">
                <span>Thanh toán thực tế:</span>
                <span className="text-[#2D6A4F]">
                  {formatCurrency(selectedInvoice.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Khách đưa / Tiền thừa:</span>
                <span>
                  {formatCurrency(selectedInvoice.amountPaid)} /{" "}
                  {formatCurrency(selectedInvoice.changeAmount)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Bản in của hóa đơn đang xem (chỉ hiện khi in) */}
      <InvoiceReceipt invoice={selectedInvoice} />
    </div>
  );
}
