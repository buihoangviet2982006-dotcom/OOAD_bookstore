"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Edit2, Eye, Plus, Search, Trash2 } from "lucide-react";
import { Badge, Drawer, Modal, PageHeader } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { salesService } from "@/services";
import type { Customer, CustomerTier, Invoice, ReturnOrder } from "@/types";

const TIER_MAP: Record<CustomerTier, { label: string; variant: "slate" | "blue" | "amber" | "sage" }> = {
  STANDARD: { label: "Thành viên", variant: "slate" },
  SILVER: { label: "Hạng Bạc", variant: "blue" },
  GOLD: { label: "Hạng Vàng", variant: "amber" },
  DIAMOND: { label: "Kim Cương", variant: "sage" },
};

export default function CustomersPage() {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [returns, setReturns] = useState<ReturnOrder[]>([]);

  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("ALL");

  // Edit / Create Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [tier, setTier] = useState<CustomerTier>("STANDARD");
  const [notes, setNotes] = useState("");

  // Detail Drawer
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [detailTab, setDetailTab] = useState<"ORDERS" | "RETURNS">("ORDERS");

  const loadAll = async () => {
    const [cus, inv, ret] = await Promise.all([
      salesService.getCustomers(),
      salesService.getInvoices(),
      salesService.getReturns(),
    ]);
    setCustomers(cus);
    setInvoices(inv);
    setReturns(ret);
  };

  useEffect(() => {
    void Promise.resolve()
      .then(() => loadAll())
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Không tải được dữ liệu.", "error"),
      );
    // Lỗi tải (mất kết nối, hết phiên…) hiện thành thông báo thay vì bảng trống im lặng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      if (tierFilter !== "ALL" && c.tier !== tierFilter) return false;
      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    });
  }, [customers, query, tierFilter]);

  const openCreate = () => {
    setEditing(null);
    setFullName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setTier("STANDARD");
    setNotes("");
    setFormOpen(true);
  };

  const openEdit = (cus: Customer) => {
    setEditing(cus);
    setFullName(cus.fullName);
    setPhone(cus.phone);
    setEmail(cus.email);
    setAddress(cus.address);
    setTier(cus.tier);
    setNotes(cus.notes ?? "");
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await salesService.saveCustomer({
        id: editing?.id,
        fullName,
        phone,
        email,
        address,
        tier, // API thật bỏ qua – hạng do backend tính từ chi tiêu
        notes,
      });
      await loadAll();
      setFormOpen(false);
      showToast(editing ? "Đã cập nhật hồ sơ khách hàng" : "Đã thêm khách hàng mới");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không lưu được khách hàng.", "error");
    }
  };

  const handleDelete = async (cus: Customer) => {
    if (!window.confirm(`Xác nhận xóa khách hàng "${cus.fullName}"?`)) return;
    try {
      await salesService.deleteCustomer(cus.id);
      await loadAll();
      showToast("Đã xóa thông tin khách hàng", "info");
    } catch (err) {
      // Khách đã có hóa đơn: backend chặn xóa để giữ lịch sử.
      showToast(err instanceof Error ? err.message : "Không xóa được khách hàng.", "error");
    }
  };

  const customerInvoices = useMemo(
    () =>
      detailCustomer ? invoices.filter((i) => i.customerId === detailCustomer.id) : [],
    [detailCustomer, invoices],
  );

  const customerReturns = useMemo(
    () =>
      detailCustomer ? returns.filter((r) => r.customerId === detailCustomer.id) : [],
    [detailCustomer, returns],
  );

  return (
    <div>
      <PageHeader
        title="Quản lý khách hàng"
        subtitle="Theo dõi thông tin thành viên, lịch sử mua sách, yêu cầu đổi trả, tổng chi tiêu và tần suất mua"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23533D]"
          >
            <Plus className="h-4 w-4" />
            Thêm khách hàng
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
            placeholder="Tìm theo tên khách hàng, mã KH, số điện thoại hoặc email..."
            className="w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] py-2 pl-10 pr-4 text-sm focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3.5 py-2 text-sm text-zinc-700"
        >
          <option value="ALL">Tất cả hạng thẻ</option>
          <option value="DIAMOND">Kim Cương</option>
          <option value="GOLD">Hạng Vàng</option>
          <option value="SILVER">Hạng Bạc</option>
          <option value="STANDARD">Thành viên</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Mã KH</th>
                <th className="px-5 py-3.5">Họ và tên</th>
                <th className="px-5 py-3.5">Hạng thẻ</th>
                <th className="px-5 py-3.5 text-center">Tần suất mua</th>
                <th className="px-5 py-3.5 text-right">Tổng chi tiêu</th>
                <th className="px-5 py-3.5">Mua gần nhất</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {filtered.map((cus) => {
                const tInfo = TIER_MAP[cus.tier];
                return (
                  <tr key={cus.id} className="hover:bg-[#F7F8F6]/70">
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-zinc-600">
                      {cus.code}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-zinc-900">{cus.fullName}</div>
                      <div className="text-xs text-zinc-500">
                        {cus.phone} {cus.email ? `• ${cus.email}` : ""}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={tInfo.variant}>{tInfo.label}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-center font-medium text-zinc-800">
                      {cus.orderCount} đơn
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-[#2D6A4F]">
                      {formatCurrency(cus.totalSpent)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-zinc-500">
                      {formatDate(cus.lastPurchaseDate)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setDetailCustomer(cus);
                            setDetailTab("ORDERS");
                          }}
                          className="rounded-lg border border-[#E6E8E5] p-1.5 text-zinc-600 hover:bg-zinc-100"
                          title="Xem lịch sử & chi tiết"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(cus)}
                          className="rounded-lg border border-[#E6E8E5] p-1.5 text-zinc-600 hover:bg-zinc-100"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cus)}
                          className="rounded-lg border border-[#E6E8E5] p-1.5 text-zinc-500 hover:bg-[#FEE2E2] hover:text-[#B91C1C]"
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Cập nhật khách hàng ${editing.code}` : "Thêm khách hàng mới"}
      >
        <form onSubmit={handleSave} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Họ và tên *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Số điện thoại *</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Hạng thành viên</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as CustomerTier)}
                disabled
                title="Hạng thành viên do hệ thống tính từ tổng chi tiêu"
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              >
                <option value="STANDARD">Thành viên</option>
                <option value="SILVER">Hạng Bạc</option>
                <option value="GOLD">Hạng Vàng</option>
                <option value="DIAMOND">Kim Cương</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600">Địa chỉ</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600">Ghi chú sở thích đọc</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-xl border border-[#E6E8E5] px-4 py-2 text-zinc-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#2D6A4F] px-4 py-2 font-semibold text-white hover:bg-[#23533D]"
            >
              Lưu thông tin
            </button>
          </div>
        </form>
      </Modal>

      {/* Customer Detail & Purchase / Return History Drawer */}
      <Drawer
        open={Boolean(detailCustomer)}
        onClose={() => setDetailCustomer(null)}
        title={detailCustomer?.fullName ?? ""}
        subtitle={`${detailCustomer?.code ?? ""} • ${detailCustomer?.phone ?? ""}`}
        width="max-w-2xl"
      >
        {detailCustomer && (
          <div className="space-y-5">
            {/* Spending & Frequency Highlights */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] p-3.5">
                <div className="text-xs text-zinc-500">Tổng chi tiêu</div>
                <div className="mt-1 text-lg font-bold text-[#2D6A4F]">
                  {formatCurrency(detailCustomer.totalSpent)}
                </div>
              </div>
              <div className="rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] p-3.5">
                <div className="text-xs text-zinc-500">Tần suất mua</div>
                <div className="mt-1 text-lg font-bold text-zinc-900">
                  {detailCustomer.orderCount} đơn hàng
                </div>
              </div>
              <div className="rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] p-3.5">
                <div className="text-xs text-zinc-500">Giá trị TB / đơn</div>
                <div className="mt-1 text-lg font-bold text-zinc-900">
                  {formatCurrency(
                    detailCustomer.orderCount > 0
                      ? detailCustomer.totalSpent / detailCustomer.orderCount
                      : 0,
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#E6E8E5] p-4 text-xs space-y-1 text-zinc-600">
              <div>Địa chỉ: {detailCustomer.address || "Chưa cập nhật"}</div>
              <div>Điểm tích lũy: <strong>{detailCustomer.points} điểm</strong></div>
              {detailCustomer.notes && <div>Ghi chú: {detailCustomer.notes}</div>}
            </div>

            {/* History Tabs */}
            <div className="flex gap-2 border-b border-[#E6E8E5]">
              <button
                type="button"
                onClick={() => setDetailTab("ORDERS")}
                className={`border-b-2 pb-2.5 text-xs font-semibold ${
                  detailTab === "ORDERS"
                    ? "border-[#2D6A4F] text-[#2D6A4F]"
                    : "border-transparent text-zinc-500"
                }`}
              >
                Lịch sử mua hàng ({customerInvoices.length})
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("RETURNS")}
                className={`border-b-2 pb-2.5 text-xs font-semibold ${
                  detailTab === "RETURNS"
                    ? "border-[#2D6A4F] text-[#2D6A4F]"
                    : "border-transparent text-zinc-500"
                }`}
              >
                Yêu cầu đổi / trả ({customerReturns.length})
              </button>
            </div>

            {detailTab === "ORDERS" ? (
              customerInvoices.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-400">
                  Khách hàng chưa có hóa đơn giao dịch nào.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {customerInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="rounded-xl border border-[#E6E8E5] p-3.5 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#2D6A4F]">{inv.code}</span>
                        <span className="text-zinc-400">{formatDateTime(inv.createdAt)}</span>
                      </div>
                      <div className="text-zinc-600">
                        {inv.items.map((it) => `${it.title} (×${it.quantity})`).join(", ")}
                      </div>
                      <div className="flex justify-between pt-1 font-semibold text-zinc-900">
                        <span>Thu ngân: {inv.cashierName}</span>
                        <span>{formatCurrency(inv.totalAmount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : customerReturns.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-400">
                Không phát sinh yêu cầu đổi / trả hàng nào.
              </p>
            ) : (
              <div className="space-y-2.5">
                {customerReturns.map((ret) => (
                  <div
                    key={ret.id}
                    className="rounded-xl border border-[#E6E8E5] p-3.5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-zinc-900">
                        {ret.code} (từ {ret.invoiceCode})
                      </span>
                      <Badge variant={ret.type === "EXCHANGE" ? "blue" : "amber"}>
                        {ret.type === "EXCHANGE" ? "Đổi sách" : "Trả hàng"}
                      </Badge>
                    </div>
                    <div className="text-zinc-600">Lý do: {ret.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
