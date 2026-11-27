import { ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

const controllerWith = (queryRaw: () => Promise<unknown>) =>
  new HealthController({ $queryRaw: queryRaw } as unknown as PrismaService);

describe('HealthController', () => {
  it('DB kết nối được → status ok', async () => {
    await expect(controllerWith(() => Promise.resolve([1])).check()).resolves.toMatchObject({ status: 'ok' });
  });

  it('mất DB → 503 (healthcheck Docker báo unhealthy), không trả chi tiết lỗi DB ra ngoài', async () => {
    const error = await controllerWith(() => Promise.reject(new Error('password authentication failed for user "x"')))
      .check()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(JSON.stringify((error as ServiceUnavailableException).getResponse())).not.toContain('password');
  });
});
