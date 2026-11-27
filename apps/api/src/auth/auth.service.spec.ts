import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hashPassword } from '../common/password.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

describe('login credential snapshot', () => {
  it.each(['hash', 'version', 'locked', 'resigned', 'reset'])(
    'refuses issuing a token when %s changes after the password check', async (change) => {
      const account = {
        maTaiKhoan: 'TEST-AUTH', matKhauHash: await hashPassword('old-password'), phienBan: 1,
        trangThai: 'ACTIVE', nhanVien: { trangThai: 'WORKING' },
      };
      const current = structuredClone(account);
      const jwt = { signAsync: vi.fn() };
      const prisma = { taiKhoan: {
        findFirst: vi.fn().mockResolvedValue(account),
        updateMany: vi.fn(({ where }) => {
          if (change === 'hash' || change === 'reset') current.matKhauHash = 'new-hash';
          if (change === 'version' || change === 'reset') current.phienBan++;
          if (change === 'locked') current.trangThai = 'LOCKED';
          if (change === 'resigned') current.nhanVien.trangThai = 'RESIGNED';
          return { count: Number(where.matKhauHash === current.matKhauHash &&
            where.phienBan === current.phienBan && where.trangThai === current.trangThai &&
            where.nhanVien?.trangThai?.not !== current.nhanVien.trangThai) };
        }),
      } };
      const service = new AuthService(prisma as unknown as PrismaService, jwt as unknown as JwtService, new ConfigService());
      await expect(service.login({ identifier: 'test', password: 'old-password' })).rejects.toThrow(UnauthorizedException);
      expect(jwt.signAsync).not.toHaveBeenCalled();
    },
  );

  it('reset after conditional UPDATE cannot upgrade the verified version; AuthGuard rejects token', async () => {
    const account = {
      maTaiKhoan: 'TEST-AUTH', tenDangNhap: 'test', matKhauHash: await hashPassword('old-password'),
      phienBan: 1, trangThai: 'ACTIVE', vaiTro: 'SALES',
      nhanVien: { trangThai: 'WORKING', hoTen: 'Test Auth' },
    };
    const current = structuredClone(account);
    const jwt = new JwtService({ secret: 'test-only-secret-at-least-32-characters' });
    const prisma = { taiKhoan: {
      findFirst: vi.fn().mockResolvedValue(account),
      updateMany: vi.fn().mockImplementation(() => {
        current.matKhauHash = 'reset-hash';
        current.phienBan++;
        return { count: 1 };
      }),
      findUnique: vi.fn().mockImplementation(() => current),
    } };
    const service = new AuthService(prisma as unknown as PrismaService, jwt, new ConfigService());
    const result = await service.login({ identifier: 'test', password: 'old-password' });
    expect(jwt.verify(result.accessToken).ver).toBe(1);
    const guard = new AuthGuard({ getAllAndOverride: () => false } as unknown as Reflector, jwt, prisma as unknown as PrismaService);
    const context = {
      getHandler: () => undefined, getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${result.accessToken}` } }) }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toThrow('Phiên đăng nhập đã kết thúc');
  });
});
