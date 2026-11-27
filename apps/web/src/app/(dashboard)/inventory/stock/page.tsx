"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, Plus, Search } from "lucide-react";
import { Badge, Modal, PageHeader } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency, formatDateTime, toNumberInput, type NumberInput } from "@/lib/format";
import { ApiError } from "@/lib/http-client";
import { inventoryService } from "@/services";
import type { Book, StockAdjustment } from "@/types";

export default function StockPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<"STOCK" | "ADJUSTMENTS">("STOCK");
  const [books, setBooks] = useState<Book[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [query, setQuery] = useState("");
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Stock Audit / Adjustment Modal
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditNote, setAuditNote] = useState("");
  const [auditBookId, setAuditBookId] = useState("");
  const [actualStock, setActualStock] = useState<NumberInput>(0);
  const [itemReason, setItemReason] = useState("Chênh lệch kiểm kê thực tế trên kệ");
  // Khóa chống áp dụng lặp (giữ khi lỗi, đổi sau khi thành công) + khóa nút khi đang gửi.
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);

  const loadAll = async () => {
    const [bk, adj] = await Promise.all([
      inventoryService.getBooks(),
      inventoryService.getAdjustments(),
    ]);
    setBooks(bk);
    setAdjustments(adj);
    if (bk[0] && !auditBookId) {
      setAuditBookId(bk[0].id);
      setActualStock(bk[0].stock);
    }
  };

  useEffect(() => {
    void Promise.resolve()
      .then(() => loadAll())
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Không tải được dữ liệu.", "error"),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lowStockCount = useMemo(
    () => books.filter((b) => b.stock <= b.minStock).length,
    [books],
  );

  const totalStockValue = useMemo(
    () => books.reduce((sum, b) => sum + b.stock * b.importPrice, 0),
    [books],
  );

  const filteredBooks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      if (onlyLowStock && b.stock > b.minStock) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.sku.toLowerCase().includes(q) ||
        b.shelfLocation.toLowerCase().includes(q)
      );
    });
  }, [books, query, onlyLowStock]);

  const selectedAuditBook = useMemo(
    () => books.find((b) => b.id === auditBookId),
    [books, auditBookId],
  );

  /** Mở form: tải lại tồn mới nhất – đây là "tồn lúc mở form" gửi kèm phiếu để backend đối chiếu. */
  const openAudit = async () => {
    try {
      const fresh = await inventoryService.getBooks();
      setBooks(fresh);
      const current = fresh.find((b) => b.id === auditBookId) ?? fresh[0];
      if (current) {
        setAuditBookId(current.id);
        setActualStock(current.stock);
      }
    } catch {
      // vẫn mở form với dữ liệu đang có; backend sẽ báo nếu tồn đã thay đổi
    }
    setAuditOpen(true);
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAuditBook || submitting) return;
    // Ô trống KHÔNG được coi là 0 (tránh vô tình đưa tồn về 0); số 0 nhập rõ ràng vẫn hợp lệ.
    if (actualStock === "" || !Number.isInteger(actualStock) || actualStock < 0) {
      showToast("Vui lòng nhập số lượng thực tế là số nguyên từ 0 trở lên.", "warning");
      return;
    }

    setSubmitting(true);
    try {
      await inventoryService.createAdjustment({
        createdBy: user?.fullName ?? "Nhân viên kho", // API thật bỏ qua – lấy từ phiên đăng nhập
        note: auditNote || "Kiểm kê và điều chỉnh tồn kho thực tế",
        items: [
          {
            bookId: selectedAuditBook.id,
            sku: selectedAuditBook.sku,
            title: selectedAuditBook.title,
            systemStock: selectedAuditBook.stock, // tồn lúc mở form
            actualStock,
            diff: actualStock - selectedAuditBook.stock, // API thật tự tính
            reason: itemReason,
          },
        ],
        requestKey,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không lập được phiếu kiểm kê.", "error");
      // Tồn đã thay đổi (409): tải lại tồn mới để kiểm kê lại; giữ số thực tế và lý do đã nhập.
      if (err instanceof ApiError && err.status === 409) {
        loadAll().catch(() => undefined);
      }
      return;
    } finally {
      setSubmitting(false);
    }

    setAuditOpen(false);
    setAuditNote("");
    setRequestKey(crypto.randomUUID());
    showToast("Đã lập phiếu kiểm kê và cập nhật tồn kho thành công!");
    // Tải lại tồn kho, cảnh báo tồn thấp và lịch sử kiểm kê.
    loadAll().catch(() => showToast("Đã lập phiếu nhưng chưa tải lại được dữ liệu, hãy tải lại trang.", "warning"));
  };

  return (
    <div>
      <PageHeader
        title="Quản lý tồn kho &amp; Kiểm kê"
        subtitle="Theo dõi định mức tồn kho, nhận cảnh báo sắp hết hàng và lập phiếu điều chỉnh kiểm kê"
        actions={
          <button
            type="button"
            onClick={() => void openAudit()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23533D]"
          >
            <Plus className="h-4 w-4" />
            Lập phiếu điều chỉnh kho
          </button>
        }
      />

      {/* Summary Strip */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#E6E8E5] bg-white p-4">
          <div className="text-xs text-zinc-500">Tổng số cuốn trong kho</div>
          <div className="mt-1 text-2xl font-bold text-zinc-900">
            {books.reduce((s, b) => s + b.stock, 0)} cuốn
          </div>
        </div>
        <div className="rounded-2xl border border-[#E6E8E5] bg-white p-4">
          <div className="text-xs text-zinc-500">Tổng giá trị tồn kho (theo giá vốn)</div>
          <div className="mt-1 text-2xl font-bold text-[#2D6A4F]">
            {formatCurrency(totalStockValue)}
          </div>
        </div>
        <div className="rounded-2xl border border-[#FDE68A] bg-[#FEF3C7]/60 p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#B45309]">
            <AlertTriangle className="h-4 w-4" />
            Đầu sách chạm / dưới định mức tồn
          </div>
          <div className="mt-1 text-2xl font-bold text-[#B45309]">{lowStockCount} đầu sách</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-[#E6E8E5] bg-white p-1 self-start">
          <button
            type="button"
            onClick={() => setTab("STOCK")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold ${
              tab === "STOCK" ? "bg-[#E8F3EE] text-[#2D6A4F]" : "text-zinc-600"
            }`}
          >
            Theo dõi tồn kho ({books.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("ADJUSTMENTS")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold ${
              tab === "ADJUSTMENTS" ? "bg-[#E8F3EE] text-[#2D6A4F]" : "text-zinc-600"
            }`}
          >
            Phiếu kiểm kê &amp; Điều chỉnh ({adjustments.length})
          </button>
        </div>

        {tab === "STOCK" && (
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex items-center gap-2 rounded-xl border border-[#E6E8E5] bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyLowStock}
                onChange={(e) => setOnlyLowStock(e.target.checked)}
                className="accent-[#2D6A4F]"
              />
              Chỉ hiện cảnh báo tồn thấp ({lowStockCount})
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm tên sách, mã SP, kệ..."
                className="rounded-xl border border-[#E6E8E5] bg-white py-2 pl-9 pr-3.5 text-xs focus:border-[#2D6A4F] focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {tab === "STOCK" ? (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Mã SP</th>
                <th className="px-5 py-3.5">Đầu sách</th>
                <th className="px-5 py-3.5">Vị trí kệ</th>
                <th className="px-5 py-3.5 text-center">Định mức tối thiểu</th>
                <th className="px-5 py-3.5 text-center">Tồn thực tế</th>
                <th className="px-5 py-3.5 text-center">Cảnh báo</th>
                <th className="px-5 py-3.5 text-right">Giá trị tồn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {filteredBooks.map((b) => (
                <tr key={b.id} className="hover:bg-[#F7F8F6]/70">
                  <td className="px-5 py-3.5 font-mono text-xs font-bold text-[#2D6A4F]">
                    {b.sku}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-zinc-900">{b.title}</td>
                  <td className="px-5 py-3.5 text-xs text-zinc-500">{b.shelfLocation}</td>
                  <td className="px-5 py-3.5 text-center text-zinc-600">{b.minStock}</td>
                  <td className="px-5 py-3.5 text-center font-bold text-zinc-900">{b.stock}</td>
                  <td className="px-5 py-3.5 text-center">
                    {b.stock === 0 ? (
                      <Badge variant="crimson">Hết hàng - Cần nhập gấp</Badge>
                    ) : b.stock <= b.minStock ? (
                      <Badge variant="amber">Sắp hết hàng</Badge>
                    ) : (
                      <Badge variant="sage">An toàn</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-zinc-800">
                    {formatCurrency(b.stock * b.importPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {adjustments.map((adj) => (
            <div
              key={adj.id}
              className="rounded-2xl border border-[#E6E8E5] bg-white p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <ClipboardCheck className="h-4 w-4 text-[#2D6A4F]" />
                  <span className="font-mono text-sm font-bold text-zinc-900">{adj.code}</span>
                  <Badge variant="sage">Đã cân bằng kho</Badge>
                </div>
                <span className="text-xs text-zinc-500">
                  Người lập: <strong>{adj.createdBy}</strong> • {formatDateTime(adj.createdAt)}
                </span>
              </div>
              <p className="text-xs text-zinc-600">Ghi chú đợt kiểm kê: {adj.note}</p>
              <div className="divide-y divide-[#E6E8E5] rounded-xl border border-[#E6E8E5] bg-[#F7F8F6]">
                {adj.items.map((it) => (
                  <div
                    key={it.bookId}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-zinc-900">{it.title}</span>
                      <span className="ml-2 text-zinc-500">({it.reason})</span>
                    </div>
                    <div className="font-mono">
                      Hệ thống: {it.systemStock} → Thực tế: <strong>{it.actualStock}</strong> (
                      <span className={it.diff >= 0 ? "text-[#2D6A4F]" : "text-[#B91C1C]"}>
                        {it.diff >= 0 ? `+${it.diff}` : it.diff}
                      </span>
                      )
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stock Adjustment Modal */}
      <Modal
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        title="Lập phiếu kiểm kê &amp; Điều chỉnh tồn kho"
      >
        <form onSubmit={handleCreateAdjustment} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-zinc-600">Chọn đầu sách kiểm kê</label>
            <select
              value={auditBookId}
              onChange={(e) => {
                setAuditBookId(e.target.value);
                const found = books.find((x) => x.id === e.target.value);
                if (found) setActualStock(found.stock);
              }}
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
            >
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.sku} — {b.title} (Tồn hệ thống: {b.stock})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-xl bg-[#F7F8F6] p-3.5 text-xs">
            <div>
              <span className="text-zinc-500">Tồn hệ thống</span>
              <div className="mt-1 text-base font-bold text-zinc-900">
                {selectedAuditBook?.stock ?? 0}
              </div>
            </div>
            <div>
              <label className="text-zinc-600 font-semibold">Tồn kiểm đếm thực tế</label>
              <input
                type="number"
                min={0}
                value={actualStock}
                onChange={(e) => setActualStock(toNumberInput(e.target.value))}
                className="mt-1 w-full rounded-lg border border-[#E6E8E5] bg-white px-2.5 py-1 text-sm font-bold"
              />
            </div>
            <div>
              <span className="text-zinc-500">Chênh lệch</span>
              <div className="mt-1 text-base font-bold text-[#2D6A4F]">
                {actualStock === ""
                  ? "—"
                  : actualStock - (selectedAuditBook?.stock ?? 0) >= 0
                    ? `+${actualStock - (selectedAuditBook?.stock ?? 0)}`
                    : actualStock - (selectedAuditBook?.stock ?? 0)}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600">
              Nguyên nhân chênh lệch / điều chỉnh
            </label>
            <input
              type="text"
              required
              value={itemReason}
              onChange={(e) => setItemReason(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600">Ghi chú phiếu kiểm kê</label>
            <input
              type="text"
              value={auditNote}
              onChange={(e) => setAuditNote(e.target.value)}
              placeholder="VD: Kiểm kê định kỳ cuối tháng..."
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAuditOpen(false)}
              className="rounded-xl border border-[#E6E8E5] px-4 py-2 text-zinc-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#2D6A4F] px-4 py-2 font-semibold text-white hover:bg-[#23533D] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Đang áp dụng…" : "Áp dụng điều chỉnh kho"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
