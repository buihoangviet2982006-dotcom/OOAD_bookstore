"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Edit2, Eye, Plus, Search } from "lucide-react";
import { Badge, Drawer, Modal, PageHeader } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { adminService, inventoryService } from "@/services";
import type { PurchaseOrder, Supplier } from "@/types";

export default function SuppliersPage() {
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [query, setQuery] = useState("");

  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const [selectedPoDetail, setSelectedPoDetail] = useState<PurchaseOrder | null>(null);

  // Edit / Create Supplier Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [name, setName] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  const loadAll = async () => {
    const [sups, pos] = await Promise.all([
      adminService.getSuppliers(),
      inventoryService.getPurchaseOrders(),
    ]);
    setSuppliers(sups);
    setPurchaseOrders(pos);
  };

  useEffect(() => {
    void Promise.resolve().then(() => loadAll());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q),
    );
  }, [suppliers, query]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setTaxCode("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setAddress("");
    setStatus("ACTIVE");
    setFormOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setName(s.name);
    setTaxCode(s.taxCode);
    setContactPerson(s.contactPerson);
    setPhone(s.phone);
    setEmail(s.email);
    setAddress(s.address);
    setStatus(s.status);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await adminService.saveSupplier({
      id: editing?.id,
      name,
      taxCode,
      contactPerson,
      phone,
      email,
      address,
      status,
    });
    await loadAll();
    setFormOpen(false);
    showToast("Đã cập nhật hồ sơ Nhà cung cấp!");
  };

  const supplierPos = useMemo(
    () =>
      detailSupplier
        ? purchaseOrders.filter((p) => p.supplierId === detailSupplier.id)
        : [],
    [detailSupplier, purchaseOrders],
  );

  return (
    <div>
      <PageHeader
        title="Quản lý Nhà cung cấp"
        subtitle="Quản lý hồ sơ đối tác phát hành sách, tra cứu lịch sử nhập hàng và xem chi tiết từng lô nhập"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23533D]"
          >
            <Plus className="h-4 w-4" />
            Thêm Nhà cung cấp
          </button>
        }
      />

      <div className="mb-5 rounded-2xl border border-[#E6E8E5] bg-white p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên Nhà cung cấp, mã NCC, người liên hệ hoặc SĐT..."
            className="w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] py-2 pl-10 pr-4 text-sm focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Mã NCC</th>
                <th className="px-5 py-3.5">Đơn vị cung cấp</th>
                <th className="px-5 py-3.5">Người liên hệ</th>
                <th className="px-5 py-3.5 text-right">Tổng nhập</th>
                <th className="px-5 py-3.5 text-right">Công nợ hiện tại</th>
                <th className="px-5 py-3.5 text-center">Trạng thái</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-[#F7F8F6]/70">
                  <td className="px-5 py-3.5 font-mono text-xs font-bold text-[#2D6A4F]">
                    {s.code}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-zinc-900">{s.name}</div>
                    <div className="text-xs text-zinc-400">MST: {s.taxCode}</div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-600">
                    <div className="font-medium text-zinc-800">{s.contactPerson}</div>
                    <div>{s.phone}</div>
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium text-zinc-800">
                    {formatCurrency(s.totalImportAmount)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-[#B91C1C]">
                    {formatCurrency(s.currentDebt)}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <Badge variant={s.status === "ACTIVE" ? "sage" : "slate"}>
                      {s.status === "ACTIVE" ? "Đang hợp tác" : "Tạm ngưng"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setDetailSupplier(s);
                          setSelectedPoDetail(null);
                        }}
                        className="rounded-lg border border-[#E6E8E5] p-1.5 text-zinc-600 hover:bg-zinc-100"
                        title="Hồ sơ & lịch sử nhập hàng"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="rounded-lg border border-[#E6E8E5] p-1.5 text-zinc-600 hover:bg-zinc-100"
                        title="Cập nhật"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Profile & Import History Drawer */}
      <Drawer
        open={Boolean(detailSupplier)}
        onClose={() => setDetailSupplier(null)}
        title={detailSupplier?.name ?? ""}
        subtitle={`${detailSupplier?.code ?? ""} • MST: ${detailSupplier?.taxCode ?? ""}`}
        width="max-w-2xl"
      >
        {detailSupplier && (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#F7F8F6] p-4">
              <div>
                <span className="text-zinc-400">Người đại diện liên hệ:</span>
                <div className="mt-0.5 font-semibold text-zinc-900">
                  {detailSupplier.contactPerson} ({detailSupplier.phone})
                </div>
              </div>
              <div>
                <span className="text-zinc-400">Email giao dịch:</span>
                <div className="mt-0.5 font-semibold text-zinc-900">{detailSupplier.email}</div>
              </div>
              <div className="col-span-2">
                <span className="text-zinc-400">Địa chỉ:</span>
                <div className="mt-0.5 text-zinc-700">{detailSupplier.address}</div>
              </div>
            </div>

            <div>
              <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Lịch sử phiếu nhập hàng ({supplierPos.length})
              </h4>
              {supplierPos.length === 0 ? (
                <p className="py-6 text-center text-zinc-400">
                  Chưa có phiếu nhập hàng nào từ nhà cung cấp này.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {supplierPos.map((po) => (
                    <div
                      key={po.id}
                      className="rounded-xl border border-[#E6E8E5] p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#2D6A4F]">{po.code}</span>
                        <span className="text-zinc-400">{formatDateTime(po.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>
                          Tổng nhập: <strong>{formatCurrency(po.totalAmount)}</strong> • Nợ:{" "}
                          <strong className="text-[#B91C1C]">
                            {formatCurrency(po.debtAmount)}
                          </strong>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedPoDetail(selectedPoDetail?.id === po.id ? null : po)
                          }
                          className="font-semibold text-[#2D6A4F] hover:underline"
                        >
                          {selectedPoDetail?.id === po.id ? "Ẩn chi tiết" : "Xem chi tiết sách"}
                        </button>
                      </div>

                      {selectedPoDetail?.id === po.id && (
                        <div className="mt-2 divide-y divide-[#E6E8E5] rounded-lg bg-[#F7F8F6] p-2.5">
                          {po.items.map((it) => (
                            <div key={it.bookId} className="flex justify-between py-1.5">
                              <span>
                                {it.title} × {it.quantity}
                              </span>
                              <span className="font-semibold">{formatCurrency(it.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Supplier Edit / Create Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Cập nhật ${editing.code}` : "Thêm Nhà cung cấp mới"}
      >
        <form onSubmit={handleSave} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-zinc-600">Tên đơn vị cung cấp *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Mã số thuế</label>
              <input
                type="text"
                value={taxCode}
                onChange={(e) => setTaxCode(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Người đại diện liên hệ *</label>
              <input
                type="text"
                required
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
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
              Lưu Nhà cung cấp
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
