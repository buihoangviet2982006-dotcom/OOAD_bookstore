import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { KhachHang } from '@prisma/client';
import { nextSequentialCode } from '../common/codes.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CustomerDto } from './dto/customer.dto.js';
import { tierFor } from './loyalty.js';

/** Chỉ số tổng hợp của một khách hàng, tính từ hóa đơn và phiếu đổi/trả. */
interface CustomerStats {
  totalSpent: number;
  orderCount: number;
  lastPurchaseDate: Date | null;
}

const EMPTY_STATS: CustomerStats = { totalSpent: 0, orderCount: 0, lastPurchaseDate: null };

/**
 * Quản lý khách hàng (đặc tả QLKH).
 * - Chi tiêu, số đơn, lần mua cuối, hạng: suy ra từ dữ liệu giao dịch, không sửa qua CRUD.
 * - Điểm tích lũy: cột diem_tich_luy, chỉ nghiệp vụ bán hàng / đổi trả cập nhật.
 * - Khách đã có hóa đơn: chặn xóa để giữ lịch sử (quyết định review Chặng 4).
 */
@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const customers = await this.prisma.khachHang.findMany({ orderBy: { maKH: 'asc' } });
    const stats = await this.loadStats();
    return customers.map((c) => toCustomer(c, stats.get(c.maKH)));
  }

  async create(dto: CustomerDto) {
    await this.ensurePhoneUnique(dto.phone);
    const existing = await this.prisma.khachHang.findMany({ select: { maKH: true } });
    const created = await this.prisma.khachHang.create({
      data: { maKH: nextSequentialCode('KH', existing.map((c) => c.maKH)), ...customerData(dto) },
    });
    return toCustomer(created);
  }

  async update(id: string, dto: CustomerDto) {
    await this.findOrThrow(id);
    await this.ensurePhoneUnique(dto.phone, id);
    const updated = await this.prisma.khachHang.update({ where: { maKH: id }, data: customerData(dto) });
    return toCustomer(updated, (await this.loadStats(id)).get(id));
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    const invoiceCount = await this.prisma.hoaDon.count({ where: { maKH: id } });
    if (invoiceCount > 0) {
      throw new ConflictException(
        `Khách hàng đã có ${invoiceCount} hóa đơn nên không thể xóa (giữ lịch sử giao dịch).`,
      );
    }
    await this.prisma.khachHang.delete({ where: { maKH: id } });
    return { message: 'Đã xóa khách hàng.' };
  }

  // ───────────── Hàm hỗ trợ ─────────────

  private async findOrThrow(id: string) {
    const customer = await this.prisma.khachHang.findUnique({ where: { maKH: id } });
    if (!customer) throw new NotFoundException(`Không tìm thấy khách hàng "${id}".`);
    return customer;
  }

  private async ensurePhoneUnique(phone: string, exceptId?: string) {
    const duplicate = await this.prisma.khachHang.findFirst({
      where: { soDienThoai: phone, ...(exceptId ? { maKH: { not: exceptId } } : {}) },
      select: { maKH: true, hoTen: true },
    });
    if (duplicate) {
      throw new ConflictException(`Số điện thoại đã được đăng ký cho khách hàng ${duplicate.maKH} – ${duplicate.hoTen}.`);
    }
  }

  /**
   * Tổng hợp chỉ số theo khách hàng:
   * chi tiêu = Σ thanh toán cuối các hóa đơn + Σ tiền khách bù − Σ tiền hoàn (phiếu đổi/trả).
   * Không dùng tiền khách đưa.
   */
  private async loadStats(maKH?: string): Promise<Map<string, CustomerStats>> {
    const customerFilter = maKH ? { equals: maKH } : { not: null };
    const [invoices, adjustments] = await Promise.all([
      this.prisma.hoaDon.findMany({
        where: { maKH: customerFilter },
        select: { maKH: true, thanhToanCuoi: true, ngayLap: true },
      }),
      this.prisma.phieuDoiTra.findMany({
        where: { hoaDon: { maKH: customerFilter } },
        select: { tienKhachBu: true, tienHoanTra: true, hoaDon: { select: { maKH: true } } },
      }),
    ]);

    const stats = new Map<string, CustomerStats>();
    const statsOf = (key: string) => {
      if (!stats.has(key)) stats.set(key, { ...EMPTY_STATS });
      return stats.get(key)!;
    };
    for (const invoice of invoices) {
      const s = statsOf(invoice.maKH!);
      s.totalSpent += Number(invoice.thanhToanCuoi);
      s.orderCount += 1;
      if (!s.lastPurchaseDate || invoice.ngayLap > s.lastPurchaseDate) s.lastPurchaseDate = invoice.ngayLap;
    }
    for (const adj of adjustments) {
      statsOf(adj.hoaDon.maKH!).totalSpent += Number(adj.tienKhachBu) - Number(adj.tienHoanTra);
    }
    return stats;
  }
}

function customerData(dto: CustomerDto) {
  return {
    hoTen: dto.fullName,
    soDienThoai: dto.phone,
    email: dto.email ?? null,
    diaChi: dto.address ?? null,
    ghiChu: dto.notes ?? null,
  };
}

/** Chuyển khách hàng (DB) sang `Customer` của FE. */
function toCustomer(row: KhachHang, stats: CustomerStats = EMPTY_STATS) {
  return {
    id: row.maKH,
    code: row.maKH,
    fullName: row.hoTen,
    phone: row.soDienThoai,
    email: row.email ?? '',
    address: row.diaChi ?? '',
    tier: tierFor(stats.totalSpent),
    points: row.diemTichLuy,
    totalSpent: stats.totalSpent,
    orderCount: stats.orderCount,
    lastPurchaseDate: stats.lastPurchaseDate?.toISOString() ?? null,
    createdAt: row.ngayTao.toISOString(),
    notes: row.ghiChu ?? '',
  };
}
