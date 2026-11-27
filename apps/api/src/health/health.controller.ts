import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Kiểm tra sống + kết nối DB. Mất DB → 503 (healthcheck Docker báo unhealthy),
 * chi tiết lỗi chỉ ghi log máy chủ, không trả ra ngoài.
 */
@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error(`Health check: không kết nối được DB – ${error instanceof Error ? error.message : String(error)}`);
      throw new ServiceUnavailableException({ status: 'error', database: 'disconnected', message: 'Không kết nối được cơ sở dữ liệu.' });
    }
    return { status: 'ok', database: 'connected', timestamp: new Date().toISOString() };
  }
}
