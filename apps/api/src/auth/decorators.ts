import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { VaiTro } from '@prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.constants.js';
import type { AuthenticatedRequest, CurrentAccount } from './auth.types.js';

/** Đánh dấu route không cần đăng nhập (mặc định mọi route đều cần). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Giới hạn route cho các vai trò được liệt kê. MANAGER luôn được phép (quyết định review #2).
 * Không gắn @Roles = mọi người dùng đã đăng nhập đều dùng được.
 */
export const Roles = (...roles: VaiTro[]) => SetMetadata(ROLES_KEY, roles);

/** Lấy tài khoản đang đăng nhập (do AuthGuard nạp từ DB), không lấy từ dữ liệu FE gửi. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentAccount =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
