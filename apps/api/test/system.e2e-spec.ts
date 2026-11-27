/**
 * E2E Quản lý hệ thống – tài khoản, ma trận quyền, sao lưu JSON. DB thật.
 * Dữ liệu thử mã "E2Y" (nhân viên, tài khoản do test tạo, bản ghi sao lưu do nhân viên E2Y lập) – dọn theo tiền tố.
 * Riêng test "Quản lý cuối cùng" khóa TẠM tài khoản seed TK001 (ghi lại trạng thái cũ, trả lại trong finally/afterAll)
 * để các tài khoản E2Y là Quản lý hoạt động duy nhất.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TrangThaiTaiKhoan, VaiTro } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { allows, MODULE_RULES } from '../src/system/permissions.js';

const PREFIX = 'E2Y';
const PASSWORD = 'Matkhau@123';
const ACC = '/system/accounts';
const SEED_MANAGER = 'TK001';

describe('Quản lý hệ thống (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let seedManagerStatus: TrangThaiTaiKhoan | null = null;
  const http = () => request(app.getHttpServer());
  const tokens: Record<string, string> = {};
  const as = (token: string) => ({
    get: (url: string) => http().get(url).auth(token, { type: 'bearer' }),
    post: (url: string, body: object = {}) => http().post(url).auth(token, { type: 'bearer' }).send(body),
    patch: (url: string, body: object) => http().patch(url).auth(token, { type: 'bearer' }).send(body),
  });
  const mgr = () => as(tokens.MGR);
  const id = (s: string) => `${PREFIX}-${s}`;
  const login = (username: string, password = PASSWORD) => http().post('/auth/login').send({ identifier: username, password });
  const account = (maNV: string) => prisma.taiKhoan.findUniqueOrThrow({ where: { maNV } });

  async function cleanup() {
    await prisma.banSaoLuu.deleteMany({ where: { maNV: { startsWith: PREFIX } } });
    await prisma.taiKhoan.deleteMany({ where: { maNV: { startsWith: PREFIX } } });
    await prisma.nhanVien.deleteMany({ where: { maNV: { startsWith: PREFIX } } });
  }

  async function createEmployee(key: string, role: VaiTro, phone: string, status: 'WORKING' | 'RESIGNED' = 'WORKING') {
    const maNV = id(key);
    await prisma.nhanVien.create({
      data: { maNV, hoTen: `${PREFIX} ${key}`, soDienThoai: phone, email: `${maNV.toLowerCase()}@test.local`, ngayVaoLam: new Date('2026-01-01'), boPhan: role, chucVu: 'Test', trangThai: status },
    });
  }

  async function createStaff(key: string, role: VaiTro, phone: string) {
    await createEmployee(key, role, phone);
    const maNV = id(key);
    const username = maNV.toLowerCase();
    await prisma.taiKhoan.create({
      data: { maTaiKhoan: maNV, tenDangNhap: username, emailKhoiPhuc: `${username}@test.local`, matKhauHash: await hashPassword(PASSWORD), vaiTro: role, maNV },
    });
    tokens[key] = (await login(username)).body.accessToken;
  }

  async function restoreSeedManager() {
    if (seedManagerStatus) {
      await prisma.taiKhoan.update({ where: { maTaiKhoan: SEED_MANAGER }, data: { trangThai: seedManagerStatus } });
      seedManagerStatus = null;
    }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    await createStaff('MGR', 'MANAGER', '0912300501');
    await createStaff('MGR2', 'MANAGER', '0912300502');
    await createStaff('SALES', 'SALES', '0912300503');
    await createStaff('WAREHOUSE', 'WAREHOUSE', '0912300504');
    await createEmployee('NEW', 'SALES', '0912300505');
    await createEmployee('NEW2', 'SALES', '0912300507');
    await createEmployee('OLD', 'SALES', '0912300506', 'RESIGNED');
  });

  afterAll(async () => {
    await restoreSeedManager();
    await cleanup();
    await app.close();
  });

  it('chỉ MANAGER: SALES/WAREHOUSE → 403', async () => {
    for (const url of [ACC, '/system/permissions', '/system/backups']) {
      await as(tokens.SALES).get(url).expect(403);
      await as(tokens.WAREHOUSE).get(url).expect(403);
      await mgr().get(url).expect(200);
    }
  });

  it('ma trận quyền khớp RBAC thật: cột "Xem" = gọi GET được (200) hay bị chặn (403)', async () => {
    const roles: [VaiTro, string][] = [['MANAGER', tokens.MGR2], ['SALES', tokens.SALES], ['WAREHOUSE', tokens.WAREHOUSE]];
    for (const rule of MODULE_RULES) {
      for (const [role, token] of roles) {
        const { status } = await as(token).get(rule.probe);
        expect({ module: rule.moduleKey, role, status }).toEqual({ module: rule.moduleKey, role, status: allows(rule, role, 'view') ? 200 : 403 });
      }
    }
    const { body } = await mgr().get('/system/permissions').expect(200);
    expect(body.find((m: { moduleKey: string }) => m.moduleKey === 'sales').permissions.SALES).toEqual({ view: true, create: true, edit: false, delete: false });
    await mgr().patch('/system/permissions', {}).expect(404); // không có API lưu quyền
  });

  it('tạo tài khoản cho nhân viên có sẵn: đồng bộ bộ phận, không trả dữ liệu xác thực, đăng nhập được', async () => {
    const res = await mgr().post(ACC, { employeeId: id('NEW'), username: 'E2Y-New.User', role: 'WAREHOUSE', password: 'Khoitao@1' }).expect(201);
    expect(res.body).toMatchObject({ username: 'e2y-new.user', employeeId: id('NEW'), role: 'WAREHOUSE', status: 'ACTIVE', email: 'e2y-new@test.local' });
    expect(Object.keys(res.body).sort()).toEqual(
      ['createdAt', 'email', 'employeeId', 'employeeStatus', 'failedLoginCount', 'fullName', 'id', 'lastLogin', 'role', 'status', 'username'],
    );
    expect((await prisma.nhanVien.findUniqueOrThrow({ where: { maNV: id('NEW') } })).boPhan).toBe('WAREHOUSE');
    await login('e2y-new.user', 'Khoitao@1').expect(200);

    // Mỗi nhân viên tối đa 1 tài khoản; không cấp cho người đã thôi việc; trùng tên đăng nhập.
    await mgr().post(ACC, { employeeId: id('NEW'), username: 'e2y-khac', role: 'SALES', password: 'Khoitao@1' }).expect(409);
    await mgr().post(ACC, { employeeId: id('OLD'), username: 'e2y-old', role: 'SALES', password: 'Khoitao@1' }).expect(400);
    await mgr().post(ACC, { employeeId: id('NOPE'), username: 'e2y-nope', role: 'SALES', password: 'Khoitao@1' }).expect(404);
    await mgr().post(ACC, { employeeId: id('NEW2'), username: 'E2Y-MGR', role: 'SALES', password: 'Khoitao@1' }).expect(409);
    await mgr().post(ACC, { employeeId: id('NEW2'), username: 'e2y new', role: 'SALES', password: 'Khoitao@1' }).expect(400);
    const list = (await mgr().get(ACC).expect(200)).body as object[];
    expect(JSON.stringify(list)).not.toMatch(/scrypt\$|matKhauHash|otp|phienBan/i);
  });

  it('đổi vai trò (tài khoản hoặc bộ phận nhân viên): đồng bộ hai bên, token cũ bị từ chối', async () => {
    const acc = await account(id('SALES'));
    const before = tokens.SALES;
    await mgr().patch(`${ACC}/${acc.maTaiKhoan}`, { username: acc.tenDangNhap, email: acc.emailKhoiPhuc, role: 'WAREHOUSE' }).expect(200);
    expect((await prisma.nhanVien.findUniqueOrThrow({ where: { maNV: id('SALES') } })).boPhan).toBe('WAREHOUSE');
    await as(before).get('/auth/me').expect(401);

    // Đổi bộ phận ở trang Nhân viên → vai trò tài khoản theo, token mới cấp cũng bị thu hồi.
    const token = (await login(acc.tenDangNhap)).body.accessToken;
    const employees = (await mgr().get('/employees').expect(200)).body as { id: string }[];
    const emp = employees.find((e) => e.id === id('SALES'))!;
    await mgr().patch(`/employees/${emp.id}`, { ...emp, role: 'SALES' }).expect(200);
    expect((await account(id('SALES'))).vaiTro).toBe('SALES');
    await as(token).get('/auth/me').expect(401);
    tokens.SALES = (await login(acc.tenDangNhap)).body.accessToken;
  });

  it('khóa thu hồi phiên; mở khóa xóa bộ đếm sai nhưng không khôi phục phiên cũ', async () => {
    const acc = await account(id('WAREHOUSE'));
    const oldToken = tokens.WAREHOUSE;
    await login(acc.tenDangNhap, 'sai-mat-khau').expect(401);
    await mgr().post(`${ACC}/${acc.maTaiKhoan}/lock`).expect(201);
    await as(oldToken).get('/auth/me').expect(401);
    await login(acc.tenDangNhap).expect(403);

    const lockedVersion = (await account(id('WAREHOUSE'))).phienBan;
    const { body } = await mgr().post(`${ACC}/${acc.maTaiKhoan}/unlock`).expect(201);
    expect(body).toMatchObject({ status: 'ACTIVE', failedLoginCount: 0 });
    expect((await account(id('WAREHOUSE'))).phienBan).toBe(lockedVersion);
    await as(oldToken).get('/auth/me').expect(401);
    tokens.WAREHOUSE = (await login(acc.tenDangNhap).expect(200)).body.accessToken;
  });

  it('đặt lại mật khẩu: token cũ và mật khẩu cũ hết hiệu lực', async () => {
    const acc = await account(id('WAREHOUSE'));
    await mgr().post(`${ACC}/${acc.maTaiKhoan}/reset-password`, { newPassword: '123' }).expect(400);
    await mgr().post(`${ACC}/${acc.maTaiKhoan}/reset-password`, { newPassword: 'Moi@2026' }).expect(201);
    await as(tokens.WAREHOUSE).get('/auth/me').expect(401);
    await login(acc.tenDangNhap).expect(401);
    tokens.WAREHOUSE = (await login(acc.tenDangNhap, 'Moi@2026').expect(200)).body.accessToken;
  });

  it('không tự khóa / tự bỏ quyền Quản lý (tài khoản và hồ sơ nhân viên)', async () => {
    const self = await account(id('MGR'));
    await mgr().post(`${ACC}/${self.maTaiKhoan}/lock`).expect(400);
    await mgr().patch(`${ACC}/${self.maTaiKhoan}`, { username: self.tenDangNhap, email: self.emailKhoiPhuc, role: 'SALES' }).expect(400);
    const emp = ((await mgr().get('/employees').expect(200)).body as { id: string }[]).find((e) => e.id === id('MGR'))!;
    await mgr().patch(`/employees/${emp.id}`, { ...emp, role: 'SALES' }).expect(400);
    expect((await account(id('MGR'))).vaiTro).toBe('MANAGER');
  });

  it('hai Quản lý đồng thời hạ quyền của nhau → vẫn còn ít nhất một Quản lý hoạt động', async () => {
    const seed = await prisma.taiKhoan.findUniqueOrThrow({ where: { maTaiKhoan: SEED_MANAGER } });
    seedManagerStatus = seed.trangThai;
    try {
      await prisma.taiKhoan.update({ where: { maTaiKhoan: SEED_MANAGER }, data: { trangThai: 'LOCKED' } });
      const [a, b] = [await account(id('MGR')), await account(id('MGR2'))];
      const demote = (token: string, target: typeof a) =>
        as(token).patch(`${ACC}/${target.maTaiKhoan}`, { username: target.tenDangNhap, email: target.emailKhoiPhuc, role: 'SALES' });
      const results = await Promise.all([demote(tokens.MGR, b), demote(tokens.MGR2, a)]);
      const statuses = results.map((r) => r.status).sort((x, y) => x - y);
      expect(statuses[0]).toBe(200);
      expect([401, 403, 409]).toContain(statuses[1]);

      const activeManagers = await prisma.taiKhoan.count({ where: { maNV: { startsWith: PREFIX }, vaiTro: 'MANAGER', trangThai: 'ACTIVE' } });
      expect(activeManagers).toBe(1);
    } finally {
      await restoreSeedManager();
    }
    // Đưa hai tài khoản về MANAGER cho các test sau.
    await prisma.taiKhoan.updateMany({ where: { maNV: { in: [id('MGR'), id('MGR2')] } }, data: { vaiTro: 'MANAGER' } });
    await prisma.nhanVien.updateMany({ where: { maNV: { in: [id('MGR'), id('MGR2')] } }, data: { boPhan: 'MANAGER' } });
    for (const key of ['MGR', 'MGR2']) tokens[key] = (await login(id(key).toLowerCase())).body.accessToken;
  });

  it('sao lưu: xuất JSON dữ liệu nghiệp vụ, ghi lịch sử, không chứa dữ liệu xác thực; không có phục hồi', async () => {
    const { body } = await mgr().post('/system/backups', { note: `${PREFIX} thử sao lưu` }).expect(201);
    expect(body.record).toMatchObject({ createdBy: `${PREFIX} MGR`, status: 'SUCCESS', note: `${PREFIX} thử sao lưu` });
    expect(body.snapshot.meta.scope).toMatch(/chưa hỗ trợ phục hồi/);
    expect(body.snapshot.data.sach.length).toBeGreaterThan(0);
    expect(body.snapshot.data.hoaDon.length).toBeGreaterThan(0);
    expect(body.snapshot.meta.counts.sach).toBe(body.snapshot.data.sach.length);

    const text = JSON.stringify(body.snapshot);
    expect(text).not.toMatch(/scrypt\$|matKhauHash|otpHash|phienBan|accessToken/);
    expect(text).not.toContain(process.env.JWT_SECRET ?? 'no-secret-configured');

    const history = (await mgr().get('/system/backups').expect(200)).body as { id: string }[];
    expect(history[0].id).toBe(body.record.id);
    await mgr().post('/system/backups/restore', {}).expect(404);
  });
});
