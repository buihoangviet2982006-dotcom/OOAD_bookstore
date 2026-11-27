import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { NhanVien, Prisma } from '@prisma/client';
import { STORE_BRANCH } from '../auth/auth.constants.js';
import type { CurrentAccount } from '../auth/auth.types.js';
import { nextSequentialCode } from '../common/codes.js';
import { formatDateOnly, toDateOnly } from '../common/transforms.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertAnotherActiveManager, isActiveManager } from '../system/manager-guard.js';
import type { EmployeeDto } from './dto/employee.dto.js';

/**
 * Quản lý nhân viên (đặc tả QLNV) – chỉ Quản lý.
 * - Thôi việc (sửa trạng thái RESIGNED hoặc "xóa" nhân viên có ràng buộc): tài khoản liên quan bị khóa
 *   và tăng phien_ban → token cũ bị từ chối ngay. Quay lại làm việc không tự mở khóa tài khoản.
 * - Bộ phận nhân viên = vai trò tài khoản: đổi bộ phận thì đổi vai trò tài khoản + thu hồi token cũ (cùng transaction).
 * - Không tự đổi bộ phận / tự thôi việc; luôn còn ít nhất một tài khoản Quản lý đang hoạt động.
 * - Nhân viên đã có tài khoản hoặc chứng từ (hóa đơn, phiếu nhập…) không bị xóa vật lý.
 */
@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.nhanVien.findMany({ orderBy: { maNV: 'asc' } });
    return rows.map(toEmployee);
  }

  async create(dto: EmployeeDto) {
    await this.ensureUnique(dto);
    const existing = await this.prisma.nhanVien.findMany({ select: { maNV: true } });
    const created = await this.prisma.nhanVien.create({
      data: { maNV: nextSequentialCode('NV', existing.map((e) => e.maNV)), ...employeeData(dto) },
    });
    return toEmployee(created);
  }

  async update(id: string, dto: EmployeeDto, actor: CurrentAccount) {
    const current = await this.findOrThrow(id);
    if (actor.maNV === id && dto.status === 'RESIGNED') {
      throw new BadRequestException('Không thể tự chuyển chính mình sang thôi việc.');
    }
    if (actor.maNV === id && dto.role !== current.boPhan) {
      throw new BadRequestException('Không thể tự đổi bộ phận (vai trò) của chính mình.');
    }
    await this.ensureUnique(dto, id);

    const resigning = dto.status === 'RESIGNED' && current.trangThai !== 'RESIGNED';
    const roleChanged = dto.role !== current.boPhan;
    const account = current.taiKhoan;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (account && isActiveManager(account, current.trangThai) && (resigning || dto.role !== 'MANAGER')) {
        await assertAnotherActiveManager(tx, account.maTaiKhoan);
      }
      const row = await tx.nhanVien.update({ where: { maNV: id }, data: employeeData(dto) });
      // Bộ phận = vai trò tài khoản (đồng bộ Chặng 10); đổi vai trò → thu hồi token cũ.
      if (account && roleChanged) {
        await tx.taiKhoan.update({
          where: { maTaiKhoan: account.maTaiKhoan },
          data: { vaiTro: dto.role, phienBan: { increment: 1 } },
        });
      }
      if (resigning) await revokeAccountAccess(tx, id);
      return row;
    });
    return toEmployee(updated);
  }

  /**
   * "Xóa" nhân viên: chưa có tài khoản và chưa lập chứng từ nào → xóa hẳn;
   * ngược lại → chuyển thôi việc + khóa tài khoản (giữ lịch sử).
   */
  async remove(id: string, actor: CurrentAccount) {
    const current = await this.findOrThrow(id);
    if (actor.maNV === id) throw new BadRequestException('Không thể xóa hồ sơ của chính mình.');

    if ((await this.countReferences(id)) > 0) {
      await this.prisma.$transaction(async (tx) => {
        const account = current.taiKhoan;
        if (account && isActiveManager(account, current.trangThai)) {
          await assertAnotherActiveManager(tx, account.maTaiKhoan);
        }
        await tx.nhanVien.update({ where: { maNV: id }, data: { trangThai: 'RESIGNED' } });
        await revokeAccountAccess(tx, id);
      });
      return {
        action: 'RESIGNED' as const,
        message:
          'Nhân viên đã có tài khoản hoặc chứng từ nên được chuyển sang "Đã thôi việc"; tài khoản liên quan đã bị khóa.',
      };
    }

    await this.prisma.nhanVien.delete({ where: { maNV: id } });
    return { action: 'DELETED' as const, message: 'Đã xóa hồ sơ nhân viên.' };
  }

  // ───────────── Hàm hỗ trợ ─────────────

  private async findOrThrow(id: string) {
    const employee = await this.prisma.nhanVien.findUnique({ where: { maNV: id }, include: { taiKhoan: true } });
    if (!employee) throw new NotFoundException(`Không tìm thấy nhân viên "${id}".`);
    return employee;
  }

  /** SĐT và email nhân viên là duy nhất (ràng buộc DB) – báo lỗi rõ trước khi lưu. */
  private async ensureUnique(dto: EmployeeDto, exceptId?: string) {
    const duplicate = await this.prisma.nhanVien.findFirst({
      where: {
        OR: [{ soDienThoai: dto.phone }, { email: { equals: dto.email, mode: 'insensitive' } }],
        ...(exceptId ? { maNV: { not: exceptId } } : {}),
      },
    });
    if (!duplicate) return;
    const field = duplicate.soDienThoai === dto.phone ? 'Số điện thoại' : 'Email';
    throw new ConflictException(`${field} đã được dùng cho nhân viên ${duplicate.maNV} – ${duplicate.hoTen}.`);
  }

  private async countReferences(maNV: string): Promise<number> {
    const where = { maNV };
    const counts = await Promise.all([
      this.prisma.taiKhoan.count({ where }),
      this.prisma.hoaDon.count({ where }),
      this.prisma.phieuDoiTra.count({ where }),
      this.prisma.phieuNhap.count({ where }),
      this.prisma.phieuThanhToanNCC.count({ where }),
      this.prisma.phieuKiemKe.count({ where }),
      this.prisma.banSaoLuu.count({ where }),
    ]);
    return counts.reduce((sum, n) => sum + n, 0);
  }
}

/** Khóa tài khoản của nhân viên và thu hồi mọi phiên đăng nhập (tăng phien_ban). */
function revokeAccountAccess(tx: Prisma.TransactionClient, maNV: string) {
  return tx.taiKhoan.updateMany({
    where: { maNV },
    data: { trangThai: 'LOCKED', phienBan: { increment: 1 } },
  });
}

function employeeData(dto: EmployeeDto) {
  return {
    hoTen: dto.fullName,
    boPhan: dto.role,
    chucVu: dto.positionTitle,
    soDienThoai: dto.phone,
    email: dto.email.toLowerCase(),
    ngayVaoLam: toDateOnly(dto.joinDate),
    luongCoBan: dto.baseSalary,
    trangThai: dto.status ?? 'WORKING',
    diaChi: dto.address ?? null,
  };
}

/** Chuyển nhân viên (DB) sang `Employee` của FE. */
function toEmployee(row: NhanVien) {
  return {
    id: row.maNV,
    code: row.maNV,
    fullName: row.hoTen,
    role: row.boPhan,
    positionTitle: row.chucVu,
    phone: row.soDienThoai,
    email: row.email,
    branchName: STORE_BRANCH.name,
    joinDate: formatDateOnly(row.ngayVaoLam),
    baseSalary: Number(row.luongCoBan),
    status: row.trangThai,
    address: row.diaChi ?? '',
  };
}
