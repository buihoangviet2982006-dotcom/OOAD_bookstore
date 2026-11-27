import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { NhanVien, Prisma, TaiKhoan } from '@prisma/client';
import type { CurrentAccount } from '../auth/auth.types.js';
import { nextSequentialCode } from '../common/codes.js';
import { hashPassword } from '../common/password.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateAccountDto, ResetAccountPasswordDto, UpdateAccountDto } from './dto/account.dto.js';
import { assertAnotherActiveManager, isActiveManager } from './manager-guard.js';

type AccountRow = TaiKhoan & { nhanVien: NhanVien };

/**
 * Quản lý tài khoản (đặc tả QLHT) – chỉ Quản lý.
 * - Tài khoản gắn đúng một nhân viên có sẵn (chưa thôi việc); mỗi nhân viên tối đa một tài khoản.
 * - Vai trò tài khoản và bộ phận nhân viên luôn bằng nhau: đổi một bên thì cập nhật bên kia trong cùng transaction.
 * - Khóa, đổi vai trò, đặt lại mật khẩu → tăng phien_ban: token cũ bị từ chối ở request kế tiếp.
 * - Mở khóa: xóa bộ đếm sai mật khẩu, KHÔNG tăng/khôi phục phien_ban → token cấp trước khi khóa vẫn vô hiệu.
 * - Không tự khóa / tự bỏ quyền Quản lý; luôn còn ít nhất một Quản lý đang hoạt động.
 * - Response không chứa hash mật khẩu, OTP, phien_ban.
 */
