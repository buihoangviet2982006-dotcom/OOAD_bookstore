/**
 * E2E Nhập hàng + Thanh toán NCC – DB thật.
 * Dữ liệu thử (tạo trong beforeAll, dọn trong afterAll): nhân viên/tài khoản, NCC, sách, hóa đơn có mã "E2N";
 * phiếu nhập / phiếu chi (mã PN-… / PC-… tự sinh) do tài khoản E2N lập → dọn theo người lập.
 * Không dùng dữ liệu seed.
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

const PREFIX = 'E2N';
const PASSWORD = 'Matkhau@123';

function dayOffset(days: number): string {
  const d = new Date(`${todayInStore()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('Nhập hàng & Thanh toán NCC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const tokens: Record<string, string> = {};

  const as = (who: string) => ({
    get: (url: string) => http().get(url).auth(tokens[who], { type: 'bearer' }),
    post: (url: string, body: object) => http().post(url).auth(tokens[who], { type: 'bearer' }).send(body),
  });
  const wh = () => as('WAREHOUSE');

  const id = (s: string) => `${PREFIX}-${s}`;
  const book = (key: string) => prisma.sach.findUniqueOrThrow({ where: { maSach: id(key) } });
  const testOrderCount = () => prisma.phieuNhap.count({ where: { maNV: { startsWith: PREFIX } } });
  const testPaymentCount = () => prisma.phieuThanhToanNCC.count({ where: { maNV: { startsWith: PREFIX } } });

  const po = (items: [string, number, number][], extra: object = {}) => ({
    supplierId: id('NCC1'),
    items: items.map(([b, quantity, importPrice]) => ({ bookId: id(b), quantity, importPrice })),
    paidAmount: 0,
    dueDate: dayOffset(10),
    requestKey: randomUUID(),
    ...extra,
  });
  const pay = (orderId: string, amount: number, extra: object = {}) => ({
    supplierId: id('NCC1'),
    purchaseOrderId: orderId,
    amount,
    paymentMethod: 'TRANSFER',
    requestKey: randomUUID(),
    ...extra,
  });
  const orderOf = async (code: string) =>
    (await wh().get('/imports').expect(200)).body.find((o: { id: string }) => o.id === code);

  async function cleanup() {
    const byTestStaff = { maNV: { startsWith: PREFIX } };
    await prisma.phieuThanhToanNCC.deleteMany({ where: { OR: [byTestStaff, { phieuNhap: byTestStaff }] } });
    await prisma.chiTietPhieuNhap.deleteMany({ where: { phieuNhap: byTestStaff } });
    await prisma.phieuNhap.deleteMany({ where: byTestStaff });
    await prisma.chiTietHoaDon.deleteMany({ where: { maHoaDon: { startsWith: PREFIX } } });
    await prisma.hoaDon.deleteMany({ where: { maHoaDon: { startsWith: PREFIX } } });
    await prisma.sach.deleteMany({ where: { maSach: { startsWith: PREFIX } } });
    await prisma.nhaCungCap.deleteMany({ where: { maNCC: { startsWith: PREFIX } } });
    await prisma.taiKhoan.deleteMany({ where: byTestStaff });
    await prisma.nhanVien.deleteMany({ where: byTestStaff });
  }

  async function createStaff(key: string, role: VaiTro, phone: string) {
    const maNV = id(key);
    const username = maNV.toLowerCase();
    await prisma.nhanVien.create({
      data: { maNV, hoTen: `${PREFIX} ${key}`, soDienThoai: phone, email: `${username}@test.local`, ngayVaoLam: new Date('2026-01-01'), boPhan: role, chucVu: 'Test' },
    });
    await prisma.taiKhoan.create({
      data: { maTaiKhoan: maNV, tenDangNhap: username, emailKhoiPhuc: `${username}@test.local`, matKhauHash: await hashPassword(PASSWORD), vaiTro: role, maNV },
    });
    tokens[key] = (await http().post('/auth/login').send({ identifier: username, password: PASSWORD })).body.accessToken;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    await createStaff('MANAGER', 'MANAGER', '0911100001');
    await createStaff('WAREHOUSE', 'WAREHOUSE', '0911100002');
    await createStaff('WAREHOUSE2', 'WAREHOUSE', '0911100003');
    await createStaff('SALES', 'SALES', '0911100004');

    await prisma.nhaCungCap.createMany({
      data: [
        { maNCC: id('NCC1'), tenNCC: `${PREFIX} NCC 1`, soDienThoai: '02811100001' },
        { maNCC: id('NCC2'), tenNCC: `${PREFIX} NCC 2`, soDienThoai: '02811100002' },
        { maNCC: id('OFF'), tenNCC: `${PREFIX} NCC ngừng`, soDienThoai: '02811100003', trangThai: 'INACTIVE' },
      ],
    });
    const books = [
      ['B1', 10000, 5, 'ACTIVE'],
      ['B2', 15000, 0, 'ACTIVE'],
      ['DIS', 20000, 2, 'DISCONTINUED'],
    ] as const;
    for (const [i, [key, giaNhap, soLuongTon, trangThai]] of books.entries()) {
      await prisma.sach.create({
        data: {
          maSach: id(key),
          isbn: `97900000${String(500 + i).padStart(5, '0')}`,
          tenSach: `${PREFIX} Sách ${key}`,
          giaNhap,
          giaBan: giaNhap * 2,
          soLuongTon,
          trangThai,
          maTheLoai: 'VH',
          maTacGia: 'TG001',
          maNXB: 'NXB001',
        },
      });
    }
    // Hóa đơn cũ có B1 với giá vốn 10.000 – nhập giá mới không được làm đổi.
    await prisma.hoaDon.create({
      data: {
        maHoaDon: id('HD-CU'),
        tongTienHang: 20000,
        thanhToanCuoi: 20000,
        maNV: id('MANAGER'),
        chiTiets: { create: { maSach: id('B1'), tenSach: `${PREFIX} Sách B1`, soLuongBan: 1, donGiaBan: 20000, giaVon: 10000 } },
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('quyền: WAREHOUSE/MANAGER dùng được; SALES → 403; chưa đăng nhập → 401', async () => {
    await wh().get('/imports').expect(200);
    await as('MANAGER').get('/supplier-payments').expect(200);
    await as('SALES').get('/imports').expect(403);
    await as('SALES').post('/supplier-payments', pay('X', 1)).expect(403);
    await http().get('/imports').expect(401);
  });

  it('lập phiếu nhập có trả trước: tổng/nợ do backend tính, cộng tồn, cập nhật giá nhập, đúng 1 phiếu chi', async () => {
    const paymentsBefore = await testPaymentCount();
    const res = await wh()
      .post('/imports', {
        ...po([['B1', 10, 12000], ['B2', 5, 20000]], { paidAmount: 50000, prepaymentMethod: 'CASH' }),
        totalAmount: 1,
        debtAmount: 0,
        createdBy: 'Giả mạo',
        supplierName: 'Giả mạo',
      })
      .expect(201);
    expect(res.body).toMatchObject({
      supplierId: id('NCC1'),
      supplierName: `${PREFIX} NCC 1`,
      createdBy: `${PREFIX} WAREHOUSE`,
      totalAmount: 220000,
      paidAmount: 50000,
      debtAmount: 170000,
      dueDate: dayOffset(10),
      debtStatus: 'PARTIAL',
    });
    expect(res.body.code).toMatch(/^PN-\d{4}-\d+$/);
    expect((await book('B1')).soLuongTon).toBe(15);
    expect(Number((await book('B1')).giaNhap)).toBe(12000);
    expect((await book('B2')).soLuongTon).toBe(5);

    // Trả trước: đúng 1 phiếu chi, da_thanh_toan = Σ phiếu chi (không tính hai lần)
    expect(await testPaymentCount()).toBe(paymentsBefore + 1);
    const payments = await prisma.phieuThanhToanNCC.findMany({ where: { maPhieuNhap: res.body.id } });
    expect(payments.map((p) => [Number(p.soTienThanhToan), p.phuongThuc])).toEqual([[50000, 'CASH']]);

    const listed = (await wh().get('/supplier-payments').expect(200)).body.find(
      (p: { purchaseOrderId: string }) => p.purchaseOrderId === res.body.id,
    );
    expect(listed).toMatchObject({ amount: 50000, supplierId: id('NCC1'), recordedBy: `${PREFIX} WAREHOUSE` });

    const supplier = (await wh().get('/suppliers').expect(200)).body.find((s: { id: string }) => s.id === id('NCC1'));
    expect(supplier).toMatchObject({ totalImportAmount: 220000, currentDebt: 170000, dueDate: dayOffset(10) });

    // Giá vốn trên hóa đơn cũ không đổi
    const oldLine = await prisma.chiTietHoaDon.findFirstOrThrow({ where: { maHoaDon: id('HD-CU') } });
    expect(Number(oldLine.giaVon)).toBe(10000);
  });

  it('không trả trước → UNPAID, không tạo phiếu chi; trả đủ ngay → PAID, không cần hạn', async () => {
    const before = await testPaymentCount();
    const unpaid = await wh().post('/imports', po([['B2', 1, 15000]])).expect(201);
    expect(unpaid.body).toMatchObject({ paidAmount: 0, debtAmount: 15000, debtStatus: 'UNPAID' });
    expect(await testPaymentCount()).toBe(before);

    const full = await wh().post('/imports', po([['B2', 1, 15000]], { paidAmount: 15000, dueDate: null })).expect(201);
    expect(full.body).toMatchObject({ debtAmount: 0, debtStatus: 'PAID', dueDate: null });
  });

  it('sách ngừng kinh doanh: cộng tồn nhưng giữ DISCONTINUED', async () => {
    await wh().post('/imports', po([['DIS', 3, 20000]])).expect(201);
    const dis = await book('DIS');
    expect(dis.soLuongTon).toBe(5);
    expect(dis.trangThai).toBe('DISCONTINUED');
  });

  it('dòng trùng sách: cùng giá → gộp; khác giá → 400', async () => {
    const merged = await wh().post('/imports', po([['B2', 2, 15000], ['B2', 3, 15000]])).expect(201);
    expect(merged.body.items).toEqual([expect.objectContaining({ bookId: id('B2'), quantity: 5, subtotal: 75000 })]);
    const diff = await wh().post('/imports', po([['B2', 2, 15000], ['B2', 3, 16000]])).expect(400);
    expect(diff.body.message).toContain('giá nhập khác nhau');
  });

  it.each([
    ['số lượng 0', { items: [{ bookId: `${PREFIX}-B1`, quantity: 0, importPrice: 1000 }] }],
    ['giá nhập 0', { items: [{ bookId: `${PREFIX}-B1`, quantity: 1, importPrice: 0 }] }],
    ['không có dòng', { items: [] }],
    ['sách không tồn tại', { items: [{ bookId: 'KHONG_CO', quantity: 1, importPrice: 1000 }] }],
    ['NCC không tồn tại', { supplierId: 'KHONG_CO' }],
    ['trả trước > tổng', { paidAmount: 999999 }],
    ['còn nợ nhưng thiếu hạn', { dueDate: null }],
    ['hạn ở quá khứ', { dueDate: dayOffset(-1) }],
  ])('validation: %s → 400', async (_label, extra) => {
    const before = { orders: await testOrderCount(), stock: (await book('B1')).soLuongTon };
    await wh().post('/imports', po([['B1', 1, 1000]], extra)).expect(400);
    expect(await testOrderCount()).toBe(before.orders);
    expect((await book('B1')).soLuongTon).toBe(before.stock);
  });

  it('NCC ngừng hợp tác: không nhập mới, nhưng vẫn trả được nợ cũ', async () => {
    const res = await wh().post('/imports', po([['B1', 1, 30000]], { supplierId: id('OFF') })).expect(400);
    expect(res.body.message).toContain('ngừng hợp tác');

    // Phiếu nhập cũ của NCC này (lập khi còn hợp tác)
    await prisma.nhaCungCap.update({ where: { maNCC: id('OFF') }, data: { trangThai: 'ACTIVE' } });
    const old = await wh().post('/imports', po([['B1', 1, 30000]], { supplierId: id('OFF') })).expect(201);
    await prisma.nhaCungCap.update({ where: { maNCC: id('OFF') }, data: { trangThai: 'INACTIVE' } });

    const paid = await wh().post('/supplier-payments', pay(old.body.id, 30000, { supplierId: id('OFF') })).expect(201);
    expect(paid.body).toMatchObject({ supplierId: id('OFF'), amount: 30000 });
    expect((await orderOf(old.body.id)).debtStatus).toBe('PAID');
  });

  it('thanh toán từng phần → PARTIAL → PAID; vượt nợ / sai NCC / thiếu phiếu / số tiền sai → 400', async () => {
    const order = (await wh().post('/imports', po([['B1', 10, 10000]])).expect(201)).body; // nợ 100.000
    await wh().post('/supplier-payments', pay(order.id, 40000)).expect(201);
    expect(await orderOf(order.id)).toMatchObject({ paidAmount: 40000, debtAmount: 60000, debtStatus: 'PARTIAL' });

    const over = await wh().post('/supplier-payments', pay(order.id, 60001)).expect(400);
    expect(over.body.message).toContain('vượt quá số nợ còn lại');
    const wrong = await wh().post('/supplier-payments', pay(order.id, 1000, { supplierId: id('NCC2') })).expect(400);
    expect(wrong.body.message).toContain('không thuộc nhà cung cấp');
    await wh().post('/supplier-payments', { ...pay(order.id, 1000), purchaseOrderId: '' }).expect(400);
    await wh().post('/supplier-payments', pay('KHONG_CO', 1000)).expect(404);
    await wh().post('/supplier-payments', pay(order.id, 0)).expect(400);

    const last = await wh().post('/supplier-payments', { ...pay(order.id, 60000), recordedBy: 'Giả mạo' }).expect(201);
    expect(last.body.recordedBy).toBe(`${PREFIX} WAREHOUSE`);
    expect(await orderOf(order.id)).toMatchObject({ paidAmount: 100000, debtAmount: 0, debtStatus: 'PAID' });
    const done = await wh().post('/supplier-payments', pay(order.id, 1)).expect(400);
    expect(done.body.message).toContain('đã thanh toán đủ');
  });

  it('quá hạn → OVERDUE; trả hết thì PAID dù đã qua hạn', async () => {
    const order = (await wh().post('/imports', po([['B1', 2, 10000]])).expect(201)).body;
    await prisma.phieuNhap.update({
      where: { maPhieuNhap: order.id },
      data: { hanThanhToan: new Date(`${dayOffset(-3)}T00:00:00Z`) },
    });
    expect((await orderOf(order.id)).debtStatus).toBe('OVERDUE');
    await wh().post('/supplier-payments', pay(order.id, 20000)).expect(201);
    expect((await orderOf(order.id)).debtStatus).toBe('PAID');
  });

  it('2 thanh toán đồng thời cho số nợ cuối: chỉ 1 thành công, không vượt nợ', async () => {
    const order = (await wh().post('/imports', po([['B1', 5, 10000]])).expect(201)).body; // nợ 50.000
    const before = await testPaymentCount();
    const results = await Promise.all([
      wh().post('/supplier-payments', pay(order.id, 50000)),
      as('WAREHOUSE2').post('/supplier-payments', pay(order.id, 50000)),
    ]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
    expect(await testPaymentCount()).toBe(before + 1);
    expect(await orderOf(order.id)).toMatchObject({ paidAmount: 50000, debtAmount: 0 });
  });

  it('2 phiếu nhập đồng thời: mã không trùng, tồn cộng đủ cả hai', async () => {
    const stock = (await book('B2')).soLuongTon;
    const [a, b] = await Promise.all([
      wh().post('/imports', po([['B2', 2, 15000]])),
      as('WAREHOUSE2').post('/imports', po([['B2', 3, 15000]])),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.id).not.toBe(b.body.id);
    expect((await book('B2')).soLuongTon).toBe(stock + 5);
  });

  it('phiếu nhập gửi lặp: cùng nội dung → phiếu cũ (kể cả đồng thời), tồn chỉ cộng 1 lần; khác nội dung → 409', async () => {
    const stock = (await book('B1')).soLuongTon;
    const before = await testOrderCount();
    const body = po([['B1', 4, 10000]], { paidAmount: 10000 });

    const first = await wh().post('/imports', body).expect(201);
    // Có thêm thanh toán sau đó vẫn nhận lại đúng phiếu (so khoản trả trước, không so đã trả hiện tại)
    await wh().post('/supplier-payments', pay(first.body.id, 5000)).expect(201);
    const again = await wh().post('/imports', { ...body, note: 'ghi chú khác', totalAmount: 1 }).expect(201);
    expect(again.body.id).toBe(first.body.id);

    const parallelBody = po([['B1', 1, 10000]]);
    const parallel = await Promise.all([wh().post('/imports', parallelBody), wh().post('/imports', parallelBody)]);
    expect(parallel.every((r) => r.status === 201)).toBe(true);
    expect(parallel[0].body.id).toBe(parallel[1].body.id);

    expect(await testOrderCount()).toBe(before + 2);
    expect((await book('B1')).soLuongTon).toBe(stock + 5);

    const other = await wh().post('/imports', { ...body, items: [{ bookId: id('B1'), quantity: 5, importPrice: 10000 }] }).expect(409);
    expect(other.body.message).toContain(first.body.id);
    await as('WAREHOUSE2').post('/imports', body).expect(409);
  });

  it('thanh toán gửi lặp: cùng nội dung → phiếu chi cũ; khác số tiền → 409', async () => {
    const order = (await wh().post('/imports', po([['B1', 3, 10000]])).expect(201)).body;
    const body = pay(order.id, 10000);
    const first = await wh().post('/supplier-payments', body).expect(201);
    const again = await wh().post('/supplier-payments', { ...body, note: 'khác' }).expect(201);
    expect(again.body.id).toBe(first.body.id);
    await wh().post('/supplier-payments', { ...body, amount: 20000 }).expect(409);
    expect(await orderOf(order.id)).toMatchObject({ paidAmount: 10000 });
  });

  it('thanh toán gửi lặp đồng thời trả hết nợ (cùng khóa) → cả 2 nhận cùng phiếu chi, không báo vượt nợ', async () => {
    const order = (await wh().post('/imports', po([['B1', 2, 10000]])).expect(201)).body;
    const body = pay(order.id, 20000);
    const results = await Promise.all([wh().post('/supplier-payments', body), wh().post('/supplier-payments', body)]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(results[0].body.id).toBe(results[1].body.id);
    expect(await orderOf(order.id)).toMatchObject({ paidAmount: 20000, debtStatus: 'PAID' });
  });

  it('dữ liệu seed map đúng: PN-1011-298 quá hạn, PN-0511-290 đã trả đủ', async () => {
    const list = (await wh().get('/imports').expect(200)).body;
    expect(list.find((o: { id: string }) => o.id === 'PN-1011-298')).toMatchObject({
      supplierId: 'NCC002',
      totalAmount: 950000,
      paidAmount: 300000,
      debtAmount: 650000,
      dueDate: '2026-11-24',
      debtStatus: 'OVERDUE',
    });
    expect(list.find((o: { id: string }) => o.id === 'PN-0511-290')).toMatchObject({ debtStatus: 'PAID', debtAmount: 0 });
  });
});
