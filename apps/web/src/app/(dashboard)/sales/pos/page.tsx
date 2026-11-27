"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  Minus,
  Plus,
  Printer,
  QrCode,
  Search,
  ShoppingBag,
  Tag,
  Trash2,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { Badge, Modal } from "@/components/ui";
import { BRAND_CONFIG } from "@/config/brand";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { triggerPrint } from "@/lib/export";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { adminService, inventoryService, salesService } from "@/services";
import type {
  Book,
  Category,
  Customer,
  Invoice,
  InvoiceItem,
  PaymentMethod,
  PromotionCampaign,
  Voucher,
} from "@/types";

interface DraftCart {
  id: string;
  label: string;
  items: InvoiceItem[];
  customerId: string;
  selectedPromoId: string;
  voucherInput: string;
  appliedVoucherCode: string;
  paymentMethod: PaymentMethod;
  amountGiven: string;
  note: string;
}

function createEmptyDraft(index: number): DraftCart {
  return {
    id: `draft-${Date.now()}-${index}`,
    label: `Đơn tạm #${index}`,
    items: [],
    customerId: "",
    selectedPromoId: "",
    voucherInput: "",
    appliedVoucherCode: "",
    paymentMethod: "CASH",
    amountGiven: "",
    note: "",
  };
}

