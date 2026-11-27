import type { ChiTietDoiTra, ChiTietHoaDon, HoaDon, KhachHang, NhanVien, PhieuDoiTra, Sach } from '@prisma/client';

export const returnInclude = {
  hoaDon: { include: { khachHang: true, chiTiets: true } },
  nhanVien: true,
  chiTiets: { include: { sachDoi: true }, orderBy: { maSach: 'asc' } },
} as const;

export type ReturnWithRelations = PhieuDoiTra & {
  hoaDon: HoaDon & { khachHang: KhachHang | null; chiTiets: ChiTietHoaDon[] };
  nhanVien: NhanVien;
  chiTiets: (ChiTietDoiTra & { sachDoi: Sach | null })[];
};

/** Phiếu đổi/trả (DB) → `ReturnOrder` của FE. Tên sách trả lấy từ dòng hóa đơn gốc (đã lưu lúc bán). */
export function toReturnOrder(row: ReturnWithRelations) {
  const exchangeLine = row.chiTiets.find((l) => l.maSachDoi);
  const refund = Number(row.tienHoanTra);
  const extraPayment = Number(row.tienKhachBu);
  return {
    id: row.maDoiTra,
    code: row.maDoiTra,
    invoiceId: row.maHoaDon,
    invoiceCode: row.maHoaDon,
    customerId: row.hoaDon.maKH,
    customerName: row.hoaDon.khachHang?.hoTen ?? 'Khách lẻ',
    createdAt: row.ngayDoiTra.toISOString(),
    type: row.hinhThucXuLy,
    reason: row.lyDo,
    returnItems: row.chiTiets.map((line) => ({
      bookId: line.maSach,
      sku: line.maSach,
      title: row.hoaDon.chiTiets.find((i) => i.maSach === line.maSach)?.tenSach ?? line.maSach,
      quantity: line.soLuongTra,
      unitPrice: Number(line.donGiaHoan),
      /** Giá trị thực của phần trả (đồng). */
      value: Number(line.giaTriTra),
      condition: line.tinhTrangSach,
    })),
    exchangeBookId: exchangeLine?.maSachDoi ?? undefined,
    exchangeBookTitle: exchangeLine?.sachDoi?.tenSach ?? undefined,
    exchangeQuantity: exchangeLine ? row.chiTiets.reduce((s, l) => s + l.soLuongTra, 0) : undefined,
    // FE: < 0 hoàn khách, > 0 khách bù thêm
    exchangePriceDiff: row.hinhThucXuLy === 'EXCHANGE' ? extraPayment - refund : 0,
    refundAmount: refund,
    extraPayment,
    status: 'COMPLETED' as const,
    handledBy: row.nhanVien.hoTen,
  };
}
