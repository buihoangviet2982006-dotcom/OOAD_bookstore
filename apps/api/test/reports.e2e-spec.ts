/**
 * E2E Báo cáo & Tổng quan – DB thật.
 * Dữ liệu thử mã "E2R" (nhân viên/tài khoản, sách, hóa đơn, phiếu đổi/trả) ghi thẳng vào DB với ngày năm 2020
 * → kỳ báo cáo không dính dữ liệu seed (seed năm 2026). Dọn trong beforeAll/afterAll theo tiền tố.
 *
 * Kỳ 01/03 – 03/03/2020 (giờ VN), kỳ trước 27/02 – 29/02/2020:
 * - HD1 01/03 10:00: A×2 giá 100.000 giảm 20.000 (vốn 60.000), B×1 giá 50.000 (vốn 30.000) → 230.000.
 * - HD0 28/02 15:00 (kỳ trước): B×1 giá 50.000 giảm 5.000 (vốn 30.000) → 45.000.
 * - RT1 02/03 23:30: trả 1 A của HD1, giá trị 90.000 → hoàn 90.000.
 * - RT2 03/03 00:10: đổi 1 B của HD0 (giá trị 45.000) sang C giá 70.000 (vốn 40.000) → khách bù 25.000.
 * Kỳ này: doanh thu thuần 165.000, giá vốn thuần 150.000 − 90.000 + 40.000 = 100.000, lợi nhuận 65.000.
 * Kỳ trước: doanh thu 45.000, giá vốn 30.000, lợi nhuận 15.000.
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

const PREFIX = 'E2R';
const PASSWORD = 'Matkhau@123';
const PERIOD = 'from=2020-03-01&to=2020-03-03';

describe('Báo cáo & Tổng quan (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const tokens: Record<string, string> = {};
  const get = (who: string, url: string) => http().get(url).auth(tokens[who], { type: 'bearer' });
  const id = (s: string) => `${PREFIX}-${s}`;

  async function cleanup() {
    const testDoc = { startsWith: PREFIX };
    await prisma.chiTietDoiTra.deleteMany({ where: { maDoiTra: testDoc } });
    await prisma.phieuDoiTra.deleteMany({ where: { maDoiTra: testDoc } });
    await prisma.chiTietHoaDon.deleteMany({ where: { maHoaDon: testDoc } });
    await prisma.hoaDon.deleteMany({ where: { maHoaDon: testDoc } });
    await prisma.sach.deleteMany({ where: { maSach: testDoc } });
    await prisma.taiKhoan.deleteMany({ where: { maNV: testDoc } });
    await prisma.nhanVien.deleteMany({ where: { maNV: testDoc } });
  }

  async function createStaff(key: string, role: VaiTro, phone: string) {
    const maNV = id(key);
    const username = maNV.toLowerCase();
    await prisma.nhanVien.create({
      data: { maNV, hoTen: `${PREFIX} ${key}`, soDienThoai: phone, email: `${username}@test.local`, ngayVaoLam: new Date('2019-01-01'), boPhan: role, chucVu: 'Test' },
    });
    await prisma.taiKhoan.create({
      data: { maTaiKhoan: maNV, tenDangNhap: username, emailKhoiPhuc: `${username}@test.local`, matKhauHash: await hashPassword(PASSWORD), vaiTro: role, maNV },
    });
    tokens[key] = (await http().post('/auth/login').send({ identifier: username, password: PASSWORD })).body.accessToken;
  }

  async function invoice(code: string, at: string, lines: [book: string, qty: number, price: number, discount: number, cost: number][]) {
    const gross = lines.reduce((s, [, q, p]) => s + q * p, 0);
    const discount = lines.reduce((s, [, , , d]) => s + d, 0);
    await prisma.hoaDon.create({
      data: {
        maHoaDon: id(code),
        ngayLap: new Date(at),
        tongTienHang: gross,
        tienGiamCTKM: discount,
        thanhToanCuoi: gross - discount,
        maNV: id('SALES'),
        chiTiets: {
          create: lines.map(([book, q, p, d, c]) => ({ maSach: id(book), tenSach: `${PREFIX} Sách ${book}`, soLuongBan: q, donGiaBan: p, giamGia: d, giaVon: c })),
        },
      },
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    await createStaff('MANAGER', 'MANAGER', '0912300401');
    await createStaff('SALES', 'SALES', '0912300402');
    await createStaff('WAREHOUSE', 'WAREHOUSE', '0912300403');
    for (const [i, book] of ['A', 'B', 'C'].entries()) {
      await prisma.sach.create({
        data: { maSach: id(book), isbn: `97900000${String(800 + i).padStart(5, '0')}`, tenSach: `${PREFIX} Sách ${book}`, giaNhap: 1, giaBan: 1, soLuongTon: 10, maTheLoai: 'VH', maTacGia: 'TG001', maNXB: 'NXB001' },
      });
    }

    await invoice('HD0', '2020-02-28T15:00:00+07:00', [['B', 1, 50_000, 5_000, 30_000]]);
    await invoice('HD1', '2020-03-01T10:00:00+07:00', [
      ['A', 2, 100_000, 20_000, 60_000],
      ['B', 1, 50_000, 0, 30_000],
    ]);
    await prisma.phieuDoiTra.create({
      data: {
        maDoiTra: id('RT1'), ngayDoiTra: new Date('2020-03-02T23:30:00+07:00'), lyDo: 'Thử', hinhThucXuLy: 'RETURN',
        tienHoanTra: 90_000, maHoaDon: id('HD1'), maNV: id('SALES'),
        chiTiets: { create: [{ maSach: id('A'), soLuongTra: 1, tinhTrangSach: 'Tốt', donGiaHoan: 90_000, giaTriTra: 90_000 }] },
      },
    });
    await prisma.phieuDoiTra.create({
      data: {
        maDoiTra: id('RT2'), ngayDoiTra: new Date('2020-03-03T00:10:00+07:00'), lyDo: 'Thử', hinhThucXuLy: 'EXCHANGE',
        tienKhachBu: 25_000, maHoaDon: id('HD0'), maNV: id('SALES'),
        chiTiets: {
          create: [{ maSach: id('B'), soLuongTra: 1, tinhTrangSach: 'Tốt', donGiaHoan: 45_000, giaTriTra: 45_000, maSachDoi: id('C'), donGiaSachDoi: 70_000, giaVonSachDoi: 40_000 }],
        },
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('quyền: báo cáo chỉ MANAGER; tổng quan mọi vai trò; chưa đăng nhập → 401', async () => {
    for (const url of [`/reports/revenue?${PERIOD}`, `/reports/bestsellers?${PERIOD}`]) {
      await get('MANAGER', url).expect(200);
      await get('SALES', url).expect(403);
      await get('WAREHOUSE', url).expect(403);
    }
    await http().get(`/dashboard/summary?${PERIOD}`).expect(401);
  });

  it('doanh thu thuần / giá vốn thuần / lợi nhuận khớp số tính tay, kỳ trước đúng', async () => {
    const { body } = await get('MANAGER', `/reports/revenue?${PERIOD}`).expect(200);
    expect(body).toMatchObject({ from: '2020-03-01', to: '2020-03-03', previousFrom: '2020-02-27', previousTo: '2020-02-29' });
    expect(body.totals).toEqual({
      invoiceAmount: 230_000, exchangeIn: 25_000, refunds: 90_000, revenue: 165_000,
      saleCost: 150_000, returnedCost: 90_000, exchangeOutCost: 40_000, cost: 100_000, profit: 65_000,
      orders: 1, booksSold: 2,
    });
    expect(body.previousTotals).toMatchObject({ revenue: 45_000, cost: 30_000, profit: 15_000, orders: 1 });
    expect(body.series.map((p: { label: string; revenue: number; profit: number }) => [p.label, p.revenue, p.profit])).toEqual([
      ['01/03', 230_000, 80_000],
      ['02/03', -90_000, -30_000],
      ['03/03', 25_000, 15_000],
    ]);
  });

  it('sách bán chạy: số lượng thuần, tổng doanh thu = doanh thu thuần', async () => {
    const { body } = await get('MANAGER', `/reports/bestsellers?${PERIOD}`).expect(200);
    expect(body.map((r: { bookId: string; netQty: number; revenue: number }) => [r.bookId, r.netQty, r.revenue])).toEqual([
      [id('A'), 1, 90_000],
      [id('C'), 1, 70_000],
      [id('B'), 0, 5_000],
    ]);
  });

  it('kỳ không hợp lệ → 400', async () => {
    await get('MANAGER', '/reports/revenue?from=2020-03-05&to=2020-03-01').expect(400);
    await get('MANAGER', '/reports/revenue?from=2020-02-30&to=2020-03-01').expect(400);
    await get('MANAGER', '/reports/revenue?from=2019-01-01&to=2020-03-01').expect(400);
    await get('MANAGER', '/reports/revenue?from=2020-03-01').expect(400);
  });

  it('tổng quan theo vai trò: MANAGER có doanh thu; SALES chỉ số liệu của mình; WAREHOUSE số liệu kho', async () => {
    const cardsOf = async (who: string) => {
      const { body } = await get(who, `/dashboard/summary?${PERIOD}`).expect(200);
      return Object.fromEntries(body.cards.map((c: { key: string }) => [c.key, c]));
    };

    const manager = await cardsOf('MANAGER');
    expect(manager.revenue).toMatchObject({ value: 165_000, previous: 45_000, series: [230_000, -90_000, 25_000] });
    expect(manager.orders).toMatchObject({ value: 1, previous: 1 });

    const sales = await cardsOf('SALES');
    expect(Object.keys(sales)).toEqual(['myOrders', 'myBooksSold', 'myReturns', 'newCustomers']);
    expect(sales.myOrders).toMatchObject({ value: 1, previous: 1 });
    expect(sales.myBooksSold).toMatchObject({ value: 3, previous: 1 });
    expect(sales.myReturns).toMatchObject({ value: 2, previous: 0 });

    const warehouse = await cardsOf('WAREHOUSE');
    expect(Object.keys(warehouse)).toEqual(['imports', 'importedQty', 'audits', 'lowStock']);
    expect(warehouse.lowStock).toMatchObject({ previous: null, series: null });
  });
});
