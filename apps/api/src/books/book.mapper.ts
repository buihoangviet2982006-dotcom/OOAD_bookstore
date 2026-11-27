import type { NhaXuatBan, Sach, TacGia, TheLoai, TrangThaiSach } from '@prisma/client';

export type BookWithRelations = Sach & { theLoai: TheLoai; tacGia: TacGia; nhaXuatBan: NhaXuatBan };

export const bookInclude = { theLoai: true, tacGia: true, nhaXuatBan: true } as const;

/**
 * Trạng thái hiển thị cho FE:
 * - DISCONTINUED: giữ nguyên dù còn tồn hay hết (không bán được).
 * - Đang kinh doanh mà tồn = 0 → OUT_OF_STOCK (suy ra, không lưu).
 */
export function bookStatus(trangThai: TrangThaiSach, soLuongTon: number) {
  if (trangThai === 'DISCONTINUED') return 'DISCONTINUED' as const;
  return soLuongTon > 0 ? ('ACTIVE' as const) : ('OUT_OF_STOCK' as const);
}

/** Chuyển sách (DB) sang `Book` của FE (apps/web/src/types). */
export function toBook(row: BookWithRelations) {
  return {
    id: row.maSach,
    sku: row.maSach,
    isbn: row.isbn,
    title: row.tenSach,
    categoryId: row.maTheLoai,
    categoryName: row.theLoai.tenTheLoai,
    authorId: row.maTacGia,
    authorName: row.tacGia.tenTacGia,
    publisherId: row.maNXB,
    publisherName: row.nhaXuatBan.tenNXB,
    publishYear: row.namXuatBan ?? 0,
    importPrice: Number(row.giaNhap),
    sellPrice: Number(row.giaBan),
    stock: row.soLuongTon,
    minStock: row.mucTonToiThieu,
    shelfLocation: row.viTriKe ?? '',
    status: bookStatus(row.trangThai, row.soLuongTon),
    description: row.moTa ?? '',
  };
}