export default function PosPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [promotions, setPromotions] = useState<PromotionCampaign[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const [drafts, setDrafts] = useState<DraftCart[]>(() => [createEmptyDraft(1)]);
  const [activeDraftId, setActiveDraftId] = useState<string>(() => drafts[0].id);

  // Quick Add Customer Modal
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  // Receipt Preview Modal
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);

  const loadData = async () => {
    const [bk, cat, cus, prm, vc] = await Promise.all([
      inventoryService.getBooks(),
      inventoryService.getCategories(),
      salesService.getCustomers(),
      adminService.getPromotions(),
      adminService.getVouchers(),
    ]);
    setBooks(bk);
    setCategories(cat);
    setCustomers(cus);
    setPromotions(prm.filter((p) => p.status === "ACTIVE"));
    setVouchers(vc.filter((v) => v.isActive && v.usedCount < v.usageLimit));
  };

  useEffect(() => {
    void Promise.resolve().then(() => loadData());
  }, []);

  const currentDraft = useMemo(
    () => drafts.find((d) => d.id === activeDraftId) ?? drafts[0],
    [drafts, activeDraftId],
  );

  const updateCurrentDraft = (updater: (draft: DraftCart) => DraftCart) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === currentDraft.id ? updater(d) : d)),
    );
  };

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return books.filter((b) => {
      if (b.status === "DISCONTINUED") return false;
      if (selectedCategory !== "ALL" && b.categoryId !== selectedCategory) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.sku.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.authorName.toLowerCase().includes(q)
      );
    });
  }, [books, searchQuery, selectedCategory]);

  const addBookToCart = (book: Book) => {
    if (book.stock <= 0) {
      showToast(`Sách "${book.title}" hiện đã hết hàng trong kho.`, "warning");
      return;
    }

    updateCurrentDraft((draft) => {
      const existing = draft.items.find((i) => i.bookId === book.id);
      if (existing) {
        if (existing.quantity >= book.stock) {
          showToast(`Chỉ còn ${book.stock} cuốn trong kho.`, "warning");
          return draft;
        }
        return {
          ...draft,
          items: draft.items.map((i) =>
            i.bookId === book.id
              ? {
                  ...i,
                  quantity: i.quantity + 1,
                  subtotal: (i.quantity + 1) * i.unitPrice,
                }
              : i,
          ),
        };
      }
      return {
        ...draft,
        items: [
          ...draft.items,
          {
            bookId: book.id,
            sku: book.sku,
            title: book.title,
            quantity: 1,
            unitPrice: book.sellPrice,
            subtotal: book.sellPrice,
          },
        ],
      };
    });
  };

  const changeQty = (bookId: string, delta: number) => {
    const book = books.find((b) => b.id === bookId);
    updateCurrentDraft((draft) => {
      const nextItems = draft.items
        .map((item) => {
          if (item.bookId !== bookId) return item;
          const nextQty = item.quantity + delta;
          if (book && nextQty > book.stock) {
            showToast(`Tồn kho tối đa của sách này là ${book.stock} cuốn.`, "warning");
            return item;
          }
          return {
            ...item,
            quantity: nextQty,
            subtotal: nextQty * item.unitPrice,
          };
        })
        .filter((item) => item.quantity > 0);
      return { ...draft, items: nextItems };
    });
  };

  const subtotal = useMemo(
    () => currentDraft.items.reduce((sum, i) => sum + i.subtotal, 0),
    [currentDraft.items],
  );

  // Calculate discount from selected Promotion Campaign OR Applied Voucher
  const { discountAmount, appliedPromoName } = useMemo(() => {
    let promoDiscount = 0;
    let promoLabel = "";

    if (currentDraft.selectedPromoId) {
      const promo = promotions.find((p) => p.id === currentDraft.selectedPromoId);
      if (promo && subtotal >= promo.minOrderValue) {
        promoDiscount =
          promo.discountType === "PERCENT"
            ? Math.round((subtotal * promo.discountValue) / 100)
            : promo.discountValue;
        if (promo.maxDiscountAmount) {
          promoDiscount = Math.min(promoDiscount, promo.maxDiscountAmount);
        }
        promoLabel = promo.name;
      }
    }

    let voucherDiscount = 0;
    if (currentDraft.appliedVoucherCode) {
      const vc = vouchers.find(
        (v) => v.code.toUpperCase() === currentDraft.appliedVoucherCode.toUpperCase(),
      );
      if (vc && subtotal >= vc.minOrderValue) {
        voucherDiscount =
          vc.discountType === "PERCENT"
            ? Math.round((subtotal * vc.discountValue) / 100)
            : vc.discountValue;
        if (vc.maxDiscountAmount) {
          voucherDiscount = Math.min(voucherDiscount, vc.maxDiscountAmount);
        }
      }
    }

    const totalDiscount = Math.min(subtotal, promoDiscount + voucherDiscount);
    return { discountAmount: totalDiscount, appliedPromoName: promoLabel };
  }, [currentDraft.selectedPromoId, currentDraft.appliedVoucherCode, promotions, vouchers, subtotal]);

  const totalPayable = Math.max(0, subtotal - discountAmount);
  const numericGiven = Number(currentDraft.amountGiven) || totalPayable;
  const changeAmount =
    currentDraft.paymentMethod === "CASH" ? Math.max(0, numericGiven - totalPayable) : 0;

  const handleApplyVoucher = () => {
    const code = currentDraft.voucherInput.trim().toUpperCase();
    if (!code) return;
    const found = vouchers.find((v) => v.code.toUpperCase() === code);
    if (!found) {
      showToast("Mã giảm giá không tồn tại hoặc đã hết lượt sử dụng.", "error");
      return;
    }
    if (subtotal < found.minOrderValue) {
      showToast(
        `Mã ${code} yêu cầu đơn tối thiểu ${formatCurrency(found.minOrderValue)}.`,
        "warning",
      );
      return;
    }
    updateCurrentDraft((d) => ({ ...d, appliedVoucherCode: found.code, voucherInput: "" }));
    showToast(`Đã áp dụng mã giảm giá ${found.code}!`, "success");
  };

  const handleAddDraftTab = () => {
    const nextIdx = drafts.length + 1;
    const created = createEmptyDraft(nextIdx);
    setDrafts((prev) => [...prev, created]);
    setActiveDraftId(created.id);
  };

  const handleCloseDraftTab = (id: string) => {
    if (drafts.length === 1) {
      const fresh = createEmptyDraft(1);
      setDrafts([fresh]);
      setActiveDraftId(fresh.id);
      return;
    }
    const remaining = drafts.filter((d) => d.id !== id);
    setDrafts(remaining);
    if (activeDraftId === id) {
      setActiveDraftId(remaining[0].id);
    }
  };

  const handleQuickCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) return;
    const created = await salesService.saveCustomer({
      fullName: newCustomerName.trim(),
      phone: newCustomerPhone.trim(),
      email: "",
      address: "",
      tier: "STANDARD",
    });
    const updatedCustomers = await salesService.getCustomers();
    setCustomers(updatedCustomers);
    updateCurrentDraft((d) => ({ ...d, customerId: created.id }));
    setNewCustomerName("");
    setNewCustomerPhone("");
    setQuickCustomerOpen(false);
    showToast(`Đã thêm khách hàng ${created.fullName}`);
  };

  const handleCheckout = async () => {
    if (currentDraft.items.length === 0) {
      showToast("Giỏ hàng đang trống, vui lòng chọn ít nhất 1 cuốn sách.", "warning");
      return;
    }
    if (
      currentDraft.paymentMethod === "CASH" &&
      currentDraft.amountGiven !== "" &&
      Number(currentDraft.amountGiven) < totalPayable
    ) {
      showToast("Số tiền khách đưa nhỏ hơn tổng cần thanh toán.", "error");
      return;
    }

    const selectedCus = customers.find((c) => c.id === currentDraft.customerId);

    const invoice = await salesService.createInvoice({
      customerId: selectedCus?.id ?? null,
      customerName: selectedCus?.fullName ?? "Khách lẻ vãng lai",
      customerPhone: selectedCus?.phone ?? "—",
      cashierId: user?.id ?? "USR-02",
      cashierName: user?.fullName ?? "Nhân viên thu ngân",
      items: currentDraft.items,
      subtotal,
      promotionId: currentDraft.selectedPromoId || undefined,
      promotionName: appliedPromoName || undefined,
      voucherCode: currentDraft.appliedVoucherCode || undefined,
      discountAmount,
      totalAmount: totalPayable,
      amountPaid: currentDraft.paymentMethod === "CASH" ? numericGiven : totalPayable,
      changeAmount,
      paymentMethod: currentDraft.paymentMethod,
      note: currentDraft.note || undefined,
    });

    setCompletedInvoice(invoice);
    await loadData();
    handleCloseDraftTab(currentDraft.id);
    showToast(`Đã lập hóa đơn ${invoice.code} thành công!`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Quầy bán hàng (POS)
          </h1>
          <p className="text-sm text-zinc-500">
            Tra cứu sách, giữ nhiều hóa đơn tạm, áp dụng khuyến mãi và ghi nhận thanh toán
          </p>
        </div>

        {/* Hold / Draft Invoice Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {drafts.map((d) => {
            const active = d.id === currentDraft.id;
            return (
              <div
                key={d.id}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-[#2D6A4F] bg-[#E8F3EE] text-[#2D6A4F]"
                    : "border-[#E6E8E5] bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                <button type="button" onClick={() => setActiveDraftId(d.id)}>
                  {d.label} ({d.items.reduce((s, it) => s + it.quantity, 0)})
                </button>
                <button
                  type="button"
                  onClick={() => handleCloseDraftTab(d.id)}
                  className="rounded p-0.5 hover:bg-black/5"
                  title="Đóng đơn tạm"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={handleAddDraftTab}
            className="inline-flex items-center gap-1 rounded-xl border border-dashed border-[#2D6A4F] px-3 py-1.5 text-xs font-medium text-[#2D6A4F] hover:bg-[#E8F3EE]/60"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm hóa đơn tạm
          </button>
        </div>
      </div>

      {/* Main 2-column POS Layout */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Book Lookup & Catalog */}
        <div className="space-y-4 xl:col-span-7">
          <div className="rounded-2xl border border-[#E6E8E5] bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên sách, mã SP, ISBN hoặc tác giả..."
                  className="w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] py-2.5 pl-10 pr-4 text-sm focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3.5 py-2.5 text-sm text-zinc-700 focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
              >
                <option value="ALL">Tất cả thể loại</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {filteredBooks.map((book) => {
              const outOfStock = book.stock <= 0;
              return (
                <button
                  key={book.id}
                  type="button"
                  disabled={outOfStock}
                  onClick={() => addBookToCart(book)}
                  className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition-colors ${
                    outOfStock
                      ? "border-[#E6E8E5] bg-zinc-50 opacity-60 cursor-not-allowed"
                      : "border-[#E6E8E5] bg-white hover:border-[#2D6A4F]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-zinc-400">{book.sku}</span>
                      <Badge
                        variant={
                          book.stock === 0
                            ? "crimson"
                            : book.stock <= book.minStock
                              ? "amber"
                              : "sage"
                        }
                      >
                        {book.stock === 0 ? "Hết hàng" : `Tồn: ${book.stock}`}
                      </Badge>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-zinc-900">
                      {book.title}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      {book.authorName} • {book.shelfLocation}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[#E6E8E5] pt-3">
                    <span className="text-base font-bold text-[#2D6A4F]">
                      {formatCurrency(book.sellPrice)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#E8F3EE] px-2.5 py-1 text-xs font-medium text-[#2D6A4F]">
                      <Plus className="h-3.5 w-3.5" /> Chọn
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Current Cart, Customer, Promotions & Payment */}
        <div className="xl:col-span-5">
          <div className="sticky top-20 rounded-2xl border border-[#E6E8E5] bg-white p-5 space-y-4">
            {/* Customer selector */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Khách hàng
                </label>
                <button
                  type="button"
                  onClick={() => setQuickCustomerOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#2D6A4F] hover:underline"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Thêm khách mới
                </button>
              </div>
              <select
                value={currentDraft.customerId}
                onChange={(e) =>
                  updateCurrentDraft((d) => ({ ...d, customerId: e.target.value }))
                }
                className="mt-1.5 w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3 py-2 text-sm text-zinc-800 focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
              >
                <option value="">Khách lẻ vãng lai</option>
                {customers.map((cus) => (
                  <option key={cus.id} value={cus.id}>
                    {cus.fullName} — {cus.phone} ({cus.tier})
                  </option>
                ))}
              </select>
            </div>

            {/* Cart Items List */}
            <div className="border-y border-[#E6E8E5] py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Chi tiết giỏ hàng ({currentDraft.items.length} đầu sách)
                </span>
                {currentDraft.items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => updateCurrentDraft((d) => ({ ...d, items: [] }))}
                    className="text-xs text-[#B91C1C] hover:underline"
                  >
                    Xóa giỏ
                  </button>
                )}
              </div>

              {currentDraft.items.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400">
                  <ShoppingBag className="mx-auto mb-2 h-7 w-7 text-zinc-300" />
                  Chưa có sách trong {currentDraft.label}. Nhấn vào sách bên trái để thêm.
                </div>
              ) : (
                <div className="max-h-60 space-y-2.5 overflow-y-auto pr-1">
                  {currentDraft.items.map((item) => (
                    <div
                      key={item.bookId}
                      className="flex items-center justify-between gap-2 rounded-xl bg-[#F7F8F6] p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-zinc-900">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {formatCurrency(item.unitPrice)} / cuốn
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => changeQty(item.bookId, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-[#E6E8E5] bg-white text-zinc-600 hover:bg-zinc-100"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeQty(item.bookId, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-[#E6E8E5] bg-white text-zinc-600 hover:bg-zinc-100"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="w-24 text-right text-xs font-bold text-zinc-900">
                        {formatCurrency(item.subtotal)}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          updateCurrentDraft((d) => ({
                            ...d,
                            items: d.items.filter((x) => x.bookId !== item.bookId),
                          }))
                        }
                        className="text-zinc-400 hover:text-[#B91C1C]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Promotions & Voucher Application */}
            <div className="space-y-2.5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Chương trình khuyến mãi
                </label>
                <select
                  value={currentDraft.selectedPromoId}
                  onChange={(e) =>
                    updateCurrentDraft((d) => ({ ...d, selectedPromoId: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3 py-2 text-xs text-zinc-800 focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
                >
                  <option value="">— Không chọn khuyến mãi tự động —</option>
                  {promotions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Đơn từ {formatCurrency(p.minOrderValue)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={currentDraft.voucherInput}
                    onChange={(e) =>
                      updateCurrentDraft((d) => ({ ...d, voucherInput: e.target.value }))
                    }
                    placeholder="Nhập mã Voucher (VD: MOC50K, BANMOI15)"
                    className="w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] py-2 pl-8 pr-3 text-xs uppercase focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyVoucher}
                  className="rounded-xl border border-[#2D6A4F] px-3.5 py-2 text-xs font-semibold text-[#2D6A4F] hover:bg-[#E8F3EE]"
                >
                  Áp dụng
                </button>
              </div>

              {currentDraft.appliedVoucherCode && (
                <div className="flex items-center justify-between rounded-lg bg-[#E8F3EE] px-3 py-1.5 text-xs text-[#2D6A4F]">
                  <span>
                    Đã áp mã: <strong>{currentDraft.appliedVoucherCode}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateCurrentDraft((d) => ({ ...d, appliedVoucherCode: "" }))
                    }
                    className="font-medium hover:underline"
                  >
                    Gỡ mã
                  </button>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Phương thức thanh toán
              </label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {(
                  [
                    ["CASH", "Tiền mặt", Wallet],
                    ["TRANSFER", "Chuyển khoản", QrCode],
                    ["CARD", "Thẻ POS", CreditCard],
                  ] as const
                ).map(([method, label, Icon]) => {
                  const active = currentDraft.paymentMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() =>
                        updateCurrentDraft((d) => ({ ...d, paymentMethod: method }))
                      }
                      className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-medium ${
                        active
                          ? "border-[#2D6A4F] bg-[#E8F3EE] text-[#2D6A4F]"
                          : "border-[#E6E8E5] bg-[#F7F8F6] text-zinc-600"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>

              {currentDraft.paymentMethod === "CASH" && (
                <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-zinc-500">Tiền khách đưa (VNĐ)</label>
                    <input
                      type="number"
                      value={currentDraft.amountGiven}
                      onChange={(e) =>
                        updateCurrentDraft((d) => ({ ...d, amountGiven: e.target.value }))
                      }
                      placeholder={String(totalPayable)}
                      className="mt-1 w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3 py-1.5 text-xs font-semibold focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500">Tiền thừa trả khách</label>
                    <div className="mt-1 rounded-xl border border-[#E6E8E5] bg-zinc-50 px-3 py-1.5 text-xs font-bold text-[#2D6A4F]">
                      {formatCurrency(changeAmount)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Totals Summary */}
            <div className="space-y-1.5 rounded-xl bg-[#F7F8F6] p-3.5 text-sm">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Tạm tính</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#2D6A4F]">
                <span>Chiết khấu / Khuyến mãi</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-[#E6E8E5] pt-2 text-base font-bold text-zinc-900">
                <span>Khách cần trả</span>
                <span className="text-[#2D6A4F]">{formatCurrency(totalPayable)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D6A4F] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#23533D]"
            >
              <CheckCircle2 className="h-4 w-4" />
              Lập hóa đơn &amp; Thanh toán
            </button>
          </div>
        </div>
      </div>

      {/* Quick Create Customer Modal */}
      <Modal
        open={quickCustomerOpen}
        onClose={() => setQuickCustomerOpen(false)}
        title="Thêm nhanh khách hàng thành viên"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleQuickCreateCustomer} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600">Họ và tên *</label>
            <input
              type="text"
              required
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2 text-sm focus:border-[#2D6A4F] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600">Số điện thoại *</label>
            <input
              type="text"
              required
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              placeholder="0909 123 456"
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2 text-sm focus:border-[#2D6A4F] focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setQuickCustomerOpen(false)}
              className="rounded-xl border border-[#E6E8E5] px-4 py-2 text-sm text-zinc-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white"
            >
              Lưu &amp; Chọn khách
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Invoice Receipt Preview Modal */}
      <Modal
        open={Boolean(completedInvoice)}
        onClose={() => setCompletedInvoice(null)}
        title="Hóa đơn thanh toán thành công"
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setCompletedInvoice(null)}
              className="rounded-xl border border-[#E6E8E5] bg-white px-4 py-2 text-sm font-medium text-zinc-700"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={triggerPrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white"
            >
              <Printer className="h-4 w-4" />
              In hóa đơn
            </button>
          </>
        }
      >
        {completedInvoice && (
          <div className="space-y-3 text-xs text-zinc-700">
            <div className="text-center border-b border-dashed border-zinc-300 pb-3">
              <div className="text-base font-bold text-zinc-900">{BRAND_CONFIG.companyName}</div>
              <div className="text-zinc-500">{BRAND_CONFIG.branches[0].address}</div>
              <div className="mt-2 font-mono font-semibold text-zinc-900">
                Mã HĐ: {completedInvoice.code}
              </div>
              <div className="text-zinc-500">{formatDateTime(completedInvoice.createdAt)}</div>
            </div>

            <div className="space-y-1">
              <div>Khách hàng: <strong>{completedInvoice.customerName}</strong></div>
              <div>Thu ngân: {completedInvoice.cashierName}</div>
            </div>

            <div className="border-y border-dashed border-zinc-300 py-2 space-y-1.5">
              {completedInvoice.items.map((it) => (
                <div key={it.bookId} className="flex justify-between gap-2">
                  <span>
                    {it.title} × {it.quantity}
                  </span>
                  <span className="font-semibold shrink-0">{formatCurrency(it.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Tạm tính:</span>
                <span>{formatCurrency(completedInvoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#2D6A4F]">
                <span>Khuyến mãi / Giảm giá:</span>
                <span>-{formatCurrency(completedInvoice.discountAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-zinc-900 pt-1">
                <span>Tổng thanh toán:</span>
                <span>{formatCurrency(completedInvoice.totalAmount)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
