"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, Eye, Plus, Search, Trash2 } from "lucide-react";
import { Badge, Drawer, Modal, PageHeader } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { daysUntil, formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { adminService, inventoryService } from "@/services";
import type {
  Book,
  PaymentMethod,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  SupplierPayment,
} from "@/types";

export default function ImportsAndDebtPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<"PO" | "DEBT" | "PAYMENTS">("PO");
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState("");

  // PO Detail Drawer
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);

  // Create PO Modal
  const [poOpen, setPoOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>([]);
  const [pickBookId, setPickBookId] = useState("");
  const [pickQty, setPickQty] = useState(20);
  const [pickPrice, setPickPrice] = useState(75000);
  const [poPaidAmount, setPoPaidAmount] = useState(0);
  const [poDueDate, setPoDueDate] = useState("2026-12-15");
  const [poNote, setPoNote] = useState("");

  // Record Supplier Payment Modal
  const [payOpen, setPayOpen] = useState(false);
  const [paySupplierId, setPaySupplierId] = useState("");
  const [payPoId, setPayPoId] = useState("");
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("TRANSFER");
  const [payNote, setPayNote] = useState("");

  const loadAll = async () => {
    const [pos, sups, pays, bks] = await Promise.all([
      inventoryService.getPurchaseOrders(),
      adminService.getSuppliers(),
      inventoryService.getSupplierPayments(),
      inventoryService.getBooks(),
    ]);
    setPurchaseOrders(pos);
    setSuppliers(sups);
    setPayments(pays);
    setBooks(bks);
    if (sups[0] && !poSupplierId) setPoSupplierId(sups[0].id);
    if (bks[0] && !pickBookId) {
      setPickBookId(bks[0].id);
      setPickPrice(bks[0].importPrice);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => loadAll());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSupplierDebt = useMemo(
    () => suppliers.reduce((s, sup) => s + sup.currentDebt, 0),
    [suppliers],
  );

  const dueOrOverdueSuppliers = useMemo(
    () =>
      suppliers.filter((s) => {
        if (s.currentDebt <= 0) return false;
        const d = daysUntil(s.dueDate);
        return d !== null && d <= 7;
      }),
    [suppliers],
  );

  const poTotal = useMemo(
    () => poItems.reduce((sum, it) => sum + it.subtotal, 0),
    [poItems],
  );

  const addLineToPo = () => {
    const book = books.find((b) => b.id === pickBookId);
    if (!book || pickQty <= 0) return;
    setPoItems((prev) => {
      const existing = prev.find((i) => i.bookId === book.id);
      if (existing) {
        return prev.map((i) =>
          i.bookId === book.id
            ? {
                ...i,
                quantity: i.quantity + pickQty,
                importPrice: pickPrice,
                subtotal: (i.quantity + pickQty) * pickPrice,
              }
            : i,
        );
      }
      return [
        ...prev,
        {
          bookId: book.id,
          sku: book.sku,
          title: book.title,
          quantity: pickQty,
          importPrice: pickPrice,
          subtotal: pickQty * pickPrice,
        },
      ];
    });
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poItems.length === 0) {
      showToast("Vui lòng thêm ít nhất 1 đầu sách vào phiếu nhập.", "warning");
      return;
    }
    const sup = suppliers.find((s) => s.id === poSupplierId);
    if (!sup) return;

    await inventoryService.createPurchaseOrder({
      supplierId: sup.id,
      supplierName: sup.name,
      createdBy: user?.fullName ?? "Nhân viên kho",
      items: poItems,
      totalAmount: poTotal,
      paidAmount: Math.min(poTotal, Math.max(0, poPaidAmount)),
      dueDate: poTotal > poPaidAmount ? poDueDate : null,
      note: poNote,
    });

    await loadAll();
    setPoOpen(false);
    setPoItems([]);
    setPoPaidAmount(0);
    setPoNote("");
    showToast("Đã lập phiếu nhập kho và cập nhật số lượng sách!");
  };

  const openPaymentModal = (sup: Supplier, po?: PurchaseOrder) => {
    setPaySupplierId(sup.id);
    setPayPoId(po?.id ?? "");
    setPayAmount(po ? po.debtAmount : sup.currentDebt);
    setPayNote(po ? `Thanh toán công nợ phiếu ${po.code}` : `Thanh toán công nợ ${sup.name}`);
    setPayOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === paySupplierId);
    if (!sup || payAmount <= 0) return;
    const po = purchaseOrders.find((p) => p.id === payPoId);

    await inventoryService.recordSupplierPayment({
      supplierId: sup.id,
      supplierName: sup.name,
      purchaseOrderId: po?.id,
      purchaseOrderCode: po?.code,
      amount: payAmount,
      paymentMethod: payMethod,
      recordedBy: user?.fullName ?? "Quản lý",
      note: payNote,
    });

    await loadAll();
    setPayOpen(false);
    showToast(`Đã ghi nhận thanh toán ${formatCurrency(payAmount)} cho ${sup.name}!`);
  };

  const filteredPos = useMemo(() => {
    const q = query.trim().toLowerCase();
    return purchaseOrders.filter(
      (p) =>
        !q ||
        p.code.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q),
    );
  }, [purchaseOrders, query]);

  return (
    <div>
      <PageHeader
        title="Quản lý Nhập hàng &amp; Công nợ Nhà cung cấp"
        subtitle="Lập phiếu nhập sách mới, đối chiếu chi tiết lô nhập, cảnh báo nợ đến hạn và ghi nhận thanh toán NCC"
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                const debtSup = suppliers.find((s) => s.currentDebt > 0) ?? suppliers[0];
                if (debtSup) openPaymentModal(debtSup);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E6E8E5] bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Banknote className="h-4 w-4 text-[#2D6A4F]" />
              Ghi nhận trả nợ NCC
            </button>
            <button
              type="button"
              onClick={() => setPoOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23533D]"
            >
              <Plus className="h-4 w-4" />
              Lập phiếu nhập hàng
            </button>
          </>
        }
      />

      {/* Debt Due / Overdue Alert Banner */}
      {dueOrOverdueSuppliers.length > 0 && (
        <div className="mb-5 flex flex-col gap-2 rounded-2xl border border-[#FDE68A] bg-[#FEF3C7]/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#B45309]" />
            <div className="text-xs text-[#92400E]">
              <strong className="font-semibold">
                Cảnh báo công nợ đến hạn ({dueOrOverdueSuppliers.length} Nhà cung cấp):
              </strong>{" "}
              Tổng dư nợ toàn hệ thống đang là <strong>{formatCurrency(totalSupplierDebt)}</strong>. Có khoản nợ đã quá hạn hoặc đến hạn trong vòng 7 ngày tới.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTab("DEBT")}
            className="shrink-0 rounded-xl bg-white px-3.5 py-1.5 text-xs font-semibold text-[#B45309] border border-[#FDE68A]"
          >
            Xem &amp; Thanh toán ngay
          </button>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-[#E6E8E5] bg-white p-1 self-start">
          <button
            type="button"
            onClick={() => setTab("PO")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold ${
              tab === "PO" ? "bg-[#E8F3EE] text-[#2D6A4F]" : "text-zinc-600"
            }`}
          >
            Phiếu nhập hàng ({purchaseOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("DEBT")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold ${
              tab === "DEBT" ? "bg-[#E8F3EE] text-[#2D6A4F]" : "text-zinc-600"
            }`}
          >
            Công nợ Nhà cung cấp
          </button>
          <button
            type="button"
            onClick={() => setTab("PAYMENTS")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold ${
              tab === "PAYMENTS" ? "bg-[#E8F3EE] text-[#2D6A4F]" : "text-zinc-600"
            }`}
          >
            Lịch sử thanh toán NCC ({payments.length})
          </button>
        </div>

        {tab === "PO" && (
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm mã phiếu nhập, tên NCC..."
              className="w-full rounded-xl border border-[#E6E8E5] bg-white py-2 pl-10 pr-4 text-xs focus:border-[#2D6A4F] focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Purchase Orders */}
      {tab === "PO" && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
                <tr>
                  <th className="px-5 py-3.5">Mã phiếu nhập</th>
                  <th className="px-5 py-3.5">Nhà cung cấp</th>
                  <th className="px-5 py-3.5">Ngày nhập</th>
                  <th className="px-5 py-3.5 text-right">Tổng tiền nhập</th>
                  <th className="px-5 py-3.5 text-right">Còn nợ</th>
                  <th className="px-5 py-3.5 text-center">Trạng thái nợ</th>
                  <th className="px-5 py-3.5 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8E5]">
                {filteredPos.map((po) => (
                  <tr key={po.id} className="hover:bg-[#F7F8F6]/70">
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-[#2D6A4F]">
                      {po.code}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-zinc-900">{po.supplierName}</td>
                    <td className="px-5 py-3.5 text-xs text-zinc-500">
                      {formatDateTime(po.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold">
                      {formatCurrency(po.totalAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-[#B91C1C]">
                      {formatCurrency(po.debtAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {po.debtAmount === 0 ? (
                        <Badge variant="sage">Đã tất toán</Badge>
                      ) : po.debtStatus === "OVERDUE" ? (
                        <Badge variant="crimson">Quá hạn ({formatDate(po.dueDate)})</Badge>
                      ) : (
                        <Badge variant="amber">Còn nợ (Hạn {formatDate(po.dueDate)})</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedPo(po)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E6E8E5] px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                      >
                        <Eye className="h-3.5 w-3.5" /> Xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Supplier Debt Management */}
      {tab === "DEBT" && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Mã NCC</th>
                <th className="px-5 py-3.5">Nhà cung cấp</th>
                <th className="px-5 py-3.5 text-right">Tổng kim ngạch nhập</th>
                <th className="px-5 py-3.5 text-right">Dư nợ hiện tại</th>
                <th className="px-5 py-3.5 text-center">Hạn thanh toán</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {suppliers.map((sup) => {
                const d = daysUntil(sup.dueDate);
                const isOverdue = sup.currentDebt > 0 && d !== null && d < 0;
                return (
                  <tr key={sup.id} className="hover:bg-[#F7F8F6]/70">
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-zinc-600">
                      {sup.code}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-zinc-900">{sup.name}</div>
                      <div className="text-xs text-zinc-500">
                        Liên hệ: {sup.contactPerson} • {sup.phone}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right text-zinc-700">
                      {formatCurrency(sup.totalImportAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-[#B91C1C]">
                      {formatCurrency(sup.currentDebt)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {sup.currentDebt === 0 ? (
                        <Badge variant="sage">Không nợ</Badge>
                      ) : isOverdue ? (
                        <Badge variant="crimson">
                          Quá hạn {Math.abs(d)} ngày ({formatDate(sup.dueDate)})
                        </Badge>
                      ) : (
                        <Badge variant="amber">Hạn: {formatDate(sup.dueDate)}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {sup.currentDebt > 0 && (
                        <button
                          type="button"
                          onClick={() => openPaymentModal(sup)}
                          className="rounded-xl bg-[#2D6A4F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#23533D]"
                        >
                          Thanh toán nợ
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Payment History */}
      {tab === "PAYMENTS" && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Mã phiếu chi</th>
                <th className="px-5 py-3.5">Nhà cung cấp</th>
                <th className="px-5 py-3.5">Phiếu nhập đối ứng</th>
                <th className="px-5 py-3.5">Ngày chi</th>
                <th className="px-5 py-3.5 text-right">Số tiền đã trả</th>
                <th className="px-5 py-3.5">Người lập</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {payments.map((pay) => (
                <tr key={pay.id} className="hover:bg-[#F7F8F6]/70">
                  <td className="px-5 py-3.5 font-mono text-xs font-bold text-[#2D6A4F]">
                    {pay.code}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-zinc-900">{pay.supplierName}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-zinc-500">
                    {pay.purchaseOrderCode ?? "Thanh toán gộp"}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-500">
                    {formatDateTime(pay.paidAt)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-[#2D6A4F]">
                    {formatCurrency(pay.amount)}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-600">{pay.recordedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Purchase Order Detail Drawer */}
      <Drawer
        open={Boolean(selectedPo)}
        onClose={() => setSelectedPo(null)}
        title={`Chi tiết phiếu nhập ${selectedPo?.code ?? ""}`}
        subtitle={selectedPo?.supplierName}
      >
        {selectedPo && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl bg-[#F7F8F6] p-4 space-y-1">
              <div>Người lập phiếu: <strong>{selectedPo.createdBy}</strong></div>
              <div>Thời gian nhập: {formatDateTime(selectedPo.createdAt)}</div>
              {selectedPo.note && <div>Ghi chú: {selectedPo.note}</div>}
            </div>

            <div className="divide-y divide-[#E6E8E5] rounded-xl border border-[#E6E8E5]">
              {selectedPo.items.map((it) => (
                <div key={it.bookId} className="flex justify-between p-3">
                  <div>
                    <div className="font-semibold text-zinc-900">{it.title}</div>
                    <div className="text-zinc-500">
                      {it.sku} • Giá nhập {formatCurrency(it.importPrice)} × {it.quantity} cuốn
                    </div>
                  </div>
                  <div className="font-bold text-zinc-900">{formatCurrency(it.subtotal)}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-[#F7F8F6] p-4 space-y-1.5">
              <div className="flex justify-between">
                <span>Tổng giá trị lô nhập:</span>
                <span className="font-bold">{formatCurrency(selectedPo.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-[#2D6A4F]">
                <span>Đã thanh toán cho NCC:</span>
                <span>{formatCurrency(selectedPo.paidAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-[#E6E8E5] pt-2 text-sm font-bold text-[#B91C1C]">
                <span>Công nợ còn lại:</span>
                <span>{formatCurrency(selectedPo.debtAmount)}</span>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Create Purchase Order Modal */}
      <Modal
        open={poOpen}
        onClose={() => setPoOpen(false)}
        title="Lập phiếu nhập hàng từ Nhà cung cấp"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreatePo} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-zinc-600">Nhà cung cấp *</label>
            <select
              value={poSupplierId}
              onChange={(e) => setPoSupplierId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Line Picker */}
          <div className="rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] p-3.5 space-y-3">
            <div className="text-xs font-semibold text-zinc-700">Thêm đầu sách nhập kho</div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
              <select
                value={pickBookId}
                onChange={(e) => {
                  setPickBookId(e.target.value);
                  const b = books.find((x) => x.id === e.target.value);
                  if (b) setPickPrice(b.importPrice);
                }}
                className="sm:col-span-6 rounded-xl border border-[#E6E8E5] bg-white px-3 py-2 text-xs"
              >
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.sku} - {b.title}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={pickQty}
                onChange={(e) => setPickQty(Number(e.target.value))}
                placeholder="SL"
                className="sm:col-span-2 rounded-xl border border-[#E6E8E5] bg-white px-2.5 py-2 text-xs"
              />
              <input
                type="number"
                min={0}
                value={pickPrice}
                onChange={(e) => setPickPrice(Number(e.target.value))}
                placeholder="Giá nhập"
                className="sm:col-span-2 rounded-xl border border-[#E6E8E5] bg-white px-2.5 py-2 text-xs"
              />
              <button
                type="button"
                onClick={addLineToPo}
                className="sm:col-span-2 rounded-xl bg-[#2D6A4F] px-3 py-2 text-xs font-semibold text-white"
              >
                + Thêm dòng
              </button>
            </div>

            {poItems.length > 0 && (
              <div className="divide-y divide-[#E6E8E5] rounded-xl border border-[#E6E8E5] bg-white">
                {poItems.map((it) => (
                  <div key={it.bookId} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span>
                      <strong>{it.title}</strong> × {it.quantity} ({formatCurrency(it.importPrice)})
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{formatCurrency(it.subtotal)}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setPoItems((prev) => prev.filter((x) => x.bookId !== it.bookId))
                        }
                        className="text-zinc-400 hover:text-[#B91C1C]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Tổng tiền phiếu nhập</label>
              <div className="mt-1 rounded-xl border border-[#E6E8E5] bg-zinc-50 px-3 py-2 font-bold text-[#2D6A4F]">
                {formatCurrency(poTotal)}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Thanh toán ngay (VNĐ)</label>
              <input
                type="number"
                min={0}
                max={poTotal}
                value={poPaidAmount}
                onChange={(e) => setPoPaidAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Hạn trả công nợ</label>
              <input
                type="date"
                value={poDueDate}
                onChange={(e) => setPoDueDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPoOpen(false)}
              className="rounded-xl border border-[#E6E8E5] px-4 py-2 text-zinc-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#2D6A4F] px-4 py-2 font-semibold text-white hover:bg-[#23533D]"
            >
              Lưu phiếu nhập kho
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Supplier Payment Modal */}
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Ghi nhận thanh toán Công nợ Nhà cung cấp"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-zinc-600">Nhà cung cấp</label>
            <select
              value={paySupplierId}
              onChange={(e) => {
                setPaySupplierId(e.target.value);
                const s = suppliers.find((x) => x.id === e.target.value);
                if (s) setPayAmount(s.currentDebt);
              }}
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (Nợ hiện tại: {formatCurrency(s.currentDebt)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Số tiền thanh toán *</label>
              <input
                type="number"
                required
                min={1000}
                value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Hình thức chi trả</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              >
                <option value="TRANSFER">Chuyển khoản ngân hàng</option>
                <option value="CASH">Tiền mặt tại quỹ</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600">Nội dung chứng từ chi</label>
            <input
              type="text"
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPayOpen(false)}
              className="rounded-xl border border-[#E6E8E5] px-4 py-2 text-zinc-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#2D6A4F] px-4 py-2 font-semibold text-white hover:bg-[#23533D]"
            >
              Xác nhận thanh toán
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
