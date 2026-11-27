"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BRAND_CONFIG } from "@/config/brand";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { Invoice, PaymentMethod } from "@/types";

const PAYMENT_TEXT: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  TRANSFER: "Chuyển khoản",
  CARD: "Thẻ",
};

/** Tên tài liệu in = tên tệp gợi ý khi "Lưu dưới dạng PDF", vd nha-sach-be-bi_HD-2611-1042. */
export const receiptTitle = (invoice: Invoice) => `${BRAND_CONFIG.fileSlug}_${invoice.code}`;

/**
 * In đúng một hóa đơn: bật chế độ in hóa đơn (CSS ẩn toàn bộ trang, chỉ hiện `.print-receipt`),
 * đặt tiêu đề trang = tên tệp gợi ý, khôi phục cả hai khi hộp thoại in đóng (in hoặc hủy).
 */
export function printInvoice(invoice: Invoice): void {
  if (typeof window === "undefined") return;
  const previousTitle = document.title;
  const restore = () => {
    document.title = previousTitle;
    document.body.classList.remove("printing-receipt");
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  document.title = receiptTitle(invoice);
  document.body.classList.add("printing-receipt");
  window.print();
}

/**
 * Bản hóa đơn chỉ dùng khi in – gắn thẳng vào <body> (ngoài Drawer/Modal vốn bị ẩn khi in).
 * Trên màn hình luôn ẩn.
 */
export function InvoiceReceipt({ invoice }: { invoice: Invoice | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    void Promise.resolve().then(() => setMounted(true));
  }, []);
  if (!mounted || !invoice) return null;

  return createPortal(
    <div className="print-receipt mx-auto max-w-[80mm] text-[12px] leading-snug text-black">
      <div className="border-b border-dashed border-black pb-2 text-center">
        <div className="text-base font-bold">{BRAND_CONFIG.name}</div>
        <div>{BRAND_CONFIG.store.name}</div>
        <div>{BRAND_CONFIG.store.address}</div>
        <div className="mt-2 font-bold">HÓA ĐƠN BÁN HÀNG</div>
        <div>Mã HĐ: {invoice.code}</div>
        <div>{formatDateTime(invoice.createdAt)}</div>
      </div>

      <div className="border-b border-dashed border-black py-2">
        <div>
          Khách hàng: {invoice.customerName}
          {invoice.customerId ? ` – ${invoice.customerPhone}` : ""}
        </div>
        <div>Thu ngân: {invoice.cashierName}</div>
      </div>

      <table className="w-full border-b border-dashed border-black">
        <tbody>
          {invoice.items.map((it) => (
            <tr key={it.bookId} className="align-top">
              <td className="py-1 pr-2">
                {it.title}
                <div>
                  {it.quantity} × {formatCurrency(it.unitPrice)}
                </div>
              </td>
              <td className="py-1 text-right whitespace-nowrap">{formatCurrency(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-0.5 py-2">
        <Row label="Tổng tiền hàng" value={formatCurrency(invoice.subtotal)} />
        {invoice.promotionName && <Row label={`Khuyến mãi: ${invoice.promotionName}`} value="" />}
        {invoice.voucherCode && <Row label={`Mã giảm giá: ${invoice.voucherCode}`} value="" />}
        <Row label="Giảm giá" value={`-${formatCurrency(invoice.discountAmount)}`} />
        <Row label="TỔNG THANH TOÁN" value={formatCurrency(invoice.totalAmount)} bold />
        <Row label="Hình thức" value={PAYMENT_TEXT[invoice.paymentMethod]} />
        {invoice.paymentMethod === "CASH" && (
          <>
            <Row label="Khách đưa" value={formatCurrency(invoice.amountPaid)} />
            <Row label="Tiền thừa" value={formatCurrency(invoice.changeAmount)} />
          </>
        )}
      </div>
      <div className="border-t border-dashed border-black pt-2 text-center">Cảm ơn quý khách!</div>
    </div>,
    document.body,
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className="whitespace-nowrap">{value}</span>
    </div>
  );
}
