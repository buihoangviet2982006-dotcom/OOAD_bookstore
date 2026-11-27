import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { bookInclude, toBook } from './book.mapper.js';
import type { BookDto } from './dto/book.dto.js';

/**
 * Quản lý sách (đặc tả QLS).
 * - Mã sách là khóa chính, không đổi sau khi tạo; ISBN không trùng.
 * - Tồn kho KHÔNG sửa qua đây: sách mới có tồn 0, thay đổi qua phiếu nhập / bán / đổi trả / kiểm kê.
 * - Sửa giá chỉ ảnh hưởng giao dịch mới: hóa đơn, phiếu nhập đã lưu giá riêng từng dòng.
 */
@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.sach.findMany({ include: bookInclude, orderBy: { maSach: 'asc' } });
    return rows.map(toBook);
  }

  async get(id: string) {
    return toBook(await this.findOrThrow(id));
  }

  async create(dto: BookDto) {
    if (!dto.sku) throw new BadRequestException('Vui lòng nhập mã sách (SKU).');
    if (await this.prisma.sach.findUnique({ where: { maSach: dto.sku } })) {
      throw new ConflictException(`Mã sách "${dto.sku}" đã tồn tại.`);
    }
    await this.ensureIsbnUnique(dto.isbn);
    await this.ensureReferencesExist(dto);

    const created = await this.prisma.sach.create({
      data: { maSach: dto.sku, soLuongTon: 0, ...bookData(dto) },
      include: bookInclude,
    });
    return toBook(created);
  }

  async update(id: string, dto: BookDto) {
    await this.findOrThrow(id);
    if (dto.sku && dto.sku !== id) {
      throw new BadRequestException('Không thể đổi mã sách đã tạo.');
    }
    await this.ensureIsbnUnique(dto.isbn, id);
    await this.ensureReferencesExist(dto);

    const updated = await this.prisma.sach.update({
      where: { maSach: id },
      data: bookData(dto), // không có soLuongTon
      include: bookInclude,
    });
    return toBook(updated);
  }

  /**
   * Xóa sách (đặc tả QLS – Xóa sách):
   * - Đã phát sinh giao dịch (hóa đơn, đổi/trả, phiếu nhập, kiểm kê) hoặc còn tồn kho
   *   → không xóa vật lý, chuyển "Ngừng kinh doanh" để giữ nguyên lịch sử.
   * - Chưa có giao dịch và tồn = 0 → xóa hẳn.
   */
  async remove(id: string) {
    const book = await this.findOrThrow(id);
    const transactionCount = await this.countTransactions(id);

    if (transactionCount > 0 || book.soLuongTon > 0) {
      await this.prisma.sach.update({ where: { maSach: id }, data: { trangThai: 'DISCONTINUED' } });
      return {
        action: 'DISCONTINUED' as const,
        message: 'Sách đã phát sinh giao dịch hoặc còn tồn kho nên được chuyển sang "Ngừng kinh doanh".',
      };
    }

    await this.prisma.sach.delete({ where: { maSach: id } });
    return { action: 'DELETED' as const, message: 'Đã xóa đầu sách.' };
  }

  // ───────────── Hàm hỗ trợ ─────────────

  private async findOrThrow(id: string) {
    const book = await this.prisma.sach.findUnique({ where: { maSach: id }, include: bookInclude });
    if (!book) throw new NotFoundException(`Không tìm thấy sách "${id}".`);
    return book;
  }

  private async ensureIsbnUnique(isbn: string, exceptId?: string) {
    const duplicate = await this.prisma.sach.findFirst({
      where: { isbn, ...(exceptId ? { maSach: { not: exceptId } } : {}) },
      select: { maSach: true },
    });
    if (duplicate) throw new ConflictException(`ISBN "${isbn}" đã được dùng cho sách ${duplicate.maSach}.`);
  }

  private async ensureReferencesExist(dto: BookDto) {
    const [category, author, publisher] = await Promise.all([
      this.prisma.theLoai.findUnique({ where: { maTheLoai: dto.categoryId } }),
      this.prisma.tacGia.findUnique({ where: { maTacGia: dto.authorId } }),
      this.prisma.nhaXuatBan.findUnique({ where: { maNXB: dto.publisherId } }),
    ]);
    if (!category) throw new BadRequestException(`Thể loại "${dto.categoryId}" không tồn tại.`);
    if (!author) throw new BadRequestException(`Tác giả "${dto.authorId}" không tồn tại.`);
    if (!publisher) throw new BadRequestException(`Nhà xuất bản "${dto.publisherId}" không tồn tại.`);
  }

  private async countTransactions(maSach: string): Promise<number> {
    const counts = await Promise.all([
      this.prisma.chiTietHoaDon.count({ where: { maSach } }),
      this.prisma.chiTietDoiTra.count({ where: { OR: [{ maSach }, { maSachDoi: maSach }] } }),
      this.prisma.chiTietPhieuNhap.count({ where: { maSach } }),
      this.prisma.chiTietKiemKe.count({ where: { maSach } }),
    ]);
    return counts.reduce((sum, n) => sum + n, 0);
  }
}

/** Dữ liệu sách từ DTO (không gồm mã sách và tồn kho). */
function bookData(dto: BookDto) {
  return {
    isbn: dto.isbn,
    tenSach: dto.title,
    maTheLoai: dto.categoryId,
    maTacGia: dto.authorId,
    maNXB: dto.publisherId,
    namXuatBan: dto.publishYear ?? null,
    giaNhap: dto.importPrice,
    giaBan: dto.sellPrice,
    mucTonToiThieu: dto.minStock,
    viTriKe: dto.shelfLocation ?? null,
    moTa: dto.description ?? null,
    // OUT_OF_STOCK chỉ là trạng thái hiển thị → lưu ACTIVE.
    trangThai: dto.status === 'DISCONTINUED' ? ('DISCONTINUED' as const) : ('ACTIVE' as const),
  };
}
