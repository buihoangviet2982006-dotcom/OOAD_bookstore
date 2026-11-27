import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('hash theo định dạng scrypt$salt$hash và xác minh đúng mật khẩu', async () => {
    const stored = await hashPassword('123456');
    expect(stored).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(await verifyPassword('123456', stored)).toBe(true);
    expect(await verifyPassword('1234567', stored)).toBe(false);
  });

  it('mỗi lần hash dùng salt khác nhau', async () => {
    expect(await hashPassword('abc')).not.toBe(await hashPassword('abc'));
  });

  it('từ chối chuỗi hash sai định dạng', async () => {
    expect(await verifyPassword('123456', 'plain-text')).toBe(false);
    expect(await verifyPassword('123456', 'bcrypt$aa$bb')).toBe(false);
  });
});
