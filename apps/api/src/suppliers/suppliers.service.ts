import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { NhaCungCap } from '@prisma/client';
import { nextSequentialCode } from '../common/codes.js';
import { formatDateOnly } from '../common/transforms.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SupplierDto } from './dto/supplier.dto.js';

/** Công nợ của một NCC, suy ra từ các phiếu nhập. */
interface SupplierDebt {
  totalImportAmount: number;
  currentDebt: number;
  /** Hạn thanh toán sớm nhất trong các phiếu còn nợ. */
  dueDate: Date | null;
}

const NO_DEBT: SupplierDebt = { totalImportAmount: 0, currentDebt: 0, dueDate: null };

/**
 * Quản lý nhà cung cấp (đặc tả QLNCC).
 * - Tổng nhập, công nợ, hạn thanh toán: tính từ phiếu nhập (không lưu cột tổng công nợ).
 * - Không có chức năng xóa: ngừng hợp tác = trạng thái INACTIVE, lịch sử nhập & công nợ giữ nguyên.
 */
@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const suppliers = await this.prisma.nhaCungCap.findMany({ orderBy: { maNCC: 'asc' } });
    const debts = await this.loadDebts();
    return suppliers.map((s) => toSupplier(s, debts.get(s.maNCC)));
  }

  async create(dto: SupplierDto) {
    await this.ensureUnique(dto);
    const existing = await this.prisma.nhaCungCap.findMany({ select: { maNCC: true } });
    const created = await this.prisma.nhaCungCap.create({
      data: { maNCC: nextSequentialCode('NCC', existing.map((s) => s.maNCC)), ...supplierData(dto) },
    });
    return toSupplier(created);
  }

  async update(id: string, dto: SupplierDto) {
    if (!(await this.prisma.nhaCungCap.findUnique({ where: { maNCC: id } }))) {
      throw new NotFoundException(`Không tìm thấy nhà cung cấp "${id}".`);
    }
    await this.ensureUnique(dto, id);
    const updated = await this.prisma.nhaCungCap.update({ where: { maNCC: id }, data: supplierData(dto) });
    return toSupplier(updated, (await this.loadDebts(id)).get(id));
  }

  // ───────────── Hàm hỗ trợ ─────────────

  /** Số điện thoại (ràng buộc DB) và mã số thuế (nếu có) không trùng NCC khác. */
  private async ensureUnique(dto: SupplierDto, exceptId?: string) {
    const notSelf = exceptId ? { maNCC: { not: exceptId } } : {};
    const samePhone = await this.prisma.nhaCungCap.findFirst({ where: { soDienThoai: dto.phone, ...notSelf } });
    if (samePhone) {
      throw new ConflictException(`Số điện thoại đã được dùng cho nhà cung cấp ${samePhone.maNCC} – ${samePhone.tenNCC}.`);
    }
    if (dto.taxCode) {
      const sameTax = await this.prisma.nhaCungCap.findFirst({ where: { maSoThue: dto.taxCode, ...notSelf } });
      if (sameTax) {
        throw new ConflictException(`Mã số thuế đã được dùng cho nhà cung cấp ${sameTax.maNCC} – ${sameTax.tenNCC}.`);
      }
    }
  }

  private async loadDebts(maNCC?: string): Promise<Map<string, SupplierDebt>> {
    const orders = await this.prisma.phieuNhap.findMany({
      where: maNCC ? { maNCC } : {},
      select: { maNCC: true, tongTien: true, daThanhToan: true, hanThanhToan: true },
    });
    const debts = new Map<string, SupplierDebt>();
    for (const order of orders) {
      const debt = debts.get(order.maNCC) ?? { ...NO_DEBT };
      const remaining = Number(order.tongTien) - Number(order.daThanhToan);
      debt.totalImportAmount += Number(order.tongTien);
      debt.currentDebt += remaining;
      if (remaining > 0 && order.hanThanhToan && (!debt.dueDate || order.hanThanhToan < debt.dueDate)) {
        debt.dueDate = order.hanThanhToan;
      }
      debts.set(order.maNCC, debt);
    }
    return debts;
  }
}

function supplierData(dto: SupplierDto) {
  return {
    tenNCC: dto.name,
    maSoThue: dto.taxCode ?? null,
    nguoiLienHe: dto.contactPerson ?? null,
    soDienThoai: dto.phone,
    email: dto.email ?? null,
    diaChi: dto.address ?? null,
    trangThai: dto.status ?? 'ACTIVE',
  };
}

/** Chuyển NCC (DB) sang `Supplier` của FE. */
function toSupplier(row: NhaCungCap, debt: SupplierDebt = NO_DEBT) {
  return {
    id: row.maNCC,
    code: row.maNCC,
    name: row.tenNCC,
    taxCode: row.maSoThue ?? '',
    contactPerson: row.nguoiLienHe ?? '',
    phone: row.soDienThoai,
    email: row.email ?? '',
    address: row.diaChi ?? '',
    totalImportAmount: debt.totalImportAmount,
    currentDebt: debt.currentDebt,
    dueDate: debt.dueDate ? formatDateOnly(debt.dueDate) : null,
    status: row.trangThai,
  };
}
