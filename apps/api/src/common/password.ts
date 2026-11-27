import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/**
 * Hash mật khẩu (hoặc mã OTP) bằng scrypt – có sẵn trong Node, không cần thư viện native.
 * Định dạng lưu: `scrypt$<salt hex>$<hash hex>` – trùng với prisma/seed.ts.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(plain, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** So khớp mật khẩu với chuỗi hash đã lưu. So sánh thời gian hằng để tránh dò theo thời gian phản hồi. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [algorithm, saltHex, hashHex] = stored.split('$');
  if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(plain, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
