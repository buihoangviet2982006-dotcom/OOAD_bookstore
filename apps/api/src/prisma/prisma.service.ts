import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Không fallback sang DB mặc định để tránh kết nối nhầm PostgreSQL khác trên máy.
    // Local: apps/api/.env (ConfigModule nạp). Docker: Compose truyền biến này.
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('Thiếu biến môi trường DATABASE_URL (xem apps/api/.env.example).');
    }
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
