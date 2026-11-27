"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, RotateCcw, Search } from "lucide-react";
import { Badge, Modal, PageHeader } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { inventoryService, salesService } from "@/services";
import type { Book, Invoice, ReturnOrder, ReturnType } from "@/types";

export default function ReturnsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [returns, setReturns] = useState<ReturnOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Create Return/Exchange Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedBookId, setSelectedBookId] = useState("");
  const [returnQty, setReturnQty] = useState(1);
  const [returnType, setReturnType] = useState<ReturnType>("EXCHANGE");
  const [condition, setCondition] = useState("Lỗi in ấn / thiếu trang từ NXB");
  const [reason, setReason] = useState("");
  const [exchangeBookId, setExchangeBookId] = useState("");

  const loadAll = async () => {
    const [ret, inv, bk] = await Promise.all([
      salesService.getReturns(),
      salesService.getInvoices(),
      inventoryService.getBooks(),
    ]);
    setReturns(ret);
    setInvoices(inv);
    setBooks(bk);
    if (inv[0] && !selectedInvoiceId) {
      setSelectedInvoiceId(inv[0].id);
      if (inv[0].items[0]) setSelectedBookId(inv[0].items[0].bookId);
    }
    if (bk[0] && !exchangeBookId) setExchangeBookId(bk[0].id);
  };

  useEffect(() => {
    void Promise.resolve().then(() => loadAll());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chosenInvoice = useMemo(
    () => invoices.find((i) => i.id === selectedInvoiceId),
    [invoices, selectedInvoiceId],
  );

  const chosenInvoiceItem = useMemo(
    () => chosenInvoice?.items.find((it) => it.bookId === selectedBookId) ?? chosenInvoice?.items[0],
    [chosenInvoice, selectedBookId],
  );

  const chosenExchangeBook = useMemo(
    () => books.find((b) => b.id === exchangeBookId),
    [books, exchangeBookId],
  );

  const returnVal = (chosenInvoiceItem?.unitPrice ?? 0) * returnQty;
  const exchangeVal = returnType === "EXCHANGE" ? (chosenExchangeBook?.sellPrice ?? 0) * returnQty : 0;
  const priceDiff = returnType === "EXCHANGE" ? exchangeVal - returnVal : 0;
  const refundAmount = returnType === "RETURN" ? returnVal : priceDiff < 0 ? Math.abs(priceDiff) : 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return returns.filter((r) => {
      if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
      if (!q) return true;
      return (
        r.code.toLowerCase().includes(q) ||
        r.invoiceCode.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q)
      );
    });
  }, [returns, query, typeFilter]);

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chosenInvoice || !chosenInvoiceItem) return;

    await salesService.createReturn({
      invoiceId: chosenInvoice.id,
      invoiceCode: chosenInvoice.code,
      customerId: chosenInvoice.customerId,
      customerName: chosenInvoice.customerName,
      type: returnType,
      reason: reason.trim() || condition,
      returnItems: [
        {
          bookId: chosenInvoiceItem.bookId,
          sku: chosenInvoiceItem.sku,
          title: chosenInvoiceItem.title,
          quantity: returnQty,
          unitPrice: chosenInvoiceItem.unitPrice,
          condition,
        },
      ],
      exchangeBookId: returnType === "EXCHANGE" ? chosenExchangeBook?.id : undefined,
      exchangeBookTitle: returnType === "EXCHANGE" ? chosenExchangeBook?.title : undefined,
      exchangeQuantity: returnType === "EXCHANGE" ? returnQty : undefined,
      exchangePriceDiff: priceDiff,
      refundAmount,
      handledBy: user?.fullName ?? "Nhân viên bán hàng",
    });

    await loadAll();
    setCreateOpen(false);
    setReason("");
    showToast("Đã lập phiếu xử lý đổi / trả hàng thành công!");
  };

  return (
    <div>
      <PageHeader
        title="Quản lý Đổi hàng / Trả hàng"
        subtitle="Tiếp nhận xử lý sách lỗi in ấn, đổi đầu sách khác và tự động cân đối tồn kho - tiền hoàn"
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23533D]"
          >
            <Plus className="h-4 w-4" />
            Lập phiếu đổi / trả
          </button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#E6E8E5] bg-white p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo mã phiếu ĐT, mã hóa đơn gốc hoặc tên khách hàng..."
            className="w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] py-2 pl-10 pr-4 text-sm focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3.5 py-2 text-sm text-zinc-700"
        >
          <option value="ALL">Tất cả nghiệp vụ</option>
          <option value="EXCHANGE">Đổi sách</option>
          <option value="RETURN">Trả hàng hoàn tiền</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Mã phiếu</th>
                <th className="px-5 py-3.5">HĐ Gốc</th>
                <th className="px-5 py-3.5">Khách hàng</th>
                <th className="px-5 py-3.5">Loại</th>
                <th className="px-5 py-3.5">Sách trả &amp; Lý do</th>
                <th className="px-5 py-3.5 text-right">Hoàn / Chênh lệch</th>
                <th className="px-5 py-3.5">Người xử lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-[#F7F8F6]/60">
                  <td className="px-5 py-3.5 font-mono text-xs font-bold text-[#2D6A4F]">
                    {r.code}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-zinc-600">{r.invoiceCode}</td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-zinc-900">{r.customerName}</div>
                    <div className="text-xs text-zinc-400">{formatDateTime(r.createdAt)}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    {r.type === "EXCHANGE" ? (
                      <Badge variant="blue">Đổi hàng</Badge>
                    ) : (
                      <Badge variant="amber">Trả hoàn tiền</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs">
                    <div className="font-medium text-zinc-800">
                      {r.returnItems.map((i) => `${i.title} (×${i.quantity})`).join(", ")}
                    </div>
                    <div className="text-zinc-500">Lý do: {r.reason}</div>
                    {r.exchangeBookTitle && (
                      <div className="mt-0.5 text-[#2D6A4F]">
                        → Đổi sang: {r.exchangeBookTitle} (×{r.exchangeQuantity})
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right text-xs font-semibold">
                    {r.type === "RETURN" ? (
                      <span className="text-[#B91C1C]">Hoàn {formatCurrency(r.refundAmount)}</span>
                    ) : r.exchangePriceDiff > 0 ? (
                      <span className="text-[#2D6A4F]">
                        Khách bù +{formatCurrency(r.exchangePriceDiff)}
                      </span>
                    ) : r.exchangePriceDiff < 0 ? (
                      <span className="text-[#B91C1C]">
                        Hoàn khách {formatCurrency(Math.abs(r.exchangePriceDiff))}
                      </span>
                    ) : (
                      <span className="text-zinc-600">Ngang giá (0 ₫)</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-600">{r.handledBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Return / Exchange Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Lập phiếu Đổi / Trả sách"
        subtitle="Tra cứu từ hóa đơn gốc để đảm bảo chính xác đơn giá đã mua"
      >
        <form onSubmit={handleCreateReturn} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Chọn hóa đơn gốc</label>
              <select
                value={selectedInvoiceId}
                onChange={(e) => {
                  setSelectedInvoiceId(e.target.value);
                  const inv = invoices.find((x) => x.id === e.target.value);
                  if (inv?.items[0]) setSelectedBookId(inv.items[0].bookId);
                  setReturnQty(1);
                }}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2 text-sm"
              >
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.code} — {inv.customerName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600">Hình thức xử lý</label>
              <select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value as ReturnType)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2 text-sm"
              >
                <option value="EXCHANGE">Đổi sang cuốn sách khác</option>
                <option value="RETURN">Trả sách &amp; Hoàn tiền</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-600">
                Sách cần trả trong hóa đơn
              </label>
              <select
                value={chosenInvoiceItem?.bookId ?? ""}
                onChange={(e) => setSelectedBookId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2 text-sm"
              >
                {chosenInvoice?.items.map((it) => (
                  <option key={it.bookId} value={it.bookId}>
                    {it.title} (Đã mua: {it.quantity} • {formatCurrency(it.unitPrice)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600">Số lượng trả</label>
              <input
                type="number"
                min={1}
                max={chosenInvoiceItem?.quantity ?? 1}
                value={returnQty}
                onChange={(e) => setReturnQty(Math.max(1, Number(e.target.value)))}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2 text-sm"
              />
            </div>
          </div>

          {returnType === "EXCHANGE" && (
            <div>
              <label className="block text-xs font-semibold text-zinc-600">
                Sách mới muốn đổi sang
              </label>
              <select
                value={exchangeBookId}
                onChange={(e) => setExchangeBookId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2 text-sm"
              >
                {books
                  .filter((b) => b.stock > 0)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} — Giá: {formatCurrency(b.sellPrice)} (Tồn: {b.stock})
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Tình trạng sách trả</label>
              <input
                type="text"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Ghi chú / Lý do chi tiết</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Khách đổi sang ấn bản khác..."
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-xl bg-[#F7F8F6] p-4 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-zinc-500">Giá trị sách trả lại:</span>
              <span className="font-semibold">{formatCurrency(returnVal)}</span>
            </div>
            {returnType === "EXCHANGE" && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Giá trị sách đổi mới:</span>
                <span className="font-semibold">{formatCurrency(exchangeVal)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[#E6E8E5] pt-2 text-sm font-bold">
              <span>Kết quả thanh toán:</span>
              <span className="text-[#2D6A4F]">
                {returnType === "RETURN"
                  ? `Hoàn lại khách ${formatCurrency(refundAmount)}`
                  : priceDiff > 0
                    ? `Khách thanh toán thêm ${formatCurrency(priceDiff)}`
                    : priceDiff < 0
                      ? `Hoàn lại khách ${formatCurrency(Math.abs(priceDiff))}`
                      : "Đổi ngang giá (0 ₫)"}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-xl border border-[#E6E8E5] px-4 py-2 text-sm text-zinc-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23533D]"
            >
              <RotateCcw className="h-4 w-4" />
              Xác nhận lập phiếu
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
