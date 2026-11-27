/**
 * E2E Đổi / trả hàng – DB thật.
 * Dữ liệu thử (tạo trong beforeAll, dọn trong afterAll): nhân viên/tài khoản, sách, khách hàng, hóa đơn gốc
 * có mã bắt đầu "E2R"; phiếu đổi/trả (mã DT-… tự sinh) do tài khoản E2R lập → dọn theo người xử lý.
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

const PREFIX = 'E2R';
const PASSWORD = 'Matkhau@123';

/** Thời điểm 10:00 giờ Việt Nam của ngày (hôm nay + days). */
function vnDay(days: number): Date {
  const d = new Date(`${todayInStore()}T10:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

type Line = { book: string; qty: number; price: number; discount?: number };

describe('Đổi / trả hàng (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const tokens: Record<string, string> = {};

  const as = (who: string) => ({
    get: (url: string) => http().get(url).auth(tokens[who], { type: 'bearer' }),
    post: (url: string, body: object) => http().post(url).auth(tokens[who], { type: 'bearer' }).send(body),
  });
  const sales = () => as('SALES');

  const id = (s: string) => `${PREFIX}-${s}`;
  const stockOf = async (book: string) => (await prisma.sach.findUniqueOrThrow({ where: { maSach: id(book) } })).soLuongTon;
  const pointsOf = async (kh: string) => (await prisma.khachHang.findUniqueOrThrow({ where: { maKH: id(kh) } })).diemTichLuy;
  const statusOf = async (hd: string) => (await prisma.hoaDon.findUniqueOrThrow({ where: { maHoaDon: id(hd) } })).trangThai;
  const testReturnCount = () => prisma.phieuDoiTra.count({ where: { maNV: { startsWith: PREFIX } } });

  /** Body phiếu: mặc định trả hàng 1 dòng. */
  const ret = (invoice: string, items: [string, number][], extra: object = {}) => ({
    invoiceId: id(invoice),
    type: 'RETURN',
    returnItems: items.map(([book, quantity]) => ({ bookId: id(book), quantity, condition: 'Còn mới' })),
    reason: 'Thử nghiệm',
    requestKey: randomUUID(),
    // Default confirmation for invalid EXCHANGE cases; successful cases override these below.
    ...((extra as { type?: string }).type === 'EXCHANGE' ? { expectedRefundAmount: 0, expectedExtraPayment: 0 } : {}),
    ...extra,
  });

  async function cleanup() {
    const testReturns = { phieuDoiTra: { maNV: { startsWith: PREFIX } } };
    await prisma.chiTietDoiTra.deleteMany({ where: testReturns });
    await prisma.phieuDoiTra.deleteMany({ where: { maNV: { startsWith: PREFIX } } });
    await prisma.chiTietHoaDon.deleteMany({ where: { maHoaDon: { startsWith: PREFIX } } });
    await prisma.hoaDon.deleteMany({ where: { maHoaDon: { startsWith: PREFIX } } });
    await prisma.sach.deleteMany({ where: { maSach: { startsWith: PREFIX } } });
    await prisma.khachHang.deleteMany({ where: { maKH: { startsWith: PREFIX } } });
    await prisma.taiKhoan.deleteMany({ where: { maNV: { startsWith: PREFIX } } });
    await prisma.nhanVien.deleteMany({ where: { maNV: { startsWith: PREFIX } } });
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

  let isbnSeq = 0;
  async function createBook(key: string, categoryId: string, price: number, stock: number, status: 'ACTIVE' | 'DISCONTINUED' = 'ACTIVE') {
    await prisma.sach.create({
      data: {
        maSach: id(key),
        isbn: `97900000${String(++isbnSeq).padStart(5, '0')}`,
        tenSach: `${PREFIX} Sách ${key}`,
        giaNhap: Math.round(price * 0.6),
        giaBan: price,
        soLuongTon: stock,
        trangThai: status,
        maTheLoai: categoryId,
        maTacGia: 'TG001',
        maNXB: 'NXB001',
      },
    });
  }

  /** Hóa đơn gốc tạo thẳng trong DB (ngày lập, giảm phân bổ tùy chọn). Điểm khách = điểm của hóa đơn. */
  async function createInvoice(key: string, lines: Line[], opts: { days?: number; customer?: string } = {}) {
    const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
    const discount = lines.reduce((s, l) => s + (l.discount ?? 0), 0);
    await prisma.hoaDon.create({
      data: {
        maHoaDon: id(key),
        ngayLap: vnDay(opts.days ?? 0),
        tongTienHang: subtotal,
        tienGiamVoucher: discount,
        thanhToanCuoi: subtotal - discount,
        maKH: opts.customer ? id(opts.customer) : null,
        maNV: id('SALES'),
        chiTiets: {
          create: lines.map((l) => ({
            maSach: id(l.book),
            tenSach: `${PREFIX} Sách ${l.book}`,
            soLuongBan: l.qty,
            donGiaBan: l.price,
            giamGia: l.discount ?? 0,
            giaVon: Math.round(l.price * 0.6),
          })),
        },
      },
    });
    if (opts.customer) {
      await prisma.khachHang.update({
        where: { maKH: id(opts.customer) },
        data: { diemTichLuy: { increment: Math.floor((subtotal - discount) / 10000) } },
      });
    }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();

    await createStaff('MANAGER', 'MANAGER', '0922000001');
    await createStaff('SALES', 'SALES', '0922000002');
    await createStaff('SALES2', 'SALES', '0922000003');
    await createStaff('WAREHOUSE', 'WAREHOUSE', '0922000004');

    await createBook('A', 'VH', 100000, 10);
    await createBook('B', 'TN', 50000, 10);
    await createBook('NEW', 'VH', 120000, 5);
    await createBook('CHEAP', 'VH', 30000, 5);
    await createBook('EMPTY', 'VH', 40000, 0);
    await createBook('OFF', 'VH', 90000, 3, 'DISCONTINUED');
    await createBook('LAST', 'VH', 60000, 1);

    for (const [i, kh] of ['KH1', 'KH2'].entries()) {
      await prisma.khachHang.create({ data: { maKH: id(kh), hoTen: `${PREFIX} ${kh}`, soDienThoai: `09660000${i}1` } });
    }

    // HD1: 3 × A (giảm phân bổ 10.000 → thực trả 290.000) + 1 × B; khách KH1 → 340.000, 34 điểm
    await createInvoice('HD1', [{ book: 'A', qty: 3, price: 100000, discount: 10000 }, { book: 'B', qty: 1, price: 50000 }], { customer: 'KH1' });
    // HD2: 3 × B, khách KH2 → 150.000, 15 điểm
    await createInvoice('HD2', [{ book: 'B', qty: 3, price: 50000 }], { customer: 'KH2' });
    await createInvoice('OLD', [{ book: 'A', qty: 1, price: 100000 }], { days: -8 });
    await createInvoice('EDGE', [{ book: 'A', qty: 1, price: 100000 }], { days: -7 });
    await createInvoice('HD-OFF', [{ book: 'OFF', qty: 1, price: 90000 }]);
    await createInvoice('HD-RACE', [{ book: 'B', qty: 1, price: 50000 }]);
    await createInvoice('HD-X1', [{ book: 'A', qty: 1, price: 100000 }]);
    await createInvoice('HD-X2', [{ book: 'A', qty: 1, price: 100000 }]);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('quyền: SALES/MANAGER dùng được; WAREHOUSE → 403; chưa đăng nhập → 401', async () => {
    await sales().get('/returns').expect(200);
    await as('MANAGER').post('/returns/preview', ret('HD1', [['A', 1]])).expect(200);
    await as('WAREHOUSE').get('/returns').expect(403);
    await as('WAREHOUSE').post('/returns', ret('HD1', [['A', 1]])).expect(403);
    await http().get('/returns').expect(401);
  });

  it('preview không ghi DB; tiền hoàn tính từ tiền thực trả sau giảm của dòng gốc', async () => {
    const before = { stock: await stockOf('A'), returns: await testReturnCount() };
    const res = await sales().post('/returns/preview', ret('HD1', [['A', 1]])).expect(200);
    // floor(290.000 × 1/3) = 96.666 (không phải giá gốc 100.000)
    expect(res.body).toMatchObject({ valid: true, returnedValue: 96666, refundAmount: 96666, extraPayment: 0 });
    expect(res.body.lines[0]).toMatchObject({ purchasedQuantity: 3, alreadyReturned: 0 });
    expect(await stockOf('A')).toBe(before.stock);
    expect(await testReturnCount()).toBe(before.returns);
  });

  it('trả từng phần nhiều lần: tổng hoàn = đúng tiền thực trả, trạng thái & điểm & chi tiêu cập nhật', async () => {
    const stockBefore = await stockOf('A');
    const refunds: number[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await sales().post('/returns', ret('HD1', [['A', 1]])).expect(201);
      refunds.push(res.body.refundAmount);
      expect(await statusOf('HD1')).toBe('PARTIAL_RETURN');
    }
    expect(refunds).toEqual([96666, 96667, 96667]);
    expect(refunds.reduce((s, r) => s + r, 0)).toBe(290000);
    expect(await stockOf('A')).toBe(stockBefore + 3);

    // đã trả hết A → không trả thêm được
    const more = await sales().post('/returns', ret('HD1', [['A', 1]])).expect(400);
    expect(more.body.message).toContain('đã được đổi/trả hết');

    // trả nốt B → RETURNED; chi tiêu 340.000 − 290.000 − 50.000 = 0 → 0 điểm (không âm, không trừ lặp)
    await sales().post('/returns', ret('HD1', [['B', 1]])).expect(201);
    expect(await statusOf('HD1')).toBe('RETURNED');
    expect(await pointsOf('KH1')).toBe(0);
    const customer = (await sales().get('/customers').expect(200)).body.find((c: { id: string }) => c.id === id('KH1'));
    expect(customer).toMatchObject({ totalSpent: 0, orderCount: 1 });

    const invoice = await sales().get(`/invoices/${id('HD1')}`).expect(200);
    expect(invoice.body.items.map((i: { returnedQuantity: number }) => i.returnedQuantity)).toEqual([3, 1]);
    expect(invoice.body.returnDeadline).toBe(todayInStore(new Date(Date.now() + 7 * 86400000)));
  });

  it('trả vượt số còn lại, sách không thuộc hóa đơn, số lượng sai → 400', async () => {
    const over = await sales().post('/returns', ret('HD2', [['B', 4]])).expect(400);
    expect(over.body.message).toContain('chỉ còn 3 cuốn');
    // 2 dòng trùng sách được gộp: 2 + 2 > 3
    await sales().post('/returns', ret('HD2', [['B', 2], ['B', 2]])).expect(400);
    await sales().post('/returns', ret('HD2', [['A', 1]])).expect(400);
    await sales().post('/returns', ret('HD2', [['B', 0]])).expect(400);
    await sales().post('/returns', ret('KHONG_CO', [['B', 1]])).expect(404);
  });

  it('hạn 7 ngày theo lịch Việt Nam: quá 8 ngày → từ chối; đúng 7 ngày → còn hạn', async () => {
    const old = await sales().post('/returns', ret('OLD', [['A', 1]])).expect(400);
    expect(old.body.message).toContain('quá thời hạn');
    const edge = await sales().post('/returns/preview', ret('EDGE', [['A', 1]])).expect(200);
    expect(edge.body).toMatchObject({ valid: true, deadline: todayInStore() });
  });

  it('đổi sang sách đắt hơn: khách bù; rẻ hơn: hoàn; lưu riêng 2 khoản; điểm theo chênh lệch', async () => {
    const before = { b: await stockOf('B'), neu: await stockOf('NEW') };
    const up = await sales()
      .post('/returns', ret('HD2', [['B', 1]], { type: 'EXCHANGE', exchangeBookId: id('NEW'), expectedRefundAmount: 0, expectedExtraPayment: 70000 }))
      .expect(201);
    // 50.000 → 120.000: khách bù 70.000
    expect(up.body).toMatchObject({ exchangePriceDiff: 70000, refundAmount: 0, extraPayment: 70000, exchangeQuantity: 1 });
    expect(await stockOf('B')).toBe(before.b + 1);
    expect(await stockOf('NEW')).toBe(before.neu - 1);
    expect(await pointsOf('KH2')).toBe(22); // 150.000 + 70.000 = 220.000

    const down = await sales()
      .post('/returns', ret('HD2', [['B', 1]], { type: 'EXCHANGE', exchangeBookId: id('CHEAP'), expectedRefundAmount: 20000, expectedExtraPayment: 0 }))
      .expect(201);
    expect(down.body).toMatchObject({ exchangePriceDiff: -20000, refundAmount: 20000, extraPayment: 0 });
    expect(await pointsOf('KH2')).toBe(20); // 220.000 − 20.000

    const stored = await prisma.phieuDoiTra.findUniqueOrThrow({ where: { maDoiTra: up.body.id }, include: { chiTiets: true } });
    expect(Number(stored.tienKhachBu)).toBe(70000);
    expect(Number(stored.tienHoanTra)).toBe(0);
    expect(Number(stored.chiTiets[0].giaVonSachDoi)).toBe(72000);
    expect(await statusOf('HD2')).toBe('PARTIAL_RETURN');
  });

  it('đổi sang sách hết tồn / ngừng kinh doanh / thiếu sách đổi → 400, không ghi gì', async () => {
    const before = await testReturnCount();
    const empty = await sales().post('/returns', ret('HD2', [['B', 1]], { type: 'EXCHANGE', exchangeBookId: id('EMPTY') })).expect(400);
    expect(empty.body.message).toContain('không đủ tồn kho');
    await sales().post('/returns', ret('HD2', [['B', 1]], { type: 'EXCHANGE', exchangeBookId: id('OFF') })).expect(400);
    await sales().post('/returns', ret('HD2', [['B', 1]], { type: 'EXCHANGE' })).expect(400);
    await sales().post('/returns', ret('HD2', [['B', 1]], { exchangeBookId: id('NEW') })).expect(400);
    expect(await testReturnCount()).toBe(before);
  });

  it('nhận lại sách đã ngừng kinh doanh: cộng tồn nhưng giữ DISCONTINUED', async () => {
    const before = await stockOf('OFF');
    await sales().post('/returns', ret('HD-OFF', [['OFF', 1]])).expect(201);
    const book = await prisma.sach.findUniqueOrThrow({ where: { maSach: id('OFF') } });
    expect(book.soLuongTon).toBe(before + 1);
    expect(book.trangThai).toBe('DISCONTINUED');
  });

  it('không tin tiền hoàn / đơn giá / người xử lý FE gửi', async () => {
    const body = ret('HD2', [['B', 1]]);
    const res = await sales()
      .post('/returns', {
        ...body,
        refundAmount: 999999,
        exchangePriceDiff: -999999,
        handledBy: 'Giả mạo',
        returnItems: [{ ...body.returnItems[0], unitPrice: 999999 }],
      })
      .expect(201);
    expect(res.body).toMatchObject({ refundAmount: 50000, handledBy: `${PREFIX} SALES` });
    expect(res.body.returnItems[0].unitPrice).toBe(50000);
    expect(await statusOf('HD2')).toBe('RETURNED');
  });

  it('2 phiếu đồng thời trả cuốn cuối của cùng dòng: chỉ 1 thành công', async () => {
    const before = await stockOf('B');
    const results = await Promise.all([
      sales().post('/returns', ret('HD-RACE', [['B', 1]])),
      as('SALES2').post('/returns', ret('HD-RACE', [['B', 1]])),
    ]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 400]);
    expect(await stockOf('B')).toBe(before + 1);
  });

  it('2 phiếu đổi đồng thời tranh cuốn cuối của sách mới: bên thua rollback toàn bộ', async () => {
    const before = { a: await stockOf('A'), returns: await testReturnCount() };
    const results = await Promise.all([
      sales().post('/returns', ret('HD-X1', [['A', 1]], { type: 'EXCHANGE', exchangeBookId: id('LAST'), expectedRefundAmount: 40000, expectedExtraPayment: 0 })),
      as('SALES2').post('/returns', ret('HD-X2', [['A', 1]], { type: 'EXCHANGE', exchangeBookId: id('LAST'), expectedRefundAmount: 40000, expectedExtraPayment: 0 })),
    ]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
    expect(await stockOf('LAST')).toBe(0);
    expect(await stockOf('A')).toBe(before.a + 1); // bên thua không cộng tồn sách trả
    expect(await testReturnCount()).toBe(before.returns + 1);
    const statuses = [await statusOf('HD-X1'), await statusOf('HD-X2')].sort();
    expect(statuses).toEqual(['COMPLETED', 'RETURNED']);
  });

  it('gửi lặp: cùng nội dung → phiếu cũ (kể cả đồng thời); khác nội dung / khác người → 409', async () => {
    await createInvoice('HD-KEY', [{ book: 'B', qty: 3, price: 50000 }]);
    const before = await testReturnCount();
    const body = ret('HD-KEY', [['B', 1]]);
    const first = await sales().post('/returns', body).expect(201);
    const again = await sales().post('/returns', { ...body, reason: 'lý do khác' }).expect(201);
    expect(again.body.id).toBe(first.body.id);

    const parallelBody = ret('HD-KEY', [['B', 1]]);
    const parallel = await Promise.all([sales().post('/returns', parallelBody), sales().post('/returns', parallelBody)]);
    expect(parallel.every((r) => r.status === 201)).toBe(true);
    expect(parallel[0].body.id).toBe(parallel[1].body.id);
    expect(await testReturnCount()).toBe(before + 2);

    const other = await sales().post('/returns', { ...body, returnItems: [{ bookId: id('B'), quantity: 2 }] }).expect(409);
    expect(other.body.message).toContain(first.body.id);
    await as('SALES2').post('/returns', body).expect(409);
    expect(await testReturnCount()).toBe(before + 2);
  });

  it('gửi lặp đồng thời trả cuốn cuối (cùng khóa) → cả 2 nhận cùng phiếu, không báo "đã trả hết"', async () => {
    await createInvoice('HD-KEY2', [{ book: 'B', qty: 1, price: 50000 }]);
    const body = ret('HD-KEY2', [['B', 1]]);
    const results = await Promise.all([sales().post('/returns', body), sales().post('/returns', body)]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(results[0].body.id).toBe(results[1].body.id);
    expect(await statusOf('HD-KEY2')).toBe('RETURNED');
  });

  it('danh sách phiếu: dữ liệu seed map đúng', async () => {
    const res = await sales().get('/returns').expect(200);
    expect(res.body.find((r: { id: string }) => r.id === 'DT-2511-2001')).toMatchObject({
      invoiceId: 'HD-2411-1031',
      customerId: 'KH003',
      type: 'EXCHANGE',
      exchangeBookId: 'SP001',
      exchangePriceDiff: 17000,
      refundAmount: 0,
      returnItems: [expect.objectContaining({ bookId: 'SP006', quantity: 1, unitPrice: 98000, value: 98000 })],
    });
  });
});
