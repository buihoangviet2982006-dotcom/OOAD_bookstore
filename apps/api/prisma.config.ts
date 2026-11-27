import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma CLI không tự đọc file .env.
// - Chạy local: nạp apps/api/.env (DATABASE_URL trỏ localhost:5433).
// - Chạy trong Docker: Compose truyền sẵn DATABASE_URL (postgres:5432), không có file .env.
// Biến môi trường đã có luôn được ưu tiên hơn file .env.
const envFile = path.join(import.meta.dirname, '.env');
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const databaseUrl = process.env.DATABASE_URL;

// Không fallback sang một DB mặc định: máy dev có thể có PostgreSQL khác ở 5432.
// Thiếu DATABASE_URL thì các lệnh cần DB (migrate, seed...) sẽ báo lỗi rõ ràng;
// `prisma generate` vẫn chạy được (CI dùng lệnh này mà không có DB).
if (databaseUrl) {
  const target = new URL(databaseUrl);
  console.info(
    `[prisma] DB đích: ${target.hostname}:${target.port || '5432'}${target.pathname}`,
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.ts',
  },
  datasource: databaseUrl ? { url: databaseUrl } : undefined,
});
