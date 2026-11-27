/**
 * E2E Khách hàng + Nhà cung cấp + Nhân viên – DB thật.
 * Dữ liệu thử: mã bắt đầu "E2P" hoặc tên bắt đầu "E2P" (bản ghi tạo qua API có mã tự sinh).
 * Tất cả được dọn trong beforeAll/afterAll; dữ liệu seed chỉ được đọc.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { VaiTro } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PREFIX = 'E2P';
const PASSWORD = 'Matkhau@123';

describe('Khách hàng, NCC, Nhân viên (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const tokens: Record<string, string> = {};

  const as = (who: string) => ({
    get: (url: string) => http().get(url).auth(tokens[who], { type: 'bearer' }),
    post: (url: string, body: object) => http().post(url).auth(tokens[who], { type: 'bearer' }).send(body),
    patch: (url: string, body: object) => http().patch(url).auth(tokens[who], { type: 'bearer' }).send(body),
    delete: (url: string) => http().delete(url).auth(tokens[who], { type: 'bearer' }),
  });

  const isTestRow = { startsWith: PREFIX };

  async function cleanup() {
    await prisma.phieuDoiTra.deleteMany({ where: { maDoiTra: isTestRow } });
    await prisma.hoaDon.deleteMany({ where: { maHoaDon: isTestRow } });
    await prisma.phieuNhap.deleteMany({ where: { maPhieuNhap: isTestRow } });
    await prisma.khachHang.deleteMany({ where: { OR: [{ maKH: isTestRow }, { hoTen: isTestRow }] } });
    await prisma.nhaCungCap.deleteMany({ where: { OR: [{ maNCC: isTestRow }, { tenNCC: isTestRow }] } });
    const testEmployees = { OR: [{ maNV: isTestRow }, { hoTen: isTestRow }] };
    await prisma.taiKhoan.deleteMany({ where: { nhanVien: testEmployees } });
    await prisma.nhanVien.deleteMany({ where: testEmployees });
  }

  /** Nhân viên + tài khoản thử, đăng nhập và lưu token theo khóa `key`. */
  async function createStaff(key: string, role: VaiTro, phone: string) {
    const maNV = `${PREFIX}-${key}`;
    const username = maNV.toLowerCase();
    await prisma.nhanVien.create({
      data: {
        maNV,
        hoTen: `${PREFIX} ${key}`,
        soDienThoai: phone,
        email: `${username}@test.local`,
        ngayVaoLam: new Date('2026-01-01'),
        boPhan: role,
        chucVu: 'Test',
      },
    });
    await prisma.taiKhoan.create({
      data: {
        maTaiKhoan: maNV,
        tenDangNhap: username,
        emailKhoiPhuc: `${username}@test.local`,
        matKhauHash: await hashPassword(PASSWORD),
        vaiTro: role,
        maNV,
      },
    });
    const res = await http().post('/auth/login').send({ identifier: username, password: PASSWORD }).expect(200);
    tokens[key] = res.body.accessToken as string;
    return { maNV, username };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
    await createStaff('MANAGER', 'MANAGER', '0977000001');
    await createStaff('SALES', 'SALES', '0977000002');
    await createStaff('WAREHOUSE', 'WAREHOUSE', '0977000003');
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  // ───────────────────────── Khách hàng ─────────────────────────
  describe('Khách hàng', () => {
    it('quyền: SALES/MANAGER được dùng; WAREHOUSE → 403; chưa đăng nhập → 401', async () => {
      await as('SALES').get('/customers').expect(200);
      await as('MANAGER').get('/customers').expect(200);
      await as('WAREHOUSE').get('/customers').expect(403);
      await http().get('/customers').expect(401);
    });

    it('tạo: mã KHxxx tự sinh, SĐT chuẩn hóa, bỏ qua tier/points/totalSpent trong payload', async () => {
      const res = await as('SALES')
        .post('/customers', {
          fullName: `${PREFIX} Khách mới`,
          phone: '0966 111 222',
          email: '',
          tier: 'DIAMOND',
          points: 9999,
          totalSpent: 50_000_000,
          orderCount: 10,
        })
        .expect(201);
      expect(res.body).toMatchObject({
        phone: '0966111222',
        tier: 'STANDARD',
        points: 0,
        totalSpent: 0,
        orderCount: 0,
        lastPurchaseDate: null,
        email: '',
      });
      expect(res.body.id).toMatch(/^KH\d{3,}$/);

      const updated = await as('SALES')
        .patch(`/customers/${res.body.id}`, { fullName: `${PREFIX} Khách sửa`, phone: '0966111222', points: 500 })
        .expect(200);
      expect(updated.body).toMatchObject({ fullName: `${PREFIX} Khách sửa`, points: 0 });

      // chưa có hóa đơn → xóa được
      await as('SALES').delete(`/customers/${res.body.id}`).expect(200);
      await as('SALES').delete(`/customers/${res.body.id}`).expect(404);
    });

    it('validation: SĐT sai / trùng, thiếu tên, email sai', async () => {
      await as('SALES').post('/customers', { fullName: `${PREFIX} A`, phone: '09661112223' }).expect(400);
      const dup = await as('SALES').post('/customers', { fullName: `${PREFIX} A`, phone: '0909 234 567' }).expect(409);
      expect(dup.body.message).toContain('KH001');
      await as('SALES').post('/customers', { fullName: ' ', phone: '0966111333' }).expect(400);
      await as('SALES').post('/customers', { fullName: `${PREFIX} A`, phone: '0966111333', email: 'x@' }).expect(400);
      await as('SALES').patch('/customers/KHONG_CO', { fullName: 'X', phone: '0966111444' }).expect(404);
    });

    it('chỉ số tổng hợp từ hóa đơn + đổi/trả; có hóa đơn → chặn xóa', async () => {
      const maKH = `${PREFIX}-KH1`;
      await prisma.khachHang.create({
        data: { maKH, hoTen: `${PREFIX} Khách có đơn`, soDienThoai: '0966999001', diemTichLuy: 120 },
      });
      await prisma.hoaDon.create({
        data: {
          maHoaDon: `${PREFIX}-HD1`,
          ngayLap: new Date('2026-11-01T09:00:00+07:00'),
          tongTienHang: 1_000_000,
          thanhToanCuoi: 1_000_000,
          maKH,
          maNV: `${PREFIX}-SALES`,
        },
      });
      await prisma.hoaDon.create({
        data: {
          maHoaDon: `${PREFIX}-HD2`,
          ngayLap: new Date('2026-11-10T09:00:00+07:00'),
          tongTienHang: 300_000,
          thanhToanCuoi: 300_000,
          maKH,
          maNV: `${PREFIX}-SALES`,
        },
      });
      await prisma.phieuDoiTra.create({
        data: {
          maDoiTra: `${PREFIX}-DT1`,
          lyDo: 'Test',
          hinhThucXuLy: 'RETURN',
          tienHoanTra: 100_000,
          maHoaDon: `${PREFIX}-HD2`,
          maNV: `${PREFIX}-SALES`,
        },
      });

      const list = await as('SALES').get('/customers').expect(200);
      const customer = list.body.find((c: { id: string }) => c.id === maKH);
      // 1.000.000 + 300.000 − 100.000 = 1.200.000 → SILVER
      expect(customer).toMatchObject({
        totalSpent: 1_200_000,
        orderCount: 2,
        tier: 'SILVER',
        points: 120,
        lastPurchaseDate: new Date('2026-11-10T09:00:00+07:00').toISOString(),
      });

      const blocked = await as('SALES').delete(`/customers/${maKH}`).expect(409);
      expect(blocked.body.message).toContain('2 hóa đơn');

      // seed: KH003 = 524.000 + 17.000 (khách bù khi đổi) = 541.000
      expect(list.body.find((c: { id: string }) => c.id === 'KH003')).toMatchObject({
        totalSpent: 541_000,
        orderCount: 1,
        tier: 'STANDARD',
      });
    });
  });

  // ───────────────────────── Nhà cung cấp ─────────────────────────
  describe('Nhà cung cấp', () => {
    const validSupplier = (phone: string, extra: object = {}) => ({
      name: `${PREFIX} NCC`,
      phone,
      taxCode: '',
      contactPerson: '',
      email: '',
      address: '',
      status: 'ACTIVE',
      ...extra,
    });

    it('quyền: WAREHOUSE/MANAGER được dùng; SALES → 403; không có API xóa', async () => {
      await as('WAREHOUSE').get('/suppliers').expect(200);
      await as('MANAGER').get('/suppliers').expect(200);
      await as('SALES').get('/suppliers').expect(403);
      await as('MANAGER').delete('/suppliers/NCC001').expect(404);
    });

    it('tạo/sửa: mã NCCxxx, trùng SĐT/MST → 409, bỏ qua số liệu công nợ trong payload', async () => {
      const res = await as('WAREHOUSE')
        .post('/suppliers', validSupplier('028 1111 2222', { currentDebt: 999, totalImportAmount: 999 }))
        .expect(201);
      expect(res.body).toMatchObject({ phone: '02811112222', currentDebt: 0, totalImportAmount: 0, dueDate: null });
      expect(res.body.id).toMatch(/^NCC\d{3,}$/);

      await as('WAREHOUSE').post('/suppliers', validSupplier('02839316289')).expect(409); // SĐT NCC001
      await as('WAREHOUSE').post('/suppliers', validSupplier('02811113333', { taxCode: '0301458921' })).expect(409);
      await as('WAREHOUSE').post('/suppliers', validSupplier('123')).expect(400);
      await as('WAREHOUSE').post('/suppliers', validSupplier('02811113333', { taxCode: '12AB' })).expect(400);
      // giữ SĐT của chính nó khi sửa → OK
      await as('WAREHOUSE').patch(`/suppliers/${res.body.id}`, validSupplier('02811112222')).expect(200);
      await as('WAREHOUSE').patch('/suppliers/KHONG_CO', validSupplier('02811114444')).expect(404);
    });

    it('công nợ tính từ phiếu nhập; ngừng hợp tác vẫn giữ công nợ', async () => {
      const maNCC = `${PREFIX}-NCC1`;
      await prisma.nhaCungCap.create({ data: { maNCC, tenNCC: `${PREFIX} NCC nợ`, soDienThoai: '02899990001' } });
      const order = (code: string, tongTien: number, daThanhToan: number, han: string) =>
        prisma.phieuNhap.create({
          data: {
            maPhieuNhap: `${PREFIX}-${code}`,
            tongTien,
            daThanhToan,
            hanThanhToan: new Date(`${han}T00:00:00Z`),
            maNCC,
            maNV: `${PREFIX}-WAREHOUSE`,
          },
        });
      await order('PN1', 1_000_000, 400_000, '2026-12-01');
      await order('PN2', 500_000, 500_000, '2026-11-20'); // đã trả đủ → không tính hạn
      await order('PN3', 200_000, 0, '2026-11-25');

      const expected = { totalImportAmount: 1_700_000, currentDebt: 800_000, dueDate: '2026-11-25' };
      let list = await as('WAREHOUSE').get('/suppliers').expect(200);
      expect(list.body.find((s: { id: string }) => s.id === maNCC)).toMatchObject(expected);

      await as('WAREHOUSE')
        .patch(`/suppliers/${maNCC}`, validSupplier('02899990001', { name: `${PREFIX} NCC nợ`, status: 'INACTIVE' }))
        .expect(200);
      list = await as('WAREHOUSE').get('/suppliers').expect(200);
      expect(list.body.find((s: { id: string }) => s.id === maNCC)).toMatchObject({ ...expected, status: 'INACTIVE' });

      // seed: NCC002 nợ 650.000, hạn 24/11
      expect(list.body.find((s: { id: string }) => s.id === 'NCC002')).toMatchObject({
        currentDebt: 650_000,
        dueDate: '2026-11-24',
      });
    });
  });

  // ───────────────────────── Nhân viên ─────────────────────────
  describe('Nhân viên', () => {
    const validEmployee = (phone: string, email: string, extra: object = {}) => ({
      fullName: `${PREFIX} Nhân viên`,
      role: 'SALES',
      positionTitle: 'Bán hàng',
      phone,
      email,
      branchName: 'bỏ qua',
      joinDate: '2026-11-01',
      baseSalary: 9_000_000,
      status: 'WORKING',
      address: '',
      ...extra,
    });

    it('chỉ MANAGER xem được (có lương); SALES/WAREHOUSE → 403', async () => {
      const res = await as('MANAGER').get('/employees').expect(200);
      expect(res.body.find((e: { id: string }) => e.id === 'NV001')).toMatchObject({
        role: 'MANAGER',
        joinDate: '2023-03-01',
        baseSalary: 18_500_000,
        branchName: 'Chi nhánh trung tâm',
      });
      await as('SALES').get('/employees').expect(403);
      await as('WAREHOUSE').get('/employees').expect(403);
      await as('WAREHOUSE').post('/employees', validEmployee('0977100001', 'x@test.local')).expect(403);
    });

    it('tạo / trùng / ngày sai; chưa có ràng buộc → xóa hẳn', async () => {
      const res = await as('MANAGER').post('/employees', validEmployee('0977 100 002', 'E2P.New@Test.Local')).expect(201);
      expect(res.body).toMatchObject({ phone: '0977100002', email: 'e2p.new@test.local', status: 'WORKING' });
      expect(res.body.id).toMatch(/^NV\d{3,}$/);

      await as('MANAGER').post('/employees', validEmployee('0903128456', 'y@test.local')).expect(409); // SĐT NV001
      await as('MANAGER').post('/employees', validEmployee('0977100003', 'MINHANH@mocbooks.vn')).expect(409);
      await as('MANAGER').post('/employees', validEmployee('0977100003', 'z@test.local', { joinDate: '2026-02-31' })).expect(400);
      await as('MANAGER').post('/employees', validEmployee('0977100003', 'z@test.local', { role: 'ADMIN' })).expect(400);

      const del = await as('MANAGER').delete(`/employees/${res.body.id}`).expect(200);
      expect(del.body.action).toBe('DELETED');
    });

    it('chuyển thôi việc → tài khoản bị khóa, token cũ bị từ chối, không đăng nhập được', async () => {
      const { maNV, username } = await createStaff('RES1', 'SALES', '0977200001');
      await as('RES1').get('/auth/me').expect(200);

      await as('MANAGER')
        .patch(`/employees/${maNV}`, validEmployee('0977200001', `${username}@test.local`, { status: 'RESIGNED' }))
        .expect(200);
      await as('RES1').get('/auth/me').expect(401);
      expect((await prisma.taiKhoan.findUniqueOrThrow({ where: { maNV } })).trangThai).toBe('LOCKED');
      await http().post('/auth/login').send({ identifier: username, password: PASSWORD }).expect(403);
    });

    it('xóa nhân viên có tài khoản → chuyển thôi việc + thu hồi phiên, không xóa vật lý', async () => {
      const { maNV } = await createStaff('RES2', 'WAREHOUSE', '0977200002');
      const res = await as('MANAGER').delete(`/employees/${maNV}`).expect(200);
      expect(res.body.action).toBe('RESIGNED');
      await as('RES2').get('/auth/me').expect(401);
      expect(await prisma.nhanVien.findUnique({ where: { maNV } })).toMatchObject({ trangThai: 'RESIGNED' });
    });

    it('Quản lý không tự xóa / tự cho thôi việc chính mình', async () => {
      const self = `${PREFIX}-MANAGER`;
      await as('MANAGER').delete(`/employees/${self}`).expect(400);
      await as('MANAGER')
        .patch(`/employees/${self}`, validEmployee('0977000001', 'e2p-manager@test.local', { role: 'MANAGER', status: 'RESIGNED' }))
        .expect(400);
      await as('MANAGER').get('/auth/me').expect(200);
    });
  });
});
