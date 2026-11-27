import type { ConfigService } from '@nestjs/config';
import { DEFAULT_TOKEN_TTL_MINUTES, MIN_JWT_SECRET_LENGTH } from './auth.constants.js';

/**
 * Đọc cấu hình xác thực từ biến môi trường. Không có giá trị secret mặc định:
 * thiếu hoặc quá ngắn thì API dừng ngay khi khởi động với thông báo rõ ràng.
 */
export function readJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET') ?? '';
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET chưa được cấu hình hoặc ngắn hơn ${MIN_JWT_SECRET_LENGTH} ký tự (xem apps/api/.env.example).`,
    );
  }
  return secret;
}

export function readTokenTtlSeconds(config: ConfigService): number {
  const minutes = Number(config.get<string>('JWT_EXPIRES_MINUTES') ?? DEFAULT_TOKEN_TTL_MINUTES);
  if (!Number.isInteger(minutes) || minutes <= 0) {
    throw new Error('JWT_EXPIRES_MINUTES phải là số nguyên dương (phút).');
  }
  return minutes * 60;
}

/**
 * In OTP ra console chỉ khi bật rõ AUTH_DEMO_OTP_LOG=true và không chạy production.
 * Đây là thay thế cho việc gửi email (chưa có dịch vụ email trong phạm vi demo).
 */
export function isDemoOtpLogEnabled(config: ConfigService): boolean {
  return (
    config.get<string>('AUTH_DEMO_OTP_LOG') === 'true' &&
    config.get<string>('NODE_ENV') !== 'production'
  );
}