@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.taiKhoan.findMany({ include: { nhanVien: true }, orderBy: { maTaiKhoan: 'asc' } });
    return rows.map(toSystemAccount);
  }

  async create(dto: CreateAccountDto) {
    const employee = await this.prisma.nhanVien.findUnique({ where: { maNV: dto.employeeId }, include: { taiKhoan: true } });
    if (!employee) throw new NotFoundException(`Không tìm thấy nhân viên "${dto.employeeId}".`);
    if (employee.trangThai === 'RESIGNED') {
      throw new BadRequestException(`Nhân viên ${employee.maNV} – ${employee.hoTen} đã thôi việc, không thể cấp tài khoản.`);
    }
    if (employee.taiKhoan) {
      throw new ConflictException(`Nhân viên ${employee.maNV} đã có tài khoản "${employee.taiKhoan.tenDangNhap}".`);
    }
    const email = dto.email ?? employee.email.toLowerCase();
    await this.ensureUnique(dto.username, email);

    const ids = await this.prisma.taiKhoan.findMany({ select: { maTaiKhoan: true } });
    const passwordHash = await hashPassword(dto.password);
    const created = await this.prisma.$transaction(async (tx) => {
      // Đồng bộ bộ phận nhân viên theo vai trò được cấp.
      await tx.nhanVien.update({ where: { maNV: employee.maNV }, data: { boPhan: dto.role } });
      return tx.taiKhoan.create({
        data: {
          maTaiKhoan: nextSequentialCode('TK', ids.map((a) => a.maTaiKhoan)),
          tenDangNhap: dto.username,
          emailKhoiPhuc: email,
          matKhauHash: passwordHash,
          vaiTro: dto.role,
          maNV: employee.maNV,
        },
        include: { nhanVien: true },
      });
    });
    return toSystemAccount(created);
  }

  async update(id: string, dto: UpdateAccountDto, actor: CurrentAccount) {
    const account = await this.findOrThrow(id);
    const roleChanged = dto.role !== account.vaiTro;
    if (roleChanged && account.maTaiKhoan === actor.maTaiKhoan) {
      throw new BadRequestException('Không thể tự thay đổi vai trò của chính mình.');
    }
    await this.ensureUnique(dto.username, dto.email, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (roleChanged && isActiveManager(account, account.nhanVien.trangThai)) {
        await assertAnotherActiveManager(tx, id);
      }
      await tx.nhanVien.update({ where: { maNV: account.maNV }, data: { boPhan: dto.role } });
      return tx.taiKhoan.update({
        where: { maTaiKhoan: id },
        data: {
          tenDangNhap: dto.username,
          emailKhoiPhuc: dto.email,
          vaiTro: dto.role,
          ...(roleChanged ? { phienBan: { increment: 1 } } : {}),
        },
        include: { nhanVien: true },
      });
    });
    return toSystemAccount(updated);
  }

  async lock(id: string, actor: CurrentAccount) {
    const account = await this.findOrThrow(id);
    if (account.maTaiKhoan === actor.maTaiKhoan) {
      throw new BadRequestException('Không thể tự khóa tài khoản của chính mình.');
    }
    if (account.trangThai === 'LOCKED') return toSystemAccount(account);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (isActiveManager(account, account.nhanVien.trangThai)) await assertAnotherActiveManager(tx, id);
      return tx.taiKhoan.update({
        where: { maTaiKhoan: id },
        data: { trangThai: 'LOCKED', phienBan: { increment: 1 } },
        include: { nhanVien: true },
      });
    });
    return toSystemAccount(updated);
  }

  async unlock(id: string) {
    const account = await this.findOrThrow(id);
    if (account.nhanVien.trangThai === 'RESIGNED') {
      throw new BadRequestException('Nhân viên đã thôi việc – không mở khóa tài khoản. Cập nhật hồ sơ nhân viên trước.');
    }
    const updated = await this.prisma.taiKhoan.update({
      where: { maTaiKhoan: id },
      data: { trangThai: 'ACTIVE', soLanSaiMatKhau: 0 },
      include: { nhanVien: true },
    });
    return toSystemAccount(updated);
  }

  async resetPassword(id: string, dto: ResetAccountPasswordDto) {
    const account = await this.findOrThrow(id);
    await this.prisma.taiKhoan.update({
      where: { maTaiKhoan: id },
      data: {
        matKhauHash: await hashPassword(dto.newPassword),
        soLanSaiMatKhau: 0,
        otpHash: null,
        otpHetHan: null,
        otpSoLanSai: 0,
        phienBan: { increment: 1 },
      },
    });
    return {
      message: `Đã đặt lại mật khẩu cho ${account.tenDangNhap}. Các phiên đăng nhập cũ của tài khoản này đã kết thúc.`,
    };
  }

  // ───────────── Hàm hỗ trợ ─────────────

  private async findOrThrow(id: string): Promise<AccountRow> {
    const account = await this.prisma.taiKhoan.findUnique({ where: { maTaiKhoan: id }, include: { nhanVien: true } });
    if (!account) throw new NotFoundException(`Không tìm thấy tài khoản "${id}".`);
    return account;
  }

  /** Đăng nhập không phân biệt hoa thường → kiểm tra trùng cũng không phân biệt. */
  private async ensureUnique(username: string, email: string, exceptId?: string) {
    const except: Prisma.TaiKhoanWhereInput = exceptId ? { maTaiKhoan: { not: exceptId } } : {};
    const [byName, byEmail] = await Promise.all([
      this.prisma.taiKhoan.findFirst({ where: { tenDangNhap: { equals: username, mode: 'insensitive' }, ...except } }),
      this.prisma.taiKhoan.findFirst({ where: { emailKhoiPhuc: { equals: email, mode: 'insensitive' }, ...except } }),
    ]);
    if (byName) throw new ConflictException(`Tên đăng nhập "${username}" đã được dùng.`);
    if (byEmail) throw new ConflictException(`Email "${email}" đã được dùng cho tài khoản ${byEmail.tenDangNhap}.`);
  }
}

/** Tài khoản → `SystemAccount` của FE. Chỉ chọn trường hiển thị, không trả dữ liệu xác thực. */
function toSystemAccount(row: AccountRow) {
  return {
    id: row.maTaiKhoan,
    username: row.tenDangNhap,
    employeeId: row.maNV,
    fullName: row.nhanVien.hoTen,
    email: row.emailKhoiPhuc,
    role: row.vaiTro,
    status: row.trangThai,
    employeeStatus: row.nhanVien.trangThai,
    failedLoginCount: row.soLanSaiMatKhau,
    lastLogin: row.lanDangNhapCuoi?.toISOString() ?? null,
    createdAt: row.ngayTao.toISOString(),
  };
}
