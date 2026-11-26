"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Ban, Edit2, PauseCircle, PlayCircle, Plus, Search } from "lucide-react";
import { Badge, Modal, PageHeader } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { adminService } from "@/services";
import type {
  DiscountType,
  PromotionCampaign,
  PromotionStatus,
  Voucher,
  VoucherUsage,
} from "@/types";

export default function PromotionsPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<"CAMPAIGNS" | "VOUCHERS" | "HISTORY">("CAMPAIGNS");
  const [query, setQuery] = useState("");

  const [campaigns, setCampaigns] = useState<PromotionCampaign[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [usages, setUsages] = useState<VoucherUsage[]>([]);

  // Campaign Modal
  const [campOpen, setCampOpen] = useState(false);
  const [editCamp, setEditCamp] = useState<PromotionCampaign | null>(null);
  const [cCode, setCCode] = useState("");
  const [cName, setCName] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cType, setCType] = useState<DiscountType>("PERCENT");
  const [cVal, setCVal] = useState(10);
  const [cMinOrder, setCMinOrder] = useState(300000);
  const [cStart, setCStart] = useState("2026-11-26");
  const [cEnd, setCEnd] = useState("2026-12-31");
  const [cStatus, setCStatus] = useState<PromotionStatus>("ACTIVE");

  // Voucher Modal
  const [vcOpen, setVcOpen] = useState(false);
  const [editVc, setEditVc] = useState<Voucher | null>(null);
  const [vCode, setVCode] = useState("");
  const [vDesc, setVDesc] = useState("");
  const [vType, setVType] = useState<DiscountType>("FIXED");
  const [vVal, setVVal] = useState(50000);
  const [vMinOrder, setVMinOrder] = useState(400000);
  const [vLimit, setVLimit] = useState(100);
  const [vEnd, setVEnd] = useState("2026-12-31");

  const loadAll = async () => {
    const [p, v, u] = await Promise.all([
      adminService.getPromotions(),
      adminService.getVouchers(),
      adminService.getVoucherUsages(),
    ]);
    setCampaigns(p);
    setVouchers(v);
    setUsages(u);
  };

  useEffect(() => {
    void Promise.resolve().then(() => loadAll());
  }, []);

  const q = query.trim().toLowerCase();

  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter(
        (c) => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
      ),
    [campaigns, q],
  );

  const filteredVouchers = useMemo(
    () =>
      vouchers.filter(
        (v) => !q || v.code.toLowerCase().includes(q) || v.description.toLowerCase().includes(q),
      ),
    [vouchers, q],
  );

  const filteredUsages = useMemo(
    () =>
      usages.filter(
        (u) =>
          !q ||
          u.voucherCode.toLowerCase().includes(q) ||
          u.invoiceCode.toLowerCase().includes(q) ||
          u.customerName.toLowerCase().includes(q),
      ),
    [usages, q],
  );

  const openCreateCampaign = () => {
    setEditCamp(null);
    setCCode("KM-MOI");
    setCName("");
    setCDesc("");
    setCType("PERCENT");
    setCVal(10);
    setCMinOrder(300000);
    setCStart("2026-11-26");
    setCEnd("2026-12-31");
    setCStatus("ACTIVE");
    setCampOpen(true);
  };

  const openEditCampaign = (c: PromotionCampaign) => {
    setEditCamp(c);
    setCCode(c.code);
    setCName(c.name);
    setCDesc(c.description);
    setCType(c.discountType);
    setCVal(c.discountValue);
    setCMinOrder(c.minOrderValue);
    setCStart(c.startDate);
    setCEnd(c.endDate);
    setCStatus(c.status);
    setCampOpen(true);
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    await adminService.savePromotion({
      id: editCamp?.id,
      code: cCode.toUpperCase(),
      name: cName,
      description: cDesc,
      discountType: cType,
      discountValue: cVal,
      minOrderValue: cMinOrder,
      applicableCategory: "Tất cả thể loại",
      startDate: cStart,
      endDate: cEnd,
      status: cStatus,
    });
    await loadAll();
    setCampOpen(false);
    showToast("Đã lưu chương trình khuyến mãi!");
  };

  const changeCampaignStatus = async (camp: PromotionCampaign, nextStatus: PromotionStatus) => {
    await adminService.savePromotion({ ...camp, status: nextStatus });
    await loadAll();
    showToast(
      nextStatus === "CANCELLED"
        ? `Đã hủy chương trình ${camp.code}`
        : `Đã cập nhật trạng thái chương trình ${camp.code}`,
      "info",
    );
  };

  const openCreateVoucher = () => {
    setEditVc(null);
    setVCode("");
    setVDesc("");
    setVType("FIXED");
    setVVal(50000);
    setVMinOrder(400000);
    setVLimit(100);
    setVEnd("2026-12-31");
    setVcOpen(true);
  };

  const handleSaveVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    await adminService.saveVoucher({
      id: editVc?.id,
      code: vCode.toUpperCase(),
      description: vDesc,
      discountType: vType,
      discountValue: vVal,
      minOrderValue: vMinOrder,
      usageLimit: vLimit,
      startDate: "2026-11-26",
      endDate: vEnd,
      isActive: true,
    });
    await loadAll();
    setVcOpen(false);
    showToast("Đã lưu mã giảm giá (Voucher)!");
  };

  return (
    <div>
      <PageHeader
        title="Quản lý Khuyến mãi &amp; Mã giảm giá (Voucher)"
        subtitle="Thiết lập chiến dịch ưu đãi, phát hành mã giảm giá và tra cứu lịch sử áp dụng trên hóa đơn"
        actions={
          tab !== "HISTORY" && (
            <button
              type="button"
              onClick={tab === "CAMPAIGNS" ? openCreateCampaign : openCreateVoucher}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23533D]"
            >
              <Plus className="h-4 w-4" />
              {tab === "CAMPAIGNS" ? "Tạo chương trình KM" : "Tạo mã Voucher mới"}
            </button>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-[#E6E8E5] bg-white p-1 self-start">
          <button
            type="button"
            onClick={() => setTab("CAMPAIGNS")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold ${
              tab === "CAMPAIGNS" ? "bg-[#E8F3EE] text-[#2D6A4F]" : "text-zinc-600"
            }`}
          >
            Chương trình khuyến mãi ({campaigns.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("VOUCHERS")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold ${
              tab === "VOUCHERS" ? "bg-[#E8F3EE] text-[#2D6A4F]" : "text-zinc-600"
            }`}
          >
            Mã giảm giá - Voucher ({vouchers.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("HISTORY")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold ${
              tab === "HISTORY" ? "bg-[#E8F3EE] text-[#2D6A4F]" : "text-zinc-600"
            }`}
          >
            Lịch sử sử dụng mã ({usages.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tra cứu tên chương trình, mã voucher..."
            className="w-full rounded-xl border border-[#E6E8E5] bg-white py-2 pl-10 pr-4 text-xs focus:border-[#2D6A4F] focus:outline-none"
          />
        </div>
      </div>

      {/* Campaigns Table */}
      {tab === "CAMPAIGNS" && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Mã / Tên chương trình</th>
                <th className="px-5 py-3.5">Mức giảm</th>
                <th className="px-5 py-3.5">Đơn tối thiểu</th>
                <th className="px-5 py-3.5">Thời gian hiệu lực</th>
                <th className="px-5 py-3.5 text-center">Trạng thái</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {filteredCampaigns.map((c) => (
                <tr key={c.id} className="hover:bg-[#F7F8F6]/70">
                  <td className="px-5 py-3.5">
                    <div className="font-mono text-xs font-bold text-[#2D6A4F]">{c.code}</div>
                    <div className="font-semibold text-zinc-900">{c.name}</div>
                    <div className="text-xs text-zinc-500">{c.description}</div>
                  </td>
                  <td className="px-5 py-3.5 font-bold text-zinc-900">
                    {c.discountType === "PERCENT"
                      ? `${c.discountValue}%`
                      : formatCurrency(c.discountValue)}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-600">
                    {formatCurrency(c.minOrderValue)}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-600">
                    {formatDate(c.startDate)} → {formatDate(c.endDate)}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {c.status === "ACTIVE" && <Badge variant="sage">Đang chạy</Badge>}
                    {c.status === "SCHEDULED" && <Badge variant="blue">Sắp diễn ra</Badge>}
                    {c.status === "PAUSED" && <Badge variant="amber">Tạm dừng</Badge>}
                    {c.status === "CANCELLED" && <Badge variant="crimson">Đã hủy</Badge>}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditCampaign(c)}
                        className="rounded-lg border border-[#E6E8E5] p-1.5 text-zinc-600 hover:bg-zinc-100"
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {c.status === "ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => changeCampaignStatus(c, "PAUSED")}
                          className="rounded-lg border border-[#E6E8E5] p-1.5 text-[#B45309] hover:bg-[#FEF3C7]"
                          title="Tạm ngừng"
                        >
                          <PauseCircle className="h-4 w-4" />
                        </button>
                      ) : (
                        c.status !== "CANCELLED" && (
                          <button
                            type="button"
                            onClick={() => changeCampaignStatus(c, "ACTIVE")}
                            className="rounded-lg border border-[#E6E8E5] p-1.5 text-[#2D6A4F] hover:bg-[#E8F3EE]"
                            title="Kích hoạt"
                          >
                            <PlayCircle className="h-4 w-4" />
                          </button>
                        )
                      )}
                      {c.status !== "CANCELLED" && (
                        <button
                          type="button"
                          onClick={() => changeCampaignStatus(c, "CANCELLED")}
                          className="rounded-lg border border-[#E6E8E5] p-1.5 text-[#B91C1C] hover:bg-[#FEE2E2]"
                          title="Hủy chương trình"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Vouchers Table */}
      {tab === "VOUCHERS" && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Mã Voucher</th>
                <th className="px-5 py-3.5">Ưu đãi &amp; Điều kiện</th>
                <th className="px-5 py-3.5 text-center">Đã dùng / Giới hạn</th>
                <th className="px-5 py-3.5">Hạn dùng</th>
                <th className="px-5 py-3.5 text-center">Trạng thái</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {filteredVouchers.map((v) => (
                <tr key={v.id} className="hover:bg-[#F7F8F6]/70">
                  <td className="px-5 py-3.5 font-mono text-sm font-bold text-[#2D6A4F]">
                    {v.code}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-zinc-900">{v.description}</div>
                    <div className="text-xs text-zinc-500">
                      Đơn tối thiểu: {formatCurrency(v.minOrderValue)}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center font-mono text-xs font-semibold">
                    {v.usedCount} / {v.usageLimit}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-600">{formatDate(v.endDate)}</td>
                  <td className="px-5 py-3.5 text-center">
                    {v.isActive ? (
                      <Badge variant="sage">Đang mở</Badge>
                    ) : (
                      <Badge variant="crimson">Ngừng / Hết lượt</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={async () => {
                        await adminService.saveVoucher({ ...v, isActive: !v.isActive });
                        loadAll();
                        showToast("Đã cập nhật trạng thái mã giảm giá");
                      }}
                      className="rounded-lg border border-[#E6E8E5] px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                      {v.isActive ? "Ngừng kích hoạt" : "Mở lại mã"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Voucher Usage History */}
      {tab === "HISTORY" && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Mã Voucher</th>
                <th className="px-5 py-3.5">Hóa đơn áp dụng</th>
                <th className="px-5 py-3.5">Khách hàng</th>
                <th className="px-5 py-3.5">Thời điểm sử dụng</th>
                <th className="px-5 py-3.5 text-right">Số tiền giảm</th>
                <th className="px-5 py-3.5 text-right">Giá trị hóa đơn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {filteredUsages.map((u) => (
                <tr key={u.id} className="hover:bg-[#F7F8F6]/70">
                  <td className="px-5 py-3.5 font-mono text-xs font-bold text-[#2D6A4F]">
                    {u.voucherCode}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-zinc-700">{u.invoiceCode}</td>
                  <td className="px-5 py-3.5 font-medium text-zinc-900">{u.customerName}</td>
                  <td className="px-5 py-3.5 text-xs text-zinc-500">
                    {formatDateTime(u.usedAt)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-[#2D6A4F]">
                    -{formatCurrency(u.discountAmount)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-zinc-900">
                    {formatCurrency(u.orderTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Campaign Modal */}
      <Modal
        open={campOpen}
        onClose={() => setCampOpen(false)}
        title={editCamp ? "Chỉnh sửa chương trình khuyến mãi" : "Thiết lập chương trình khuyến mãi"}
      >
        <form onSubmit={handleSaveCampaign} className="space-y-4 text-sm">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Mã CT *</label>
              <input
                type="text"
                required
                value={cCode}
                onChange={(e) => setCCode(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2 uppercase"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-zinc-600">Tên chương trình *</label>
              <input
                type="text"
                required
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Loại giảm</label>
              <select
                value={cType}
                onChange={(e) => setCType(e.target.value as DiscountType)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              >
                <option value="PERCENT">Phần trăm (%)</option>
                <option value="FIXED">Số tiền (VNĐ)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Giá trị giảm</label>
              <input
                type="number"
                min={1}
                value={cVal}
                onChange={(e) => setCVal(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Đơn tối thiểu</label>
              <input
                type="number"
                min={0}
                value={cMinOrder}
                onChange={(e) => setCMinOrder(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Từ ngày</label>
              <input
                type="date"
                value={cStart}
                onChange={(e) => setCStart(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Đến ngày</label>
              <input
                type="date"
                value={cEnd}
                onChange={(e) => setCEnd(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600">Mô tả chi tiết</label>
            <textarea
              rows={2}
              value={cDesc}
              onChange={(e) => setCDesc(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCampOpen(false)}
              className="rounded-xl border border-[#E6E8E5] px-4 py-2 text-zinc-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#2D6A4F] px-4 py-2 font-semibold text-white hover:bg-[#23533D]"
            >
              Lưu chương trình
            </button>
          </div>
        </form>
      </Modal>

      {/* Voucher Modal */}
      <Modal open={vcOpen} onClose={() => setVcOpen(false)} title="Phát hành Mã giảm giá (Voucher)">
        <form onSubmit={handleSaveVoucher} className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Mã Voucher *</label>
              <input
                type="text"
                required
                value={vCode}
                onChange={(e) => setVCode(e.target.value)}
                placeholder="VD: MOC100K"
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2 font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Số lượt dùng tối đa</label>
              <input
                type="number"
                min={1}
                value={vLimit}
                onChange={(e) => setVLimit(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Hình thức giảm</label>
              <select
                value={vType}
                onChange={(e) => setVType(e.target.value as DiscountType)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              >
                <option value="FIXED">Giảm tiền (VNĐ)</option>
                <option value="PERCENT">Phần trăm (%)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Mức giảm</label>
              <input
                type="number"
                min={1}
                value={vVal}
                onChange={(e) => setVVal(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Đơn tối thiểu</label>
              <input
                type="number"
                min={0}
                value={vMinOrder}
                onChange={(e) => setVMinOrder(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Mô tả ngắn *</label>
              <input
                type="text"
                required
                value={vDesc}
                onChange={(e) => setVDesc(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Hạn sử dụng</label>
              <input
                type="date"
                value={vEnd}
                onChange={(e) => setVEnd(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setVcOpen(false)}
              className="rounded-xl border border-[#E6E8E5] px-4 py-2 text-zinc-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#2D6A4F] px-4 py-2 font-semibold text-white hover:bg-[#23533D]"
            >
              Tạo mã Voucher
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
