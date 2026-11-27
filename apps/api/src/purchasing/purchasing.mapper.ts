import type {
  ChiTietPhieuNhap,
  NhaCungCap,
  NhanVien,
  PhieuNhap,
  PhieuThanhToanNCC,
  Sach,
} from '@prisma/client';
import { formatDateOnly } from '../common/transforms.js';
import { debtStatus } from './debt-status.js';

export const purchaseOrderInclude = {
  nhaCungCap: true,
  nhanVien: true,
  chiTiets: { include: { sach: true }, orderBy: { maSach: 'asc' } },
} as const;

export type PurchaseOrderWithRelations = PhieuNhap & {
  nhaCungCap: NhaCungCap;
  nhanVien: NhanVien;
  chiTiets: (ChiTietPhieuNhap & { sach: Sach })[];
};

export const paymentInclude = {
  nhanVien: true,
  phieuNhap: { include: { nhaCungCap: true } },
} as const;

export type PaymentWithRelations = PhieuThanhToanNCC & {
  nhanVien: NhanVien;
  phieuNhap: PhieuNhap & { nhaCungCap: NhaCungCap };
};

/** Phiếu nhập (DB) → `PurchaseOrder` của FE. Công nợ & trạng thái suy ra từ tổng / đã trả / hạn. */
export function toPurchaseOrder(row: PurchaseOrderWithRelations, today: string) {
  const total = Number(row.tongTien);
  const paid = Number(row.daThanhToan);
  const dueDate = row.hanThanhToan ? formatDateOnly(row.hanThanhToan) : null;
  return {
    id: row.maPhieuNhap,
    code: row.maPhieuNhap,
    supplierId: row.maNCC,
    supplierName: row.nhaCungCap.tenNCC,
    createdAt: row.ngayNhap.toISOString(),
    createdBy: row.nhanVien.hoTen,
    items: row.chiTiets.map((line) => ({
      bookId: line.maSach,
      sku: line.maSach,
      title: line.sach.tenSach,
      quantity: line.soLuongNhap,
      importPrice: Number(line.donGiaNhap),
      subtotal: line.soLuongNhap * Number(line.donGiaNhap),
    })),
    totalAmount: total,
    paidAmount: paid,
    debtAmount: total - paid,
    dueDate,
    debtStatus: debtStatus(total, paid, dueDate, today),
    note: row.ghiChu ?? undefined,
  };
}

/** Phiếu chi (DB) → `SupplierPayment` của FE. NCC suy ra từ phiếu nhập. */
export function toSupplierPayment(row: PaymentWithRelations) {
  return {
    id: row.maThanhToanNCC,
    code: row.maThanhToanNCC,
    supplierId: row.phieuNhap.maNCC,
    supplierName: row.phieuNhap.nhaCungCap.tenNCC,
    purchaseOrderId: row.maPhieuNhap,
    purchaseOrderCode: row.maPhieuNhap,
    paidAt: row.ngayThanhToan.toISOString(),
    amount: Number(row.soTienThanhToan),
    paymentMethod: row.phuongThuc,
    recordedBy: row.nhanVien.hoTen,
    note: row.ghiChu ?? undefined,
  };
}
