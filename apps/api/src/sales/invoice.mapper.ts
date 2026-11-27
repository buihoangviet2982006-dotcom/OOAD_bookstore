import type {
  ChiTietDoiTra,
  ChiTietHoaDon,
  ChuongTrinhKhuyenMai,
  HoaDon,
  KhachHang,
  NhanVien,
  PhieuDoiTra,
  ThanhToan,
} from '@prisma/client';
import { returnDeadline } from '../returns/refund.js';

export const invoiceInclude = {
  khachHang: true,
  nhanVien: true,
  ctkm: true,
  chiTiets: { orderBy: { maSach: 'asc' } },
  thanhToans: true,
  doiTras: { include: { chiTiets: true } },
} as const;

export type InvoiceWithRelations = HoaDon & {
  khachHang: KhachHang | null;
  nhanVien: NhanVien;
  ctkm: ChuongTrinhKhuyenMai | null;
  chiTiets: ChiTietHoaDon[];
  thanhToans: ThanhToan[];
  doiTras: (PhieuDoiTra & { chiTiets: ChiTietDoiTra[] })[];
};

/**
 * Hóa đơn (DB) → `Invoice` của FE. Mọi số tiền, giá, tên sách đọc từ dữ liệu đã lưu trên hóa đơn
 * (không đọc lại bảng sách) → hóa đơn cũ không đổi khi sửa danh mục.
 */
export function toInvoice(row: InvoiceWithRelations) {
  const payment = row.thanhToans[0];
  const paid = payment ? Number(payment.soTien) : Number(row.thanhToanCuoi);
  const given = payment?.tienKhachDua !== null && payment?.tienKhachDua !== undefined ? Number(payment.tienKhachDua) : null;
  return {
    id: row.maHoaDon,
    code: row.maHoaDon,
    createdAt: row.ngayLap.toISOString(),
    customerId: row.maKH,
    customerName: row.khachHang?.hoTen ?? 'Khách lẻ',
    customerPhone: row.khachHang?.soDienThoai ?? '—',
    cashierId: row.maNV,
    cashierName: row.nhanVien.hoTen,
    items: row.chiTiets.map((line) => ({
      bookId: line.maSach,
      sku: line.maSach,
      title: line.tenSach,
      quantity: line.soLuongBan,
      unitPrice: Number(line.donGiaBan),
      subtotal: line.soLuongBan * Number(line.donGiaBan),
      /** Chiết khấu hóa đơn đã phân bổ cho dòng (dùng tính giá hoàn khi đổi/trả). */
      discount: Number(line.giamGia),
      /** Số cuốn đã đổi/trả qua các phiếu. */
      returnedQuantity: row.doiTras
        .flatMap((r) => r.chiTiets)
        .filter((r) => r.maSach === line.maSach)
        .reduce((s, r) => s + r.soLuongTra, 0),
    })),
    /** Hạn đổi/trả (YYYY-MM-DD, hết ngày theo giờ Việt Nam). */
    returnDeadline: returnDeadline(row.ngayLap),
    subtotal: Number(row.tongTienHang),
    promotionId: row.maCTKM ?? undefined,
    promotionName: row.ctkm?.tenCTKM ?? undefined,
    voucherCode: row.maCode ?? undefined,
    discountAmount: Number(row.tienGiamCTKM) + Number(row.tienGiamVoucher),
    totalAmount: Number(row.thanhToanCuoi),
    amountPaid: given ?? paid,
    changeAmount: given !== null ? given - paid : 0,
    paymentMethod: payment?.phuongThuc ?? 'CASH',
    status: row.trangThai,
    note: row.ghiChu ?? undefined,
  };
}
