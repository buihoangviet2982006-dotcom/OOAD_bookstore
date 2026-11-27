import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { VaiTro } from '@prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.constants.js';
import { RolesGuard } from './roles.guard.js';

function contextFor(role: VaiTro): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: { vaiTro: role } }) }),
  } as unknown as ExecutionContext;
}

function guardWith(metadata: Record<string, unknown>): RolesGuard {
  const reflector = { getAllAndOverride: vi.fn((key: string) => metadata[key]) };
  return new RolesGuard(reflector as unknown as Reflector);
}

describe('RolesGuard', () => {
  it('cho phép khi route không giới hạn vai trò', () => {
    expect(guardWith({}).canActivate(contextFor('SALES'))).toBe(true);
  });

  it('cho phép đúng vai trò', () => {
    const guard = guardWith({ [ROLES_KEY]: ['WAREHOUSE'] });
    expect(guard.canActivate(contextFor('WAREHOUSE'))).toBe(true);
  });

  it('MANAGER luôn được phép', () => {
    const guard = guardWith({ [ROLES_KEY]: ['SALES'] });
    expect(guard.canActivate(contextFor('MANAGER'))).toBe(true);
  });

  it('sai vai trò → 403 Forbidden', () => {
    const guard = guardWith({ [ROLES_KEY]: ['WAREHOUSE'] });
    expect(() => guard.canActivate(contextFor('SALES'))).toThrow(ForbiddenException);
  });

  it('bỏ qua route @Public()', () => {
    const guard = guardWith({ [IS_PUBLIC_KEY]: true, [ROLES_KEY]: ['WAREHOUSE'] });
    expect(guard.canActivate(contextFor('SALES'))).toBe(true);
  });
});
