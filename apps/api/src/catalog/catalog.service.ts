import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { nextSequentialCode } from '../common/codes.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthorDto, CategoryDto, PublisherDto } from './dto/catalog.dto.js';

/** Đếm số sách để trả `bookCount` cho FE. */
const withBookCount = { _count: { select: { sachs: true } } } as const;

/**
 * Quản lý danh mục sách: Thể loại, Tác giả, Nhà xuất bản (đặc tả QLDMS).
 * Mã (id) là khóa chính – không đổi sau khi tạo.
 * Không xóa được mục đang có sách tham chiếu (đặc tả: "Xóa thể loại đang chứa sách → từ chối").
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────── Thể loại ─────────────

  async listCategories() {
    const rows = await this.prisma.theLoai.findMany({ include: withBookCount, orderBy: { maTheLoai: 'asc' } });
    return rows.map(toCategory);
  }

  async createCategory(dto: CategoryDto) {
    if (!dto.code) throw new BadRequestException('Vui lòng nhập mã thể loại.');
    if (await this.prisma.theLoai.findUnique({ where: { maTheLoai: dto.code } })) {
      throw new ConflictException(`Mã thể loại "${dto.code}" đã tồn tại.`);
    }
    await this.ensureCategoryNameUnique(dto.name);
    const created = await this.prisma.theLoai.create({
      data: { maTheLoai: dto.code, tenTheLoai: dto.name, moTa: dto.description ?? null },
      include: withBookCount,
    });
    return toCategory(created);
  }

  async updateCategory(id: string, dto: CategoryDto) {
    await this.findCategoryOrThrow(id);
    if (dto.code && dto.code !== id) {
      throw new BadRequestException('Không thể đổi mã thể loại đã tạo.');
    }
    await this.ensureCategoryNameUnique(dto.name, id);
    const updated = await this.prisma.theLoai.update({
      where: { maTheLoai: id },
      data: { tenTheLoai: dto.name, moTa: dto.description ?? null },
      include: withBookCount,
    });
    return toCategory(updated);
  }

  async deleteCategory(id: string) {
    const category = await this.findCategoryOrThrow(id);
    const bookCount = category._count.sachs;
    if (bookCount > 0) {
      throw new ConflictException(
        `Không thể xóa thể loại đang có ${bookCount} đầu sách. Hãy chuyển các sách sang thể loại khác trước.`,
      );
    }
    const promotionCount = await this.prisma.chuongTrinhKhuyenMai.count({ where: { maTheLoai: id } });
    if (promotionCount > 0) {
      throw new ConflictException(
        `Không thể xóa thể loại đang được dùng trong ${promotionCount} chương trình khuyến mãi.`,
      );
    }
    await this.prisma.theLoai.delete({ where: { maTheLoai: id } });
    return { message: 'Đã xóa thể loại.' };
  }

  private async findCategoryOrThrow(id: string) {
    const category = await this.prisma.theLoai.findUnique({ where: { maTheLoai: id }, include: withBookCount });
    if (!category) throw new NotFoundException(`Không tìm thấy thể loại "${id}".`);
    return category;
  }

  private async ensureCategoryNameUnique(name: string, exceptId?: string) {
    const duplicate = await this.prisma.theLoai.findFirst({
      where: {
        tenTheLoai: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { maTheLoai: { not: exceptId } } : {}),
      },
    });
    if (duplicate) throw new ConflictException(`Tên thể loại "${name}" đã tồn tại.`);
  }

  // ───────────── Tác giả ─────────────

  async listAuthors() {
    const rows = await this.prisma.tacGia.findMany({ include: withBookCount, orderBy: { maTacGia: 'asc' } });
    return rows.map(toAuthor);
  }

  async createAuthor(dto: AuthorDto) {
    const existing = await this.prisma.tacGia.findMany({ select: { maTacGia: true } });
    const created = await this.prisma.tacGia.create({
      data: {
        maTacGia: nextSequentialCode('TG', existing.map((a) => a.maTacGia)),
        ...authorData(dto),
      },
      include: withBookCount,
    });
    return toAuthor(created);
  }

  async updateAuthor(id: string, dto: AuthorDto) {
    await this.findAuthorOrThrow(id);
    const updated = await this.prisma.tacGia.update({
      where: { maTacGia: id },
      data: authorData(dto),
      include: withBookCount,
    });
    return toAuthor(updated);
  }

  async deleteAuthor(id: string) {
    const author = await this.findAuthorOrThrow(id);
    if (author._count.sachs > 0) {
      throw new ConflictException(`Không thể xóa tác giả đang có ${author._count.sachs} đầu sách.`);
    }
    await this.prisma.tacGia.delete({ where: { maTacGia: id } });
    return { message: 'Đã xóa tác giả.' };
  }

  private async findAuthorOrThrow(id: string) {
    const author = await this.prisma.tacGia.findUnique({ where: { maTacGia: id }, include: withBookCount });
    if (!author) throw new NotFoundException(`Không tìm thấy tác giả "${id}".`);
    return author;
  }

  // ───────────── Nhà xuất bản ─────────────

  async listPublishers() {
    const rows = await this.prisma.nhaXuatBan.findMany({ include: withBookCount, orderBy: { maNXB: 'asc' } });
    return rows.map(toPublisher);
  }

  async createPublisher(dto: PublisherDto) {
    const existing = await this.prisma.nhaXuatBan.findMany({ select: { maNXB: true } });
    const created = await this.prisma.nhaXuatBan.create({
      data: { maNXB: nextSequentialCode('NXB', existing.map((p) => p.maNXB)), ...publisherData(dto) },
      include: withBookCount,
    });
    return toPublisher(created);
  }

  async updatePublisher(id: string, dto: PublisherDto) {
    await this.findPublisherOrThrow(id);
    const updated = await this.prisma.nhaXuatBan.update({
      where: { maNXB: id },
      data: publisherData(dto),
      include: withBookCount,
    });
    return toPublisher(updated);
  }

  async deletePublisher(id: string) {
    const publisher = await this.findPublisherOrThrow(id);
    if (publisher._count.sachs > 0) {
      throw new ConflictException(`Không thể xóa nhà xuất bản đang có ${publisher._count.sachs} đầu sách.`);
    }
    await this.prisma.nhaXuatBan.delete({ where: { maNXB: id } });
    return { message: 'Đã xóa nhà xuất bản.' };
  }

  private async findPublisherOrThrow(id: string) {
    const publisher = await this.prisma.nhaXuatBan.findUnique({ where: { maNXB: id }, include: withBookCount });
    if (!publisher) throw new NotFoundException(`Không tìm thấy nhà xuất bản "${id}".`);
    return publisher;
  }
}

// ───────────── Chuyển đổi DTO ⇄ DB ⇄ contract FE ─────────────

type Counted = { _count: { sachs: number } };

const authorData = (dto: AuthorDto) => ({
  tenTacGia: dto.name,
  quocTich: dto.nationality ?? null,
  tieuSu: dto.bio ?? null,
});

const publisherData = (dto: PublisherDto) => ({
  tenNXB: dto.name,
  soDienThoai: dto.phone ?? null,
  email: dto.email ?? null,
  diaChi: dto.address ?? null,
});

function toCategory(row: { maTheLoai: string; tenTheLoai: string; moTa: string | null } & Counted) {
  return {
    id: row.maTheLoai,
    code: row.maTheLoai,
    name: row.tenTheLoai,
    description: row.moTa ?? '',
    bookCount: row._count.sachs,
  };
}

function toAuthor(row: { maTacGia: string; tenTacGia: string; quocTich: string | null; tieuSu: string | null } & Counted) {
  return {
    id: row.maTacGia,
    name: row.tenTacGia,
    nationality: row.quocTich ?? '',
    bio: row.tieuSu ?? '',
    bookCount: row._count.sachs,
  };
}

function toPublisher(
  row: { maNXB: string; tenNXB: string; soDienThoai: string | null; email: string | null; diaChi: string | null } & Counted,
) {
  return {
    id: row.maNXB,
    name: row.tenNXB,
    phone: row.soDienThoai ?? '',
    email: row.email ?? '',
    address: row.diaChi ?? '',
    bookCount: row._count.sachs,
  };
}
