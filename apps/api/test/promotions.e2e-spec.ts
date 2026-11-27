/**
 * E2E Khuyến mãi + Voucher – DB thật.
 * Dữ liệu thử: mã bắt đầu "E2K" + các voucher có mã tự sinh (ghi lại trong `generatedCodes`).
 * Dọn đúng các mã đó trong beforeAll/afterAll; dữ liệu seed chỉ được đọc.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { VaiTro } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/common/password.js';
import { todayInStore } from '../src/common/store-time.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PREFIX = 'E2K';
const PASSWORD = 'Matkhau@123';

/** Cộng `days` ngày vào chuỗi YYYY-MM-DD. */
function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const dateOnly = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

describe('Khuyến mãi & Voucher (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const tokens = {} as Record<VaiTro, string>;
  const generatedCodes: string[] = [];
  const today = todayInStore();

  const as = (role: VaiTro) => ({
    get: (url: string) => http().get(url).auth(tokens[role], { type: 'bearer' }),
    post: (url: string, body: object) => http().post(url).auth(tokens[role], { type: 'bearer' }).send(body),
    patch: (url: string, body: object) => http().patch(url).auth(tokens[role], { type: 'bearer' }).send(body),
  });
  const manager = () => as('MANAGER');

  const promotion = (code: string, extra: object = {}) => ({
    code,
    name: `${PREFIX} Chương trình ${code}`,
    description: '',
    discountType: 'PERCENT',
    discountValue: 10,
    maxDiscountAmount: 50000,
    minOrderValue: 200000,
    applicableCategoryId: '',
    startDate: today,
    endDate: addDays(today, 10),
    status: 'ACTIVE',
    ...extra,
  });
  const voucher = (code: string, extra: object = {}) => ({
    code,
    description: `${PREFIX} voucher`,
    discountType: 'FIXED',
    discountValue: 30000,
    minOrderValue: 100000,
    usageLimit: 2,
    startDate: today,
    endDate: addDays(today, 10),
    isActive: true,
    ...extra,
  });
  const findIn = (list: { id: string }[], id: string) => list.find((x) => x.id === id);

  async function cleanup() {
    await prisma.hoaDon.deleteMany({ where: { maHoaDon: { startsWith: PREFIX } } });
    await prisma.chuongTrinhKhuyenMai.deleteMany({ where: { maCTKM: { startsWith: PREFIX } } });
    await prisma.maGiamGia.deleteMany({
      where: { OR: [{ maCode: { startsWith: PREFIX } }, { maCode: { in: generatedCodes } }] },
    });
    await prisma.taiKhoan.deleteMany({ where: { maNV: { startsWith: PREFIX } } });
    await prisma.nhanVien.deleteMany({ where: { maNV: { startsWith: PREFIX } } });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    const roles: VaiTro[] = ['MANAGER', 'SALES', 'WAREHOUSE'];
    for (const [i, role] of roles.entries()) {
      const maNV = `${PREFIX}-${role}`;
      const username = maNV.toLowerCase();
      await prisma.nhanVien.create({
        data: {
          maNV,
          hoTen: `${PREFIX} ${role}`,
          soDienThoai: `09550000${i}0`,
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
      const res = await http().post('/auth/login').send({ identifier: username, password: PASSWORD });
      tokens[role] = res.body.accessToken as string;
    }
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('Phân quyền', () => {
    it('MANAGER thấy mọi CTKM; SALES chỉ thấy CTKM đang diễn ra; WAREHOUSE → 403', async () => {
      const all = await manager().get('/promotions').expect(200);
      expect(findIn(all.body, 'KM-CUOINAM')).toMatchObject({ status: 'SCHEDULED' }); // bắt đầu 20/12
      const forSales = await as('SALES').get('/promotions').expect(200);
      expect(forSales.body.every((p: { status: string }) => p.status === 'ACTIVE')).toBe(true);
      expect(findIn(forSales.body, 'KM-CUOINAM')).toBeUndefined();
      await as('WAREHOUSE').get('/promotions').expect(403);
      await http().get('/promotions').expect(401);
    });

    it('SALES chỉ thấy voucher dùng được, không ghi được, không xem lịch sử', async () => {
      const forSales = await as('SALES').get('/vouchers').expect(200);
      expect(forSales.body.every((v: { status: string }) => v.status === 'ACTIVE')).toBe(true);
      expect(findIn(forSales.body, 'VIP100K')).toBeUndefined(); // hết hạn & tạm ngừng
      await as('SALES').post('/promotions', promotion(`${PREFIX}-X`)).expect(403);
      await as('SALES').post('/vouchers', voucher(`${PREFIX}X`)).expect(403);
      await as('SALES').get('/vouchers/usages').expect(403);
      await as('WAREHOUSE').get('/vouchers').expect(403);
    });
  });

  describe('Chương trình khuyến mãi', () => {
    it('tạo theo thể loại: trả tên thể loại + mã; trùng mã → 409', async () => {
      const res = await manager()
        .post('/promotions', promotion(`${PREFIX}-P1`, { applicableCategoryId: 'TN', applicableCategory: 'bỏ qua' }))
        .expect(201);
      expect(res.body).toMatchObject({
        id: `${PREFIX}-P1`,
        status: 'ACTIVE',
        applicableCategoryId: 'TN',
        applicableCategory: 'Thiếu nhi & Truyện tranh',
        maxDiscountAmount: 50000,
      });
      await manager().post('/promotions', promotion(`${PREFIX.toLowerCase()}-p1`)).expect(409);
    });

    it('hiệu lực theo ngày: bắt đầu tương lai → SCHEDULED; toàn cửa hàng → "Tất cả thể loại"', async () => {
      const res = await manager()
        .post('/promotions', promotion(`${PREFIX}-P2`, { startDate: addDays(today, 3), endDate: addDays(today, 5) }))
        .expect(201);
      expect(res.body).toMatchObject({ status: 'SCHEDULED', applicableCategory: 'Tất cả thể loại', applicableCategoryId: '' });
    });

    it.each([
      ['phần trăm > 100', { discountValue: 150 }],
      ['phần trăm < 1', { discountValue: 0.5 }],
      ['FIXED không nguyên', { discountType: 'FIXED', discountValue: 1000.5, maxDiscountAmount: null }],
      ['FIXED kèm mức tối đa', { discountType: 'FIXED', discountValue: 20000 }],
      ['giá trị giảm = 0', { discountValue: 0 }],
      ['ngày kết thúc < bắt đầu', { startDate: addDays(today, 5), endDate: addDays(today, 2) }],
      ['ngày kết thúc đã qua', { startDate: addDays(today, -5), endDate: addDays(today, -1) }],
      ['ngày không tồn tại', { endDate: '2027-02-30' }],
      ['thể loại không tồn tại', { applicableCategoryId: 'KHONG_CO' }],
      ['đơn tối thiểu âm', { minOrderValue: -1 }],
      ['thiếu tên', { name: '  ' }],
    ])('validation: %s → 400', async (_label, extra) => {
      const res = await manager().post('/promotions', promotion(`${PREFIX}-BAD`, extra)).expect(400);
      expect(typeof res.body.message).toBe('string');
    });

    it('tạm dừng → tiếp tục → hủy; đã hủy không sửa được nữa', async () => {
      const code = `${PREFIX}-P3`;
      await manager().post('/promotions', promotion(code)).expect(201);

      let res = await manager().patch(`/promotions/${code}`, promotion(code, { status: 'PAUSED' })).expect(200);
      expect(res.body.status).toBe('PAUSED');
      expect(findIn((await as('SALES').get('/promotions')).body, code)).toBeUndefined();

      res = await manager().patch(`/promotions/${code}`, promotion(code, { status: 'ACTIVE' })).expect(200);
      expect(res.body.status).toBe('ACTIVE');
      expect(findIn((await as('SALES').get('/promotions')).body, code)).toBeDefined();

      res = await manager().patch(`/promotions/${code}`, promotion(code, { status: 'CANCELLED' })).expect(200);
      expect(res.body.status).toBe('CANCELLED');
      await manager().patch(`/promotions/${code}`, promotion(code, { status: 'ACTIVE' })).expect(400);
      await manager().patch(`/promotions/${code}`, promotion(code, { name: 'Sửa' })).expect(400);
    });

    it('đã kết thúc theo ngày → EXPIRED, không sửa được; đổi mã → 400; không tồn tại → 404', async () => {
      const code = `${PREFIX}-OLD`;
      await prisma.chuongTrinhKhuyenMai.create({
        data: {
          maCTKM: code,
          tenCTKM: `${PREFIX} cũ`,
          loaiGiam: 'FIXED',
          giaTriGiam: 10000,
          ngayBatDau: dateOnly(addDays(today, -10)),
          ngayKetThuc: dateOnly(addDays(today, -1)),
          trangThai: 'PAUSED', // tạm dừng nhưng đã qua ngày kết thúc → EXPIRED
        },
      });
      expect(findIn((await manager().get('/promotions')).body, code)).toMatchObject({ status: 'EXPIRED' });
      await manager().patch(`/promotions/${code}`, promotion(code, { status: 'ACTIVE' })).expect(400);

      await manager().post('/promotions', promotion(`${PREFIX}-P4`)).expect(201);
      await manager().patch(`/promotions/${PREFIX}-P4`, promotion('KHAC-MA')).expect(400);
      await manager().patch('/promotions/KHONG_CO', promotion('KHONG_CO')).expect(404);
    });

    it('sửa chương trình không đổi tiền giảm đã lưu trên hóa đơn cũ', async () => {
      const code = `${PREFIX}-P5`;
      await manager().post('/promotions', promotion(code)).expect(201);
      await prisma.hoaDon.create({
        data: {
          maHoaDon: `${PREFIX}-HD-CTKM`,
          tongTienHang: 300000,
          tienGiamCTKM: 30000,
          thanhToanCuoi: 270000,
          maNV: `${PREFIX}-SALES`,
          maCTKM: code,
        },
      });
      await manager().patch(`/promotions/${code}`, promotion(code, { discountValue: 50, maxDiscountAmount: null })).expect(200);
      const invoice = await prisma.hoaDon.findUniqueOrThrow({ where: { maHoaDon: `${PREFIX}-HD-CTKM` } });
      expect(Number(invoice.tienGiamCTKM)).toBe(30000);
      expect(Number(invoice.thanhToanCuoi)).toBe(270000);
    });
  });

  describe('Voucher', () => {
    it('tạo: bỏ qua usedCount trong payload; trùng mã (không phân biệt hoa thường) → 409', async () => {
      const res = await manager().post('/vouchers', voucher(`${PREFIX}V1`, { usedCount: 5 })).expect(201);
      expect(res.body).toMatchObject({ id: `${PREFIX}V1`, usedCount: 0, status: 'ACTIVE', isActive: true });
      await manager().post('/vouchers', voucher(`${PREFIX.toLowerCase()}v1`)).expect(409);
    });

    it('bỏ trống mã → hệ thống sinh mã 8 ký tự', async () => {
      const res = await manager().post('/vouchers', voucher('')).expect(201);
      generatedCodes.push(res.body.code);
      expect(res.body.code).toMatch(/^[A-Z0-9]{8}$/);
    });

    it('validation: phần trăm > 100, lượt dùng 0, ngày sai → 400', async () => {
      await manager().post('/vouchers', voucher(`${PREFIX}B1`, { discountType: 'PERCENT', discountValue: 120 })).expect(400);
      await manager().post('/vouchers', voucher(`${PREFIX}B2`, { usageLimit: 0 })).expect(400);
      await manager().post('/vouchers', voucher(`${PREFIX}B3`, { endDate: addDays(today, -1), startDate: addDays(today, -3) })).expect(400);
      await manager().post('/vouchers', voucher('X!')).expect(400);
    });

    it('hết lượt → USED_UP; không giảm giới hạn dưới số đã dùng; tạm ngừng / mở lại', async () => {
      const code = `${PREFIX}V2`;
      await manager().post('/vouchers', voucher(code)).expect(201);
      await prisma.maGiamGia.update({ where: { maCode: code }, data: { soLanDaDung: 2 } }); // giả lập đã dùng 2 lượt

      expect(findIn((await manager().get('/vouchers')).body, code)).toMatchObject({ usedCount: 2, status: 'USED_UP' });
      const low = await manager().patch(`/vouchers/${code}`, voucher(code, { usageLimit: 1 })).expect(400);
      expect(low.body.message).toContain('(2)');
      let res = await manager().patch(`/vouchers/${code}`, voucher(code, { usageLimit: 3, usedCount: 0 })).expect(200);
      expect(res.body).toMatchObject({ usageLimit: 3, usedCount: 2, status: 'ACTIVE' });

      res = await manager().patch(`/vouchers/${code}`, voucher(code, { usageLimit: 3, isActive: false })).expect(200);
      expect(res.body.status).toBe('PAUSED');
      expect(findIn((await as('SALES').get('/vouchers')).body, code)).toBeUndefined();
      res = await manager().patch(`/vouchers/${code}`, voucher(code, { usageLimit: 3, isActive: true })).expect(200);
      expect(res.body.status).toBe('ACTIVE');
    });

    it('voucher hết hạn chỉ được xem; đổi mã → 400', async () => {
      const code = `${PREFIX}OLD`;
      await prisma.maGiamGia.create({
        data: {
          maCode: code,
          loaiGiam: 'FIXED',
          giaTriGiam: 10000,
          soLanToiDa: 5,
          ngayBatDau: dateOnly(addDays(today, -10)),
          hanSuDung: dateOnly(addDays(today, -1)),
        },
      });
      expect(findIn((await manager().get('/vouchers')).body, code)).toMatchObject({ status: 'EXPIRED' });
      await manager().patch(`/vouchers/${code}`, voucher(code)).expect(400);
      await manager().patch(`/vouchers/${PREFIX}V1`, voucher('MA-KHAC')).expect(400);
    });

    it('lịch sử sử dụng lấy từ hóa đơn thật; lọc theo mã', async () => {
      await prisma.hoaDon.create({
        data: {
          maHoaDon: `${PREFIX}-HD-VC`,
          tongTienHang: 200000,
          tienGiamVoucher: 30000,
          thanhToanCuoi: 170000,
          maNV: `${PREFIX}-SALES`,
          maCode: `${PREFIX}V1`,
        },
      });
      const filtered = await manager().get(`/vouchers/usages?code=${PREFIX.toLowerCase()}v1`).expect(200);
      expect(filtered.body).toEqual([
        expect.objectContaining({
          voucherCode: `${PREFIX}V1`,
          invoiceCode: `${PREFIX}-HD-VC`,
          customerName: 'Khách lẻ',
          discountAmount: 30000,
          orderTotal: 170000,
        }),
      ]);

      const all = await manager().get('/vouchers/usages').expect(200);
      expect(all.body.find((u: { invoiceCode: string }) => u.invoiceCode === 'HD-2011-1018')).toMatchObject({
        voucherCode: 'BANMOI15',
        customerName: 'Hoàng Gia Huy',
        discountAmount: 43500,
        orderTotal: 246500,
      });
    });
  });
});
