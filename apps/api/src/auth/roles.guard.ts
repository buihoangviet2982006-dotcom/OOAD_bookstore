import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { VaiTro } from '@prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.constants.js';
import type { AuthenticatedRequest } from './auth.types.js';

/**
 * Guard phân quyền theo vai trò (403). Chạy sau AuthGuard nên `request.user` đã được nạp từ DB.
 * RBAC cố định (quyết định review #2): MANAGER được mọi chức năng; route không gắn @Roles
 * thì mọi người đã đăng nhập đều dùng được.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const allowedRoles = this.reflector.getAllAndOverride<VaiTro[] | undefined>(ROLES_KEY, targets);
    if (!allowedRoles || allowedRoles.length === 0) return true;

    const role = context.switchToHttp().getRequest<AuthenticatedRequest>().user.vaiTro;
    if (role === 'MANAGER' || allowedRoles.includes(role)) return true;

    throw new ForbiddenException('Bạn không có quyền thực hiện chức năng này.');
  }
}
