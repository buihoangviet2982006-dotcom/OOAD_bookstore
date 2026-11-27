/**
 * E2E xác thực & phân quyền – chạy với DB thật (DATABASE_URL trong apps/api/.env).
 * Chỉ dùng tài khoản riêng có mã bắt đầu bằng "E2E", tạo trong beforeAll và xóa trong afterAll,
 * không đụng dữ liệu demo.
 */
import { Controller, Get, INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { VaiTro } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { Roles } from '../src/auth/decorators.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/** Controller chỉ dùng trong test để kiểm tra guard. */
@Controller('e2e-probe')
class ProbeController {
  @Get('any')
  any() {
    return { ok: true };
  }

  @Roles('WAREHOUSE')
  @Get('warehouse')
  warehouseOnly() {
    return { ok: true };
  }
}

const PASSWORD = 'Matkhau@123';
const PREFIX = 'E2E';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  async function cleanup() {
    await prisma.taiKhoan.deleteMany({ where: { maNV: { startsWith: PREFIX } } });
    await prisma.nhanVien.deleteMany({ where: { maNV: { startsWith: PREFIX } } });
  }

  /** Tạo (hoặc tạo lại) nhân viên + tài khoản test. Trả về username và email. */
  async function createAccount(key: string, role: VaiTro) {
    const maNV = `${PREFIX}-${key}`;
    const username = `e2e.${key.toLowerCase()}`;
    const email = `e2e.${key.toLowerCase()}@test.local`;
    await prisma.taiKhoan.deleteMany({ where: { maNV } });
    await prisma.nhanVien.deleteMany({ where: { maNV } });
    await prisma.nhanVien.create({
      data: {
        maNV,
        hoTen: `E2E ${key}`,
        soDienThoai: `0999${String(Math.abs(hashCode(key)) % 1_000_000).padStart(6, '0')}`,
        email,
        ngayVaoLam: new Date('2026-01-01'),
        boPhan: role,
        chucVu: 'Test',
      },
    });
    await prisma.taiKhoan.create({
      data: {
        maTaiKhoan: maNV,
        tenDangNhap: username,
        emailKhoiPhuc: email,
        matKhauHash: await hashPassword(PASSWORD),
        vaiTro: role,
        maNV,
      },
    });
    return { username, email, maTaiKhoan: maNV };
  }

  const login = (identifier: string, password = PASSWORD) =>
    http().post('/auth/login').send({ identifier, password });

  async function tokenFor(username: string): Promise<string> {
    const res = await login(username).expect(200);
    return res.body.accessToken as string;
  }

  /** Bắt OTP được in ra log ở chế độ demo. */
  async function requestOtp(email: string): Promise<string> {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    await http().post('/auth/forgot-password').send({ email }).expect(200);
    const line = warn.mock.calls.map((c) => String(c[0])).find((m) => m.includes('[DEMO OTP]'));
    warn.mockRestore();
    const otp = line?.match(/: (\d{6}) \(/)?.[1];
    if (!otp) throw new Error('Không bắt được OTP trong log');
    return otp;
  }

  beforeAll(async () => {
    process.env.AUTH_DEMO_OTP_LOG = 'true';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('Đăng nhập', () => {
    it.each<VaiTro>(['MANAGER', 'SALES', 'WAREHOUSE'])('đăng nhập được vai trò %s', async (role) => {
      const { username } = await createAccount(`LOGIN_${role}`, role);
      const res = await login(username).expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ username, role, branchId: 'BR-01' });
      expect(res.body.user).not.toHaveProperty('matKhauHash');
    });

    it('đăng nhập bằng email, không phân biệt hoa thường', async () => {
      const { email } = await createAccount('EMAIL', 'SALES');
      await login(email.toUpperCase()).expect(200);
    });

    it('sai mật khẩu → 401; tài khoản không tồn tại → 401 cùng thông báo', async () => {
      const { username } = await createAccount('WRONG', 'SALES');
      const wrong = await login(username, 'sai-mat-khau').expect(401);
      const missing = await login('khong.ton.tai').expect(401);
      expect(wrong.body.message).toBe(missing.body.message);
    });

    it('thiếu dữ liệu → 400 với thông báo dạng chuỗi', async () => {
      const res = await http().post('/auth/login').send({ identifier: '' }).expect(400);
      expect(typeof res.body.message).toBe('string');
    });

    it('khóa sau 5 lần sai liên tiếp; đăng nhập đúng trước đó xóa bộ đếm', async () => {
      const { username, maTaiKhoan } = await createAccount('LOCK', 'SALES');
      for (let i = 0; i < 4; i++) await login(username, 'sai').expect(401);
      await login(username).expect(200); // thành công → bộ đếm về 0
      expect((await prisma.taiKhoan.findUniqueOrThrow({ where: { maTaiKhoan } })).soLanSaiMatKhau).toBe(0);

      const token = await tokenFor(username);
      for (let i = 0; i < 4; i++) await login(username, 'sai').expect(401);
      await login(username, 'sai').expect(403); // lần thứ 5 → khóa
      await login(username).expect(403); // đúng mật khẩu vẫn bị chặn
      await http().get('/auth/me').auth(token, { type: 'bearer' }).expect(401); // token cũ bị thu hồi

      // Cách mở khóa tạm thời (chưa có API quản trị): đặt lại trạng thái + bộ đếm trong DB.
      await prisma.taiKhoan.update({
        where: { maTaiKhoan },
        data: { trangThai: 'ACTIVE', soLanSaiMatKhau: 0 },
      });
      await login(username).expect(200);
    });
  });

  describe('Token & guard', () => {
    it('thiếu token / sai định dạng / chữ ký sai → 401', async () => {
      await http().get('/auth/me').expect(401);
      await http().get('/auth/me').set('Authorization', 'Token abc').expect(401);
      await http().get('/auth/me').auth('khong.phai.jwt', { type: 'bearer' }).expect(401);
      const forged = jwt.sign({ sub: 'TK001', ver: 0 }, 'secret-gia-mao-du-32-ky-tu-xxxxxxxx');
      await http().get('/auth/me').auth(forged, { type: 'bearer' }).expect(401);
    });

    it('token hết hạn → 401 với thông báo hết hạn', async () => {
      const { maTaiKhoan } = await createAccount('EXPIRED', 'SALES');
      const expired = jwt.sign(
        { sub: maTaiKhoan, ver: 0, exp: Math.floor(Date.now() / 1000) - 60 },
        process.env.JWT_SECRET!,
      );
      const res = await http().get('/auth/me').auth(expired, { type: 'bearer' }).expect(401);
      expect(res.body.message).toContain('hết hạn');
    });

    it('/auth/me trả thông tin từ DB', async () => {
      const { username } = await createAccount('ME', 'WAREHOUSE');
      const res = await http().get('/auth/me').auth(await tokenFor(username), { type: 'bearer' }).expect(200);
      expect(res.body).toMatchObject({ username, role: 'WAREHOUSE' });
    });

    it('đúng vai trò → 200, sai vai trò → 403, MANAGER → 200', async () => {
      const sales = await tokenFor((await createAccount('ROLE_S', 'SALES')).username);
      const warehouse = await tokenFor((await createAccount('ROLE_W', 'WAREHOUSE')).username);
      const manager = await tokenFor((await createAccount('ROLE_M', 'MANAGER')).username);

      await http().get('/e2e-probe/any').auth(sales, { type: 'bearer' }).expect(200);
      await http().get('/e2e-probe/warehouse').auth(warehouse, { type: 'bearer' }).expect(200);
      await http().get('/e2e-probe/warehouse').auth(sales, { type: 'bearer' }).expect(403);
      await http().get('/e2e-probe/warehouse').auth(manager, { type: 'bearer' }).expect(200);
      await http().get('/e2e-probe/warehouse').expect(401); // chưa đăng nhập → 401, không phải 403
    });

    it('vai trò đọc từ DB: đổi vai trò trong DB có hiệu lực ngay với token cũ', async () => {
      const { username, maTaiKhoan } = await createAccount('ROLE_DB', 'WAREHOUSE');
      const token = await tokenFor(username);
      await prisma.taiKhoan.update({ where: { maTaiKhoan }, data: { vaiTro: 'SALES' } });
      await http().get('/e2e-probe/warehouse').auth(token, { type: 'bearer' }).expect(403);
    });

    it('/health vẫn công khai', async () => {
      await http().get('/health').expect(200);
    });
  });

  describe('Thu hồi phiên', () => {
    it('đăng xuất → token cũ (mọi phiên của tài khoản) bị từ chối', async () => {
      const { username } = await createAccount('LOGOUT', 'SALES');
      const t1 = await tokenFor(username);
      const t2 = await tokenFor(username);
      await http().post('/auth/logout').auth(t1, { type: 'bearer' }).expect(200);
      await http().get('/auth/me').auth(t1, { type: 'bearer' }).expect(401);
      await http().get('/auth/me').auth(t2, { type: 'bearer' }).expect(401);
      await http().get('/auth/me').auth(await tokenFor(username), { type: 'bearer' }).expect(200);
    });

    it('khóa tài khoản → token cũ bị từ chối', async () => {
      const { username, maTaiKhoan } = await createAccount('LOCKED_TOKEN', 'SALES');
      const token = await tokenFor(username);
      await prisma.taiKhoan.update({ where: { maTaiKhoan }, data: { trangThai: 'LOCKED' } });
      await http().get('/auth/me').auth(token, { type: 'bearer' }).expect(401);
    });

    it('nhân viên thôi việc → token cũ bị từ chối, không đăng nhập được', async () => {
      const { username, maTaiKhoan } = await createAccount('RESIGNED', 'SALES');
      const token = await tokenFor(username);
      await prisma.nhanVien.update({ where: { maNV: maTaiKhoan }, data: { trangThai: 'RESIGNED' } });
      await http().get('/auth/me').auth(token, { type: 'bearer' }).expect(401);
      await login(username).expect(403);
    });
  });

  describe('Quên mật khẩu (OTP)', () => {
    it('reset thành công: đổi mật khẩu, token cũ bị thu hồi, mã không dùng lại được', async () => {
      const { username, email } = await createAccount('OTP_OK', 'SALES');
      const oldToken = await tokenFor(username);
      const otp = await requestOtp(email);

      await http().post('/auth/reset-password').send({ email, otp, newPassword: 'MoiMoi@456' }).expect(200);
      await http().get('/auth/me').auth(oldToken, { type: 'bearer' }).expect(401);
      await login(username).expect(401); // mật khẩu cũ
      await login(username, 'MoiMoi@456').expect(200);
      // dùng lại mã
      await http().post('/auth/reset-password').send({ email, otp, newPassword: 'Khac@789' }).expect(400);
    });

    it('OTP sai → 400 kèm số lần còn lại; sai quá 5 lần → mã bị hủy', async () => {
      const { email } = await createAccount('OTP_WRONG', 'SALES');
      const otp = await requestOtp(email);
      const wrong = otp === '000000' ? '111111' : '000000';
      const first = await http()
        .post('/auth/reset-password')
        .send({ email, otp: wrong, newPassword: 'MoiMoi@456' })
        .expect(400);
      expect(first.body.message).toContain('còn 4 lần');
      for (let i = 0; i < 3; i++) {
        await http().post('/auth/reset-password').send({ email, otp: wrong, newPassword: 'MoiMoi@456' }).expect(400);
      }
      const fifth = await http()
        .post('/auth/reset-password')
        .send({ email, otp: wrong, newPassword: 'MoiMoi@456' })
        .expect(400);
      expect(fifth.body.message).toContain('quá số lần');
      // mã đúng cũng không dùng được nữa
      await http().post('/auth/reset-password').send({ email, otp, newPassword: 'MoiMoi@456' }).expect(400);
    });

    it('OTP hết hạn → 400', async () => {
      const { email, maTaiKhoan } = await createAccount('OTP_EXPIRED', 'SALES');
      const otp = await requestOtp(email);
      await prisma.taiKhoan.update({ where: { maTaiKhoan }, data: { otpHetHan: new Date(Date.now() - 1000) } });
      const res = await http().post('/auth/reset-password').send({ email, otp, newPassword: 'MoiMoi@456' }).expect(400);
      expect(res.body.message).toContain('hết hạn');
    });

    it('gửi lại mã → mã cũ hết hiệu lực', async () => {
      const { email } = await createAccount('OTP_RESEND', 'SALES');
      const first = await requestOtp(email);
      let second = await requestOtp(email);
      while (second === first) second = await requestOtp(email); // xác suất trùng 1/10^6
      await http().post('/auth/reset-password').send({ email, otp: first, newPassword: 'MoiMoi@456' }).expect(400);
      await http().post('/auth/reset-password').send({ email, otp: second, newPassword: 'MoiMoi@456' }).expect(200);
    });

    it('email không tồn tại → 404; tài khoản khóa → 403', async () => {
      await http().post('/auth/forgot-password').send({ email: 'khong.co@test.local' }).expect(404);
      const { email, maTaiKhoan } = await createAccount('OTP_LOCKED', 'SALES');
      await prisma.taiKhoan.update({ where: { maTaiKhoan }, data: { trangThai: 'LOCKED' } });
      await http().post('/auth/forgot-password').send({ email }).expect(403);
    });

    it('tắt chế độ demo → 503, không tạo mã', async () => {
      const { email, maTaiKhoan } = await createAccount('OTP_OFF', 'SALES');
      process.env.AUTH_DEMO_OTP_LOG = 'false';
      try {
        await http().post('/auth/forgot-password').send({ email }).expect(503);
      } finally {
        process.env.AUTH_DEMO_OTP_LOG = 'true';
      }
      expect((await prisma.taiKhoan.findUniqueOrThrow({ where: { maTaiKhoan } })).otpHash).toBeNull();
    });
  });
});

function hashCode(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}
