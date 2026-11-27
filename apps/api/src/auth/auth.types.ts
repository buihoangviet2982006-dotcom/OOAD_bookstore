import type { Request } from 'express';
import type { NhanVien, TaiKhoan, VaiTro } from '@prisma/client';

/** Nội dung JWT: chỉ mã tài khoản và phiên bản phiên. Vai trò luôn đọc lại từ DB. */
export interface TokenPayload {
  sub: string; // mã tài khoản
  ver: number; // tai_khoan.phien_ban tại thời điểm đăng nhập
}

/** Tài khoản đang đăng nhập, gắn vào request bởi AuthGuard. */
export type CurrentAccount = TaiKhoan & { nhanVien: NhanVien };

export interface AuthenticatedRequest extends Request {
  user: CurrentAccount;
}

/** Hình dạng `AuthUser` mà frontend mong đợi (apps/web/src/types/index.ts). */
export interface AuthUserResponse {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: VaiTro;
  branchId: string;
  branchName: string;
  avatarInitials: string;
}
