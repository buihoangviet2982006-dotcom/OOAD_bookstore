"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, RotateCcw, Search } from "lucide-react";
import { Badge, Modal, PageHeader } from "@/components/ui";
import { shouldUseMock } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency, formatDate, formatDateTime, todayIsoDate } from "@/lib/format";
import { inventoryService, salesService } from "@/services";
import type { Book, Invoice, ReturnOrder, ReturnPreview, ReturnRequest, ReturnType } from "@/types";

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

  // API thật (cờ "returns"): tiền hoàn / khách bù lấy từ preview backend. Mock: tính tạm trên FE như cũ.
  const realReturns = !shouldUseMock("returns");
  const [submitting, setSubmitting] = useState(false);
  // Khóa chống lập phiếu lặp: sinh khi mở form, giữ nguyên khi lỗi để thử lại an toàn.
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());

  /** Số cuốn còn được đổi/trả của một dòng hóa đơn. */
  const remainingOf = (item: Invoice["items"][number]) => item.quantity - (item.returnedQuantity ?? 0);

  /** Hóa đơn chọn được: API thật – còn hạn đổi/trả và còn sách chưa trả hết. */
  const isReturnable = (inv: Invoice) =>
    !realReturns ||
    ((!inv.returnDeadline || inv.returnDeadline >= todayIsoDate()) && inv.items.some((it) => remainingOf(it) > 0));

  const loadAll = async () => {
    const [ret, inv, bk] = await Promise.all([
      salesService.getReturns(),
      salesService.getInvoices(),
      inventoryService.getBooks(),
    ]);
    setReturns(ret);
    setInvoices(inv);
    setBooks(bk);
    const firstReturnable = inv.find(isReturnable);
    if (firstReturnable && !inv.some((i) => i.id === selectedInvoiceId && isReturnable(i))) {
      setSelectedInvoiceId(firstReturnable.id);
      const firstItem = firstReturnable.items.find((it) => remainingOf(it) > 0) ?? firstReturnable.items[0];
      if (firstItem) setSelectedBookId(firstItem.bookId);
    }
    const firstSellable = bk.find((b) => b.stock > 0 && b.status !== "DISCONTINUED");
    if (firstSellable && !exchangeBookId) setExchangeBookId(firstSellable.id);
  };

  useEffect(() => {
    void Promise.resolve()
      .then(() => loadAll())
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Không tải được dữ liệu.", "error"),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const returnableInvoices = useMemo(() => invoices.filter(isReturnable), [invoices]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ───── Xem trước từ backend (API thật) ─────
  const returnSignature = JSON.stringify({
    invoiceId: chosenInvoice?.id ?? "",
    type: returnType,
    returnItems: chosenInvoiceItem ? [{ bookId: chosenInvoiceItem.bookId, quantity: returnQty, condition }] : [],
    exchangeBookId: returnType === "EXCHANGE" ? exchangeBookId || undefined : undefined,
  } satisfies ReturnRequest);

  const [previewState, setPreviewState] = useState<{
    signature: string;
    data?: ReturnPreview;
    error?: string;
  } | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  const previewSeq = useRef(0);

  useEffect(() => {
    if (!realReturns || !createOpen) return;
    const payload = JSON.parse(returnSignature) as ReturnRequest;
    if (!payload.invoiceId || payload.returnItems.length === 0) return;
    const seq = ++previewSeq.current;
    // Đợi người dùng ngừng thao tác; response của yêu cầu cũ bị bỏ qua.
    const timer = setTimeout(() => {
      salesService
        .previewReturn(payload)
        .then((data) => {
          if (seq === previewSeq.current) setPreviewState({ signature: returnSignature, data });
        })
        .catch((err) => {
          if (seq === previewSeq.current) {
            setPreviewState({
              signature: returnSignature,
              error: err instanceof Error ? err.message : "Không tính được tiền hoàn.",
            });
          }
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [realReturns, createOpen, returnSignature, previewNonce]);

  const preview = previewState?.signature === returnSignature ? previewState.data : undefined;
  const previewError = previewState?.signature === returnSignature ? previewState.error : undefined;

  // Mock: tính tạm như cũ (đơn giá gốc). API thật: số của backend.
  const localReturnVal = (chosenInvoiceItem?.unitPrice ?? 0) * returnQty;
  const localExchangeVal =
    returnType === "EXCHANGE" ? (chosenExchangeBook?.sellPrice ?? 0) * returnQty : 0;
  const returnVal = realReturns ? (preview?.returnedValue ?? 0) : localReturnVal;
  const exchangeVal = realReturns ? (preview?.newBooksValue ?? 0) : localExchangeVal;
  const priceDiff = realReturns
    ? (preview?.extraPayment ?? 0) - (preview?.refundAmount ?? 0)
    : returnType === "EXCHANGE"
      ? localExchangeVal - localReturnVal
      : 0;
  const refundAmount = realReturns
    ? (preview?.refundAmount ?? 0)
    : returnType === "RETURN"
      ? localReturnVal
      : priceDiff < 0
        ? Math.abs(priceDiff)
        : 0;
  const canSubmit = !submitting && !!chosenInvoiceItem && (!realReturns || preview?.valid === true);

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
    if (!chosenInvoice || !chosenInvoiceItem || !canSubmit) return;

    setSubmitting(true);
    try {
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
            unitPrice: chosenInvoiceItem.unitPrice, // API thật bỏ qua – tính từ hóa đơn gốc
            condition,
          },
        ],
        exchangeBookId: returnType === "EXCHANGE" ? chosenExchangeBook?.id : undefined,
        exchangeBookTitle: returnType === "EXCHANGE" ? chosenExchangeBook?.title : undefined,
        exchangeQuantity: returnType === "EXCHANGE" ? returnQty : undefined,
        exchangePriceDiff: priceDiff,
        refundAmount,
        handledBy: user?.fullName ?? "Nhân viên bán hàng",
        requestKey,
        expectedRefundAmount: realReturns ? preview?.refundAmount : undefined,
        expectedExtraPayment: realReturns ? preview?.extraPayment : undefined,
      });
    } catch (err) {
      // Giữ form + requestKey để sửa / thử lại; tính lại preview (số còn được trả có thể vừa đổi).
      showToast(err instanceof Error ? err.message : "Không lập được phiếu đổi/trả.", "error");
      setPreviewState(null);
      setPreviewNonce((n) => n + 1);
      return;
    } finally {
      setSubmitting(false);
    }

    // Thành công: tải lại phiếu, hóa đơn (số đã trả, trạng thái), tồn kho; phiếu sau dùng khóa mới.
    setCreateOpen(false);
    setReason("");
    setRequestKey(crypto.randomUUID());
    showToast("Đã lập phiếu xử lý đổi / trả hàng thành công!");
    loadAll().catch(() => showToast("Đã lập phiếu nhưng chưa tải lại được dữ liệu, hãy tải lại trang.", "warning"));
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
                  const firstItem = inv?.items.find((it) => remainingOf(it) > 0) ?? inv?.items[0];
                  if (firstItem) setSelectedBookId(firstItem.bookId);
                  setReturnQty(1);
                }}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2 text-sm"
              >
                {/* API thật: chỉ hóa đơn còn hạn 7 ngày và còn sách chưa trả hết */}
                {returnableInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.code} — {inv.customerName}
                    {inv.returnDeadline ? ` (hạn đến ${formatDate(inv.returnDeadline)})` : ""}
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
                  <option key={it.bookId} value={it.bookId} disabled={remainingOf(it) <= 0}>
                    {it.title} (Đã mua: {it.quantity}
                    {it.returnedQuantity ? ` • đã trả ${it.returnedQuantity}` : ""} •{" "}
                    {formatCurrency(it.unitPrice)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600">Số lượng trả</label>
              <input
                type="number"
                min={1}
                max={chosenInvoiceItem ? Math.max(1, remainingOf(chosenInvoiceItem)) : 1}
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
                  .filter((b) => b.stock > 0 && b.status !== "DISCONTINUED")
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
              <span className="text-zinc-500">
                Giá trị sách trả lại{realReturns ? " (theo giá thực trả trên hóa đơn gốc)" : ""}:
              </span>
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

          {/* Lý do chưa lập phiếu được (từ backend): quá hạn, trả vượt, sách đổi hết tồn… */}
          {realReturns && (previewError || (preview && preview.messages.length > 0)) && (
            <ul className="space-y-1 rounded-xl border border-[#FECACA] bg-[#FEE2E2] px-3 py-2 text-xs text-[#B91C1C]">
              {previewError && <li>{previewError}</li>}
              {preview?.messages.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}

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
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23533D] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" />
              {submitting ? "Đang lập phiếu…" : "Xác nhận lập phiếu"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
