import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/**
 * Gọi trong transaction, TRƯỚC thao tác làm tài khoản `maTaiKhoan` mất quyền Quản lý đang hoạt động
 * (khóa, đổi vai trò, nhân viên thôi việc / đổi bộ phận). Khóa mọi tài khoản Quản lý đang hoạt động
 * (theo thứ tự mã, tránh deadlock) rồi kiểm tra còn ít nhất một tài khoản khác.
 * Hai Quản lý đồng thời hạ quyền của nhau → thao tác sau phải chờ, đọc lại và bị từ chối.
 */
export async function assertAnotherActiveManager(tx: Prisma.TransactionClient, maTaiKhoan: string) {
  const managers = await tx.$queryRaw<{ ma_tai_khoan: string }[]>`
    SELECT tk.ma_tai_khoan FROM tai_khoan tk
    JOIN nhan_vien nv ON nv.ma_nv = tk.ma_nv
    WHERE tk.vai_tro = 'MANAGER' AND tk.trang_thai = 'ACTIVE' AND nv.trang_thai <> 'RESIGNED'
    ORDER BY tk.ma_tai_khoan
    FOR UPDATE OF tk`;
  if (!managers.some((m) => m.ma_tai_khoan !== maTaiKhoan)) {
    throw new ConflictException('Phải còn ít nhất một tài khoản Quản lý đang hoạt động.');
  }
}

/** Tài khoản đang là Quản lý hoạt động (không khóa, nhân viên chưa thôi việc). */
export function isActiveManager(account: { vaiTro: string; trangThai: string }, employeeStatus: string) {
  return account.vaiTro === 'MANAGER' && account.trangThai === 'ACTIVE' && employeeStatus !== 'RESIGNED';
}
