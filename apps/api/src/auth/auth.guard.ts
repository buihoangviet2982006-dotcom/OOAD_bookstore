import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { IS_PUBLIC_KEY } from './auth.constants.js';
import type { AuthenticatedRequest, TokenPayload } from './auth.types.js';

/**
 * Guard xác thực toàn cục (401). Mỗi request:
 * 1. Đọc Bearer token, kiểm tra chữ ký và hạn dùng.
 * 2. Nạp lại tài khoản từ DB – nên khóa tài khoản, đăng xuất, đổi mật khẩu có hiệu lực ngay:
 *    token mang `ver` cũ sẽ không khớp `phien_ban` hiện tại.
 * Route có @Public() được bỏ qua.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    if (!token) throw new UnauthorizedException('Bạn chưa đăng nhập.');

    const payload = await this.verifyToken(token);
    const account = await this.prisma.taiKhoan.findUnique({
      where: { maTaiKhoan: payload.sub },
      include: { nhanVien: true },
    });

    if (!account) throw new UnauthorizedException('Tài khoản không còn tồn tại.');
    if (account.trangThai === 'LOCKED') {
      throw new UnauthorizedException('Tài khoản đã bị khóa. Vui lòng liên hệ Quản lý.');
    }
    if (account.nhanVien.trangThai === 'RESIGNED') {
      throw new UnauthorizedException('Nhân viên đã thôi việc, không thể sử dụng hệ thống.');
    }
    if (payload.ver !== account.phienBan) {
      throw new UnauthorizedException('Phiên đăng nhập đã kết thúc, vui lòng đăng nhập lại.');
    }

    request.user = account;
    return true;
  }

  private extractBearerToken(request: AuthenticatedRequest): string | null {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    return scheme === 'Bearer' && token ? token : null;
  }

  private async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<Partial<TokenPayload>>(token);
      if (typeof payload.sub !== 'string' || typeof payload.ver !== 'number') {
        throw new Error('Thiếu thông tin trong token');
      }
      return { sub: payload.sub, ver: payload.ver };
    } catch (error) {
      const expired = error instanceof Error && error.name === 'TokenExpiredError';
      throw new UnauthorizedException(
        expired
          ? 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'
          : 'Token đăng nhập không hợp lệ.',
      );
    }
  }
}
