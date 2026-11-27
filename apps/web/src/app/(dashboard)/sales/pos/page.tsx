"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { shouldUseMock } from "@/config/api";
import { BRAND_CONFIG } from "@/config/brand";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { InvoiceReceipt, printInvoice } from "@/components/invoice/InvoiceReceipt";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/http-client";
import { adminService, inventoryService, salesService } from "@/services";
import type {
  Book,
  CartRequest,
  Category,
  Customer,
  Invoice,
  InvoiceItem,
  InvoicePreview,
  PaymentMethod,
  PromotionCampaign,
  Voucher,
} from "@/types";

interface DraftCart {
  pendingCheckout?: Parameters<typeof salesService.createInvoice>[0];
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
  /** Khóa chống tạo hóa đơn lặp: giữ nguyên khi bấm lại / thử lại, đơn mới có khóa mới. */
  requestKey: string;
}

function createEmptyDraft(index: number): DraftCart {
  return {
    requestKey: crypto.randomUUID(),
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

  // API thật cho bán hàng (cờ "sales"); đang gửi yêu cầu lập hóa đơn thì khóa nút.
  const realSales = !shouldUseMock("sales");
  const [submitting, setSubmitting] = useState(false);

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
    // API thật trả `status` đã xét hạn dùng, lượt dùng, tạm ngừng.
    setVouchers(vc.filter((v) => (v.status ? v.status === "ACTIVE" : v.isActive && v.usedCount < v.usageLimit)));
  };

  useEffect(() => {
    void Promise.resolve()
      .then(() => loadData())
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Không tải được dữ liệu.", "error"),
      );
    // Lỗi tải (mất kết nối, hết phiên…) hiện thành thông báo thay vì bảng trống im lặng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentDraft = useMemo(
    () => drafts.find((d) => d.id === activeDraftId) ?? drafts[0],
    [drafts, activeDraftId],
  );

  const updateCurrentDraft = (updater: (draft: DraftCart) => DraftCart) => {
    if (currentDraft.pendingCheckout || submitting) {
      showToast("Hãy khôi phục kết quả đơn đã gửi trước khi sửa giỏ.", "warning");
      return;
    }
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

  const localSubtotal = useMemo(
    () => currentDraft.items.reduce((sum, i) => sum + i.subtotal, 0),
    [currentDraft.items],
  );

  // Chế độ Mock: tính giảm giá trên FE như cũ. API thật: dùng preview của backend (bên dưới).
  const localDiscount = useMemo(() => {
    let promoDiscount = 0;
    let promoLabel = "";

    if (currentDraft.selectedPromoId) {
      const promo = promotions.find((p) => p.id === currentDraft.selectedPromoId);
      if (promo && localSubtotal >= promo.minOrderValue) {
        promoDiscount =
          promo.discountType === "PERCENT"
            ? Math.round((localSubtotal * promo.discountValue) / 100)
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
      if (vc && localSubtotal >= vc.minOrderValue) {
        voucherDiscount =
          vc.discountType === "PERCENT"
            ? Math.round((localSubtotal * vc.discountValue) / 100)
            : vc.discountValue;
        if (vc.maxDiscountAmount) {
          voucherDiscount = Math.min(voucherDiscount, vc.maxDiscountAmount);
        }
      }
    }

    const totalDiscount = Math.min(localSubtotal, promoDiscount + voucherDiscount);
    return { discountAmount: totalDiscount, appliedPromoName: promoLabel };
  }, [currentDraft.selectedPromoId, currentDraft.appliedVoucherCode, promotions, vouchers, localSubtotal]);

  // ───── Xem trước từ backend (API thật) ─────
  // Giỏ gửi backend chỉ gồm mã sách + số lượng; giá, khuyến mãi theo phạm vi, voucher do backend tính.
  const cartSignature = JSON.stringify({
    items: currentDraft.items.map((i) => ({ bookId: i.bookId, quantity: i.quantity })),
    customerId: currentDraft.customerId || null,
    promotionId: currentDraft.selectedPromoId || undefined,
    voucherCode: currentDraft.appliedVoucherCode || undefined,
    paymentMethod: currentDraft.paymentMethod,
    amountPaid:
      currentDraft.paymentMethod === "CASH" && currentDraft.amountGiven !== ""
        ? Number(currentDraft.amountGiven)
        : undefined,
  } satisfies CartRequest);

  const [previewState, setPreviewState] = useState<{
    signature: string;
    data?: InvoicePreview;
    error?: string;
  } | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0); // tăng để buộc tính lại (vd sau khi lập hóa đơn lỗi)
  const previewSeq = useRef(0);

  useEffect(() => {
    if (!realSales) return;
    const cart = JSON.parse(cartSignature) as CartRequest;
    if (cart.items.length === 0) return;
    const seq = ++previewSeq.current;
    // Đợi người dùng ngừng thao tác rồi mới gọi; response của yêu cầu cũ (seq cũ) bị bỏ qua.
    const timer = setTimeout(() => {
      salesService
        .previewInvoice(cart)
        .then((data) => {
          if (seq === previewSeq.current) setPreviewState({ signature: cartSignature, data });
        })
        .catch((err) => {
          if (seq === previewSeq.current) {
            setPreviewState({
              signature: cartSignature,
              error: err instanceof Error ? err.message : "Không tính được tổng tiền.",
            });
          }
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [realSales, cartSignature, previewNonce]);

  // Chỉ tin preview tính cho đúng giỏ hàng đang hiển thị.
  const preview = previewState?.signature === cartSignature ? previewState.data : undefined;
  const previewError = previewState?.signature === cartSignature ? previewState.error : undefined;
  const previewPending = realSales && currentDraft.items.length > 0 && !preview && !previewError;

  const subtotal = realSales ? (preview?.subtotal ?? localSubtotal) : localSubtotal;
  const discountAmount = realSales ? (preview?.discountAmount ?? 0) : localDiscount.discountAmount;
  const appliedPromoName = realSales
    ? preview?.promotion?.applied
      ? preview.promotion.name
      : ""
    : localDiscount.appliedPromoName;

  const totalPayable = Math.max(0, subtotal - discountAmount);
  const numericGiven = Number(currentDraft.amountGiven) || totalPayable;
  const changeAmount =
    currentDraft.paymentMethod === "CASH" ? Math.max(0, numericGiven - totalPayable) : 0;
  const canCheckout =
    currentDraft.items.length > 0 && !submitting && !currentDraft.pendingCheckout && (!realSales || preview?.valid === true);

  const handleApplyVoucher = () => {
    const code = currentDraft.voucherInput.trim().toUpperCase();
    if (!code) return;
    if (realSales) {
      // Backend kiểm tra mã (hạn, lượt, đơn tối thiểu) trong preview; lý do hiển thị dưới tổng tiền.
      updateCurrentDraft((d) => ({ ...d, appliedVoucherCode: code, voucherInput: "" }));
      return;
    }
    const found = vouchers.find((v) => v.code.toUpperCase() === code);
    if (!found) {
      showToast("Mã giảm giá không tồn tại hoặc đã hết lượt sử dụng.", "error");
      return;
    }
    if (localSubtotal < found.minOrderValue) {
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
    if (submitting || drafts.find((d) => d.id === id)?.pendingCheckout) {
      showToast("Hãy khôi phục kết quả đơn đã gửi trước khi đóng đơn.", "warning");
      return;
    }
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
    let created;
    try {
      created = await salesService.saveCustomer({
        fullName: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
        email: "",
        address: "",
        tier: "STANDARD",
      });
    } catch (err) {
      // vd SĐT sai định dạng hoặc đã đăng ký
      showToast(err instanceof Error ? err.message : "Không thêm được khách hàng.", "error");
      return;
    }
    const updatedCustomers = await salesService.getCustomers();
    setCustomers(updatedCustomers);
    updateCurrentDraft((d) => ({ ...d, customerId: created.id }));
    setNewCustomerName("");
    setNewCustomerPhone("");
    setQuickCustomerOpen(false);
    showToast(`Đã thêm khách hàng ${created.fullName}`);
  };

  const handleCheckout = async () => {
    if (submitting) return;
    const pending = currentDraft.pendingCheckout;
    if (!pending) {
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
      if (realSales && !preview?.valid) {
        showToast(preview?.messages.join(" ") || "Đang tính tổng tiền, vui lòng chờ giây lát.", "warning");
        return;
      }
    }

    const selectedCus = customers.find((c) => c.id === currentDraft.customerId);
    const draftId = currentDraft.id;

    const payload = pending ?? {
        customerId: selectedCus?.id ?? null,
        customerName: selectedCus?.fullName ?? "Khách lẻ vãng lai",
        customerPhone: selectedCus?.phone ?? "—",
        cashierId: user?.id ?? "USR-02", // API thật bỏ qua – người lập lấy từ phiên đăng nhập
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
        requestKey: currentDraft.requestKey,
        expectedTotal: realSales ? preview?.totalAmount : undefined,
      };
    setSubmitting(true);
    let invoice: Invoice;
    try {
      invoice = await salesService.createInvoice(payload);
    } catch (err) {
      // HTTP 4xx xác nhận bị từ chối; lỗi mạng/5xx vẫn có thể đã ghi hóa đơn.
      const uncertain = !(err instanceof ApiError) || err.status === 0 || err.status >= 500;
      setDrafts((prev) => prev.map((d) => d.id === draftId
        ? { ...d, pendingCheckout: uncertain ? payload : undefined }
        : d));
      // Lỗi (kể cả 409, lỗi mạng): giữ nguyên giỏ hàng và KHÔNG đổi requestKey – thử lại cùng nội dung
      // sẽ nhận đúng hóa đơn gốc nếu lần trước đã ghi; nếu đơn tạm đã thành hóa đơn với nội dung khác,
      // backend trả 409 kèm mã hóa đơn (người dùng mở đơn tạm mới để bán tiếp).
      // Tính lại preview vì giá / tồn / khuyến mãi có thể vừa thay đổi.
      showToast(err instanceof Error ? err.message : "Không lập được hóa đơn.", "error");
      setPreviewState(null);
      setPreviewNonce((n) => n + 1);
      return;
    } finally {
      setSubmitting(false);
    }

    // Thành công mới xóa giỏ và tải lại tồn kho, điểm khách, lượt voucher.
    setCompletedInvoice(invoice);
    setDrafts((prev) => {
      const remaining = prev.filter((d) => d.id !== draftId);
      return remaining.length ? remaining : [createEmptyDraft(1)];
    });
    showToast(`Đã lập hóa đơn ${invoice.code} thành công!`);
    loadData().catch(() => showToast("Đã lập hóa đơn nhưng chưa tải lại được dữ liệu, hãy tải lại trang.", "warning"));
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
                <span className="text-[#2D6A4F]">
                  {previewPending ? "Đang tính…" : formatCurrency(totalPayable)}
                </span>
              </div>
            </div>

            {/* Lý do chưa thanh toán được (từ backend): thiếu tồn, khuyến mãi / voucher không áp dụng… */}
            {realSales && (previewError || (preview && preview.messages.length > 0)) && (
              <ul className="space-y-1 rounded-xl border border-[#FECACA] bg-[#FEE2E2] px-3 py-2 text-xs text-[#B91C1C]">
                {previewError && <li>{previewError}</li>}
                {preview?.messages.map((m) => <li key={m}>{m}</li>)}
              </ul>
            )}

            <button
              type="button"
              onClick={handleCheckout}
              disabled={currentDraft.pendingCheckout ? submitting : !canCheckout}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D6A4F] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#23533D] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {submitting ? "Đang xử lý…" : currentDraft.pendingCheckout ? "Khôi phục kết quả đơn đã gửi" : "Lập hóa đơn & Thanh toán"}
            </button>
            {currentDraft.pendingCheckout && (
              <p role="status" className="text-xs text-amber-700">
                Chưa rõ kết quả lần gửi trước. Khôi phục bằng đúng nội dung và khóa đã gửi, kể cả khi preview hết tồn/hết lượt.
                Sau khi có kết quả, bạn có thể sửa giỏ hoặc mở đơn mới.
              </p>
            )}
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
              onClick={() => completedInvoice && printInvoice(completedInvoice)}
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
              <div className="text-base font-bold text-zinc-900">{BRAND_CONFIG.name}</div>
              <div className="text-zinc-500">
                {BRAND_CONFIG.store.name} – {BRAND_CONFIG.store.address}
              </div>
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

      {/* Bản in hóa đơn vừa lập (chỉ hiện khi in) */}
      <InvoiceReceipt invoice={completedInvoice} />
    </div>
  );
}
