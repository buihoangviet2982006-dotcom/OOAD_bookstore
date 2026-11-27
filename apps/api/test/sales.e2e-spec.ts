/**
 * E2E Bán hàng & Hóa đơn – DB thật.
 * Dữ liệu thử (tạo trong beforeAll, dọn trong afterAll):
 * - nhân viên/tài khoản, sách, khách hàng, CTKM, voucher có mã bắt đầu "E2S";
 * - hóa đơn do các tài khoản E2S lập (mã HD-… sinh tự động) → dọn theo người lập.
 * Không dùng sách / khách / voucher của seed nên không đổi tồn, điểm, lượt dùng của seed.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { VaiTro } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/common/password.js';
import { todayInStore } from '../src/common/store-time.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PREFIX = 'E2S';
const PASSWORD = 'Matkhau@123';
const today = todayInStore();
const dayOffset = (days: number) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

type CartItem = { bookId: string; quantity: number };

describe('Bán hàng & Hóa đơn (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const tokens: Record<string, string> = {};

  const as = (who: string) => ({
    get: (url: string) => http().get(url).auth(tokens[who], { type: 'bearer' }),
    post: (url: string, body: object) => http().post(url).auth(tokens[who], { type: 'bearer' }).send(body),
    patch: (url: string, body: object) => http().patch(url).auth(tokens[who], { type: 'bearer' }).send(body),
  });
  const sales = () => as('SALES');

  const cart = (items: CartItem[], extra: object = {}) => ({ items, paymentMethod: 'TRANSFER', ...extra });
  const checkout = (items: CartItem[], extra: object = {}) =>
    cart(items, { requestKey: randomUUID(), ...extra });

  const stockOf = async (maSach: string) =>
    (await prisma.sach.findUniqueOrThrow({ where: { maSach } })).soLuongTon;
  const usedOf = async (maCode: string) =>
    (await prisma.maGiamGia.findUniqueOrThrow({ where: { maCode } })).soLanDaDung;
  const testInvoiceCount = () => prisma.hoaDon.count({ where: { maNV: { startsWith: PREFIX } } });

  async function cleanup() {
    const testInvoices = { hoaDon: { maNV: { startsWith: PREFIX } } };
    await prisma.thanhToan.deleteMany({ where: testInvoices });
    await prisma.chiTietHoaDon.deleteMany({ where: testInvoices });
    await prisma.hoaDon.deleteMany({ where: { maNV: { startsWith: PREFIX } } });
    await prisma.sach.deleteMany({ where: { maSach: { startsWith: PREFIX } } });
    await prisma.chuongTrinhKhuyenMai.deleteMany({ where: { maCTKM: { startsWith: PREFIX } } });
    await prisma.maGiamGia.deleteMany({ where: { maCode: { startsWith: PREFIX } } });
    await prisma.khachHang.deleteMany({ where: { maKH: { startsWith: PREFIX } } });
    await prisma.taiKhoan.deleteMany({ where: { maNV: { startsWith: PREFIX } } });
    await prisma.nhanVien.deleteMany({ where: { maNV: { startsWith: PREFIX } } });
  }

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
    const res = await http().post('/auth/login').send({ identifier: username, password: PASSWORD });
    tokens[key] = res.body.accessToken as string;
  }

  async function createBook(maSach: string, maTheLoai: string, giaBan: number, soLuongTon: number, extra = {}) {
    await prisma.sach.create({
      data: {
        maSach,
        isbn: `979${String(Math.abs(hash(maSach))).padStart(10, '0').slice(0, 10)}`,
        tenSach: `${PREFIX} Sách ${maSach}`,
        giaNhap: Math.round(giaBan * 0.6),
        giaBan,
        soLuongTon,
        maTheLoai,
        maTacGia: 'TG001',
        maNXB: 'NXB001',
        ...extra,
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

    await createStaff('MANAGER', 'MANAGER', '0933000001');
    await createStaff('SALES', 'SALES', '0933000002');
    await createStaff('SALES2', 'SALES', '0933000003');
    await createStaff('WAREHOUSE', 'WAREHOUSE', '0933000004');

    await createBook(`${PREFIX}-B1`, 'VH', 100000, 20);
    await createBook(`${PREFIX}-B2`, 'TN', 50000, 20);
    await createBook(`${PREFIX}-LAST`, 'VH', 80000, 1);
    await createBook(`${PREFIX}-X`, 'VH', 10000, 20);
    await createBook(`${PREFIX}-OFF`, 'VH', 90000, 5, { trangThai: 'DISCONTINUED' });

    await prisma.khachHang.create({ data: { maKH: `${PREFIX}-KH1`, hoTen: `${PREFIX} Khách`, soDienThoai: '0944000001' } });

    const promo = (maCTKM: string, data: object) =>
      prisma.chuongTrinhKhuyenMai.create({
        data: { maCTKM, tenCTKM: `${PREFIX} ${maCTKM}`, ngayBatDau: dayOffset(-1), ngayKetThuc: dayOffset(5), ...data } as never,
      });
    await promo(`${PREFIX}-KM-TN`, { loaiGiam: 'PERCENT', giaTriGiam: 10, maTheLoai: 'TN' });
    await promo(`${PREFIX}-KM-MIN`, { loaiGiam: 'FIXED', giaTriGiam: 20000, donToiThieu: 300000 });
    await promo(`${PREFIX}-KM-OLD`, { loaiGiam: 'FIXED', giaTriGiam: 20000, ngayBatDau: dayOffset(-9), ngayKetThuc: dayOffset(-2) });

    const voucher = (maCode: string, data: object) =>
      prisma.maGiamGia.create({
        data: { maCode, loaiGiam: 'FIXED', giaTriGiam: 10000, soLanToiDa: 100, ngayBatDau: dayOffset(-1), hanSuDung: dayOffset(5), ...data } as never,
      });
    await voucher(`${PREFIX}V-OK`, {});
    await voucher(`${PREFIX}V-LAST`, { giaTriGiam: 5000, soLanToiDa: 1 });
    await voucher(`${PREFIX}V-FULL`, { soLanToiDa: 1, soLanDaDung: 1 });
    await voucher(`${PREFIX}V-OLD`, { ngayBatDau: dayOffset(-9), hanSuDung: dayOffset(-2) });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('quyền: SALES/MANAGER dùng được; WAREHOUSE → 403; chưa đăng nhập → 401', async () => {
    await sales().get('/invoices').expect(200);
    await as('MANAGER').post('/invoices/preview', cart([{ bookId: `${PREFIX}-X`, quantity: 1 }])).expect(200);
    await as('WAREHOUSE').get('/invoices').expect(403);
    await as('WAREHOUSE').post('/invoices/preview', cart([{ bookId: `${PREFIX}-X`, quantity: 1 }])).expect(403);
    await http().get('/invoices').expect(401);
  });

  it('preview không ghi DB; lập hóa đơn ra đúng số tiền preview và ghi đủ trong 1 lần', async () => {
    const items = [
      { bookId: `${PREFIX}-B1`, quantity: 2 },
      { bookId: `${PREFIX}-B2`, quantity: 1 },
    ];
    const extra = { promotionId: `${PREFIX}-KM-TN`, voucherCode: `${PREFIX.toLowerCase()}v-ok`, customerId: `${PREFIX}-KH1` };
    const before = { b1: await stockOf(`${PREFIX}-B1`), b2: await stockOf(`${PREFIX}-B2`), used: await usedOf(`${PREFIX}V-OK`) };
    const invoicesBefore = await testInvoiceCount();

    const preview = await sales().post('/invoices/preview', cart(items, extra)).expect(200);
    // 250.000; CTKM 10% trên sách TN (50.000) = 5.000; voucher 10.000 → 235.000
    expect(preview.body).toMatchObject({
      valid: true,
      messages: [],
      subtotal: 250000,
      discountAmount: 15000,
      totalAmount: 235000,
      promotion: { applied: true, amount: 5000 },
      voucher: { code: `${PREFIX}V-OK`, applied: true, amount: 10000 },
    });
    expect(await stockOf(`${PREFIX}-B1`)).toBe(before.b1);
    expect(await usedOf(`${PREFIX}V-OK`)).toBe(before.used);
    expect(await testInvoiceCount()).toBe(invoicesBefore);

    const created = await sales()
      .post('/invoices', checkout(items, { ...extra, expectedTotal: preview.body.totalAmount }))
      .expect(201);
    expect(created.body).toMatchObject({
      subtotal: 250000,
      discountAmount: 15000,
      totalAmount: 235000,
      cashierId: `${PREFIX}-SALES`,
      customerId: `${PREFIX}-KH1`,
      voucherCode: `${PREFIX}V-OK`,
      promotionId: `${PREFIX}-KM-TN`,
      status: 'COMPLETED',
    });
    expect(created.body.code).toMatch(/^HD-\d{4}-\d+$/);
    expect(created.body.items.reduce((s: number, i: { discount: number }) => s + i.discount, 0)).toBe(15000);

    expect(await stockOf(`${PREFIX}-B1`)).toBe(before.b1 - 2);
    expect(await stockOf(`${PREFIX}-B2`)).toBe(before.b2 - 1);
    expect(await usedOf(`${PREFIX}V-OK`)).toBe(before.used + 1);
    expect((await prisma.khachHang.findUniqueOrThrow({ where: { maKH: `${PREFIX}-KH1` } })).diemTichLuy).toBe(23);
    const line = await prisma.chiTietHoaDon.findUniqueOrThrow({
      where: { maHoaDon_maSach: { maHoaDon: created.body.id, maSach: `${PREFIX}-B1` } },
    });
    expect(Number(line.giaVon)).toBe(60000);
  });

  it('không tin giá / tổng tiền / người lập do FE gửi', async () => {
    const res = await sales()
      .post(
        '/invoices',
        checkout([{ bookId: `${PREFIX}-X`, quantity: 1, unitPrice: 1, subtotal: 1 } as CartItem], {
          totalAmount: 1,
          discountAmount: 9999,
          cashierId: 'NV001',
          cashierName: 'Giả mạo',
        }),
      )
      .expect(201);
    expect(res.body).toMatchObject({ totalAmount: 10000, discountAmount: 0, cashierId: `${PREFIX}-SALES` });
    expect(res.body.items[0]).toMatchObject({ unitPrice: 10000, title: `${PREFIX} Sách ${PREFIX}-X` });
  });

  it('tiền mặt: thiếu tiền → 400, không nhập → 400, đủ → tính tiền thừa', async () => {
    const items = [{ bookId: `${PREFIX}-B2`, quantity: 1 }];
    await sales().post('/invoices', checkout(items, { paymentMethod: 'CASH', amountPaid: 49999 })).expect(400);
    await sales().post('/invoices', checkout(items, { paymentMethod: 'CASH' })).expect(400);
    const res = await sales().post('/invoices', checkout(items, { paymentMethod: 'CASH', amountPaid: 100000 })).expect(201);
    expect(res.body).toMatchObject({ totalAmount: 50000, amountPaid: 100000, changeAmount: 50000, paymentMethod: 'CASH' });
  });

  it('sách: ngừng kinh doanh, không tồn tại, thiếu tồn (gộp dòng trùng), số lượng sai', async () => {
    const offRes = await sales().post('/invoices', checkout([{ bookId: `${PREFIX}-OFF`, quantity: 1 }])).expect(400);
    expect(offRes.body.message).toContain('ngừng kinh doanh');
    await sales().post('/invoices', checkout([{ bookId: 'KHONG_CO', quantity: 1 }])).expect(400);

    const stock = await stockOf(`${PREFIX}-B1`);
    const half = Math.floor(stock / 2) + 1; // mỗi dòng ≤ tồn nhưng tổng 2 dòng > tồn
    const dup = await sales()
      .post('/invoices', checkout([{ bookId: `${PREFIX}-B1`, quantity: half }, { bookId: `${PREFIX}-B1`, quantity: half }]))
      .expect(400);
    expect(dup.body.message).toContain(`chỉ còn ${stock} cuốn`);
    expect(await stockOf(`${PREFIX}-B1`)).toBe(stock);

    await sales().post('/invoices', checkout([{ bookId: `${PREFIX}-B1`, quantity: 0 }])).expect(400);
    await sales().post('/invoices', checkout([])).expect(400);
  });

  it('CTKM: sai phạm vi, chưa đạt đơn tối thiểu, đã kết thúc → từ chối; preview báo lý do', async () => {
    const onlyVH = [{ bookId: `${PREFIX}-X`, quantity: 1 }];
    const scope = await sales().post('/invoices/preview', cart(onlyVH, { promotionId: `${PREFIX}-KM-TN` })).expect(200);
    expect(scope.body.valid).toBe(false);
    expect(scope.body.messages[0]).toContain('không có sách');
    await sales().post('/invoices', checkout(onlyVH, { promotionId: `${PREFIX}-KM-TN` })).expect(400);

    const min = await sales().post('/invoices', checkout(onlyVH, { promotionId: `${PREFIX}-KM-MIN` })).expect(400);
    expect(min.body.message).toContain('đơn tối thiểu');
    const old = await sales().post('/invoices', checkout(onlyVH, { promotionId: `${PREFIX}-KM-OLD` })).expect(400);
    expect(old.body.message).toContain('đã kết thúc');
  });

  it('voucher hết hạn / hết lượt / không tồn tại → từ chối', async () => {
    const items = [{ bookId: `${PREFIX}-X`, quantity: 1 }];
    const old = await sales().post('/invoices', checkout(items, { voucherCode: `${PREFIX}V-OLD` })).expect(400);
    expect(old.body.message).toContain('hết hạn');
    const full = await sales().post('/invoices', checkout(items, { voucherCode: `${PREFIX}V-FULL` })).expect(400);
    expect(full.body.message).toContain('hết lượt');
    await sales().post('/invoices', checkout(items, { voucherCode: 'KHONGCO' })).expect(400);
  });

  it('tổng tiền khác số khách đã thấy (expectedTotal) → 409, không ghi gì', async () => {
    const before = await testInvoiceCount();
    await sales().post('/invoices', checkout([{ bookId: `${PREFIX}-X`, quantity: 1 }], { expectedTotal: 9000 })).expect(409);
    expect(await testInvoiceCount()).toBe(before);
  });

  it('2 giao dịch tranh cuốn cuối: chỉ 1 thành công; bên thua rollback toàn bộ (kể cả dòng khác)', async () => {
    const xBefore = await stockOf(`${PREFIX}-X`);
    const invoicesBefore = await testInvoiceCount();
    const items = [
      { bookId: `${PREFIX}-X`, quantity: 1 },
      { bookId: `${PREFIX}-LAST`, quantity: 1 },
    ];
    const results = await Promise.all([
      sales().post('/invoices', checkout(items)),
      as('SALES2').post('/invoices', checkout(items)),
    ]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
    expect(await stockOf(`${PREFIX}-LAST`)).toBe(0);
    expect(await stockOf(`${PREFIX}-X`)).toBe(xBefore - 1); // bên thua không trừ X
    expect(await testInvoiceCount()).toBe(invoicesBefore + 1);
  });

  it('2 giao dịch tranh lượt voucher cuối: chỉ 1 thành công', async () => {
    const b2Before = await stockOf(`${PREFIX}-B2`);
    const items = [{ bookId: `${PREFIX}-B2`, quantity: 1 }];
    const results = await Promise.all([
      sales().post('/invoices', checkout(items, { voucherCode: `${PREFIX}V-LAST` })),
      as('SALES2').post('/invoices', checkout(items, { voucherCode: `${PREFIX}V-LAST` })),
    ]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
    expect(await usedOf(`${PREFIX}V-LAST`)).toBe(1);
    expect(await stockOf(`${PREFIX}-B2`)).toBe(b2Before - 1);
  });

  it('gửi lặp cùng requestKey (tuần tự và đồng thời) chỉ tạo 1 hóa đơn', async () => {
    const items = [{ bookId: `${PREFIX}-X`, quantity: 2 }];
    const xBefore = await stockOf(`${PREFIX}-X`);
    const before = await testInvoiceCount();

    const body = checkout(items);
    const first = await sales().post('/invoices', body).expect(201);
    const again = await sales().post('/invoices', body).expect(201);
    expect(again.body.id).toBe(first.body.id);

    const parallelBody = checkout(items);
    const parallel = await Promise.all([sales().post('/invoices', parallelBody), sales().post('/invoices', parallelBody)]);
    expect(parallel.every((r) => r.status === 201)).toBe(true);
    expect(parallel[0].body.id).toBe(parallel[1].body.id);

    expect(await testInvoiceCount()).toBe(before + 2);
    expect(await stockOf(`${PREFIX}-X`)).toBe(xBefore - 4);

    // khóa của nhân viên khác → 409
    await as('SALES2').post('/invoices', body).expect(409);
  });

  it('retry đúng nội dung vẫn nhận hóa đơn gốc dù tồn / lượt voucher đã hết sau giao dịch gốc', async () => {
    await createBook(`${PREFIX}-RETRY`, 'VH', 30000, 2);
    await prisma.maGiamGia.create({
      data: {
        maCode: `${PREFIX}V-ONCE`,
        loaiGiam: 'FIXED',
        giaTriGiam: 5000,
        soLanToiDa: 1,
        ngayBatDau: dayOffset(-1),
        hanSuDung: dayOffset(5),
      },
    });
    const body = checkout([{ bookId: `${PREFIX}-RETRY`, quantity: 2 }], {
      voucherCode: `${PREFIX}V-ONCE`,
      customerId: `${PREFIX}-KH1`,
      paymentMethod: 'CASH',
      amountPaid: 60000,
    });
    const first = await sales().post('/invoices', body).expect(201);
    expect(await stockOf(`${PREFIX}-RETRY`)).toBe(0);
    expect(await usedOf(`${PREFIX}V-ONCE`)).toBe(1);
    const points = (await prisma.khachHang.findUniqueOrThrow({ where: { maKH: `${PREFIX}-KH1` } })).diemTichLuy;

    // Cùng nội dung nghiệp vụ; khác các trường backend bỏ qua (giá, tổng, ghi chú, expectedTotal),
    // dòng tách đôi + mã voucher viết thường → vẫn là cùng nội dung.
    const retry = await sales()
      .post('/invoices', {
        ...body,
        items: [
          { bookId: `${PREFIX}-RETRY`, quantity: 1, unitPrice: 1 },
          { bookId: `${PREFIX}-RETRY`, quantity: 1 },
        ],
        voucherCode: `${PREFIX.toLowerCase()}v-once`,
        totalAmount: 1,
        note: 'ghi chú khác',
        expectedTotal: 999,
      })
      .expect(201);
    expect(retry.body.id).toBe(first.body.id);
    expect(retry.body.totalAmount).toBe(55000);
    // Không ghi thêm gì
    expect(await stockOf(`${PREFIX}-RETRY`)).toBe(0);
    expect(await usedOf(`${PREFIX}V-ONCE`)).toBe(1);
    expect((await prisma.khachHang.findUniqueOrThrow({ where: { maKH: `${PREFIX}-KH1` } })).diemTichLuy).toBe(points);
  });

  it('cùng requestKey nhưng khác giỏ / tiền khách đưa / khách → 409, không trả hóa đơn cũ, không ghi thêm', async () => {
    const body = checkout([{ bookId: `${PREFIX}-X`, quantity: 1 }], { paymentMethod: 'CASH', amountPaid: 20000 });
    const first = await sales().post('/invoices', body).expect(201);
    const before = await testInvoiceCount();
    const xBefore = await stockOf(`${PREFIX}-X`);

    const otherCart = await sales()
      .post('/invoices', { ...body, items: [{ bookId: `${PREFIX}-X`, quantity: 2 }] })
      .expect(409);
    expect(otherCart.body.message).toContain(first.body.id);
    expect(otherCart.body.message).toContain('nội dung khác');
    expect(otherCart.body.message).toContain('sách / số lượng');
    expect(otherCart.body).not.toHaveProperty('items');

    const otherCash = await sales().post('/invoices', { ...body, amountPaid: 50000 }).expect(409);
    expect(otherCash.body.message).toContain('tiền khách đưa');
    await sales().post('/invoices', { ...body, customerId: `${PREFIX}-KH1` }).expect(409);

    expect(await testInvoiceCount()).toBe(before);
    expect(await stockOf(`${PREFIX}-X`)).toBe(xBefore);
  });

  it('gửi lặp đồng thời mua cuốn cuối (cùng khóa) → cả 2 nhận cùng hóa đơn, không báo hết hàng', async () => {
    await createBook(`${PREFIX}-LAST2`, 'VH', 40000, 1);
    const body = checkout([{ bookId: `${PREFIX}-LAST2`, quantity: 1 }]);
    const results = await Promise.all([sales().post('/invoices', body), sales().post('/invoices', body)]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(results[0].body.id).toBe(results[1].body.id);
    expect(await stockOf(`${PREFIX}-LAST2`)).toBe(0);
  });

  it('sửa sách sau khi bán: hóa đơn cũ giữ nguyên tên, giá, tiền giảm', async () => {
    const created = await sales()
      .post('/invoices', checkout([{ bookId: `${PREFIX}-B2`, quantity: 1 }], { promotionId: `${PREFIX}-KM-TN` }))
      .expect(201);
    const book = await prisma.sach.findUniqueOrThrow({ where: { maSach: `${PREFIX}-B2` } });
    await as('MANAGER')
      .patch(`/books/${PREFIX}-B2`, {
        sku: `${PREFIX}-B2`,
        isbn: book.isbn,
        title: 'Tên mới',
        categoryId: 'TN',
        authorId: 'TG001',
        publisherId: 'NXB001',
        importPrice: 1,
        sellPrice: 999000,
        minStock: 0,
      })
      .expect(200);
    const after = await sales().get(`/invoices/${created.body.id}`).expect(200);
    expect(after.body.items[0]).toMatchObject({ title: `${PREFIX} Sách ${PREFIX}-B2`, unitPrice: 50000, discount: 5000 });
    expect(after.body).toMatchObject({ totalAmount: 45000, discountAmount: 5000 });
  });

  it('danh sách hóa đơn: dữ liệu seed map đúng (tiền khách đưa, tiền thừa, voucher)', async () => {
    const res = await sales().get('/invoices').expect(200);
    expect(res.body.find((i: { id: string }) => i.id === 'HD-2611-1042')).toMatchObject({
      customerId: 'KH001',
      subtotal: 619000,
      discountAmount: 50000,
      totalAmount: 569000,
      amountPaid: 600000,
      changeAmount: 31000,
      voucherCode: 'MOC50K',
      paymentMethod: 'CASH',
    });
  });
});

function hash(text: string): number {
  let h = 7;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}
