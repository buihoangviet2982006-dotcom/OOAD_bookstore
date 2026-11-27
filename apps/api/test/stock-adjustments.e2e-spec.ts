/**
 * E2E Kiểm kê / điều chỉnh kho – DB thật.
 * Dữ liệu thử (tạo trong beforeAll, dọn trong afterAll): nhân viên/tài khoản, sách có mã "E2I";
 * phiếu kiểm kê (mã KK-… tự sinh) do tài khoản E2I lập → dọn theo người lập. Không dùng dữ liệu seed.
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
import { PrismaService } from '../src/prisma/prisma.service.js';

const PREFIX = 'E2I';
const PASSWORD = 'Matkhau@123';
const URL = '/inventory/adjustments';

type Line = [book: string, systemStock: number, actualStock: number, reason?: string];

describe('Kiểm kê / điều chỉnh kho (e2e)', () => {
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
  const stockOf = async (key: string) => (await prisma.sach.findUniqueOrThrow({ where: { maSach: id(key) } })).soLuongTon;
  const testAdjustmentCount = () => prisma.phieuKiemKe.count({ where: { maNV: { startsWith: PREFIX } } });

  const adjust = (lines: Line[], extra: object = {}) => ({
    note: `${PREFIX} kiểm kê thử`,
    items: lines.map(([book, systemStock, actualStock, reason = 'Kiểm đếm thực tế']) => ({
      bookId: id(book),
      systemStock,
      actualStock,
      reason,
    })),
    requestKey: randomUUID(),
    ...extra,
  });

  async function cleanup() {
    const byTestStaff = { maNV: { startsWith: PREFIX } };
    await prisma.chiTietKiemKe.deleteMany({ where: { phieuKiemKe: byTestStaff } });
    await prisma.phieuKiemKe.deleteMany({ where: byTestStaff });
    await prisma.sach.deleteMany({ where: { maSach: { startsWith: PREFIX } } });
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

    await createStaff('MANAGER', 'MANAGER', '0912300001');
    await createStaff('WAREHOUSE', 'WAREHOUSE', '0912300002');
    await createStaff('WAREHOUSE2', 'WAREHOUSE', '0912300003');
    await createStaff('SALES', 'SALES', '0912300004');

    const books = [
      ['A', 10, 'ACTIVE'],
      ['B', 5, 'ACTIVE'],
      ['C', 8, 'ACTIVE'],
      ['DIS', 3, 'DISCONTINUED'],
    ] as const;
    for (const [i, [key, soLuongTon, trangThai]] of books.entries()) {
      await prisma.sach.create({
        data: {
          maSach: id(key),
          isbn: `97900000${String(700 + i).padStart(5, '0')}`,
          tenSach: `${PREFIX} Sách ${key}`,
          giaNhap: 10000,
          giaBan: 20000,
          soLuongTon,
          trangThai,
          maTheLoai: 'VH',
          maTacGia: 'TG001',
          maNXB: 'NXB001',
        },
      });
    }
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('quyền: WAREHOUSE/MANAGER dùng được; SALES → 403; chưa đăng nhập → 401', async () => {
    await wh().get(URL).expect(200);
    await as('MANAGER').get(URL).expect(200);
    await as('SALES').get(URL).expect(403);
    await as('SALES').post(URL, adjust([['A', 10, 10]])).expect(403);
    await http().get(URL).expect(401);
  });

  it('tăng và giảm tồn trong 1 phiếu; chênh lệch / người lập do backend tính', async () => {
    const res = await wh()
      .post(URL, {
        ...adjust([['A', 10, 12], ['B', 5, 3]]),
        createdBy: 'Giả mạo',
        status: 'DRAFT',
      })
      .expect(201);
    expect(res.body.code).toMatch(/^KK-\d{4}-\d+$/);
    expect(res.body).toMatchObject({ createdBy: `${PREFIX} WAREHOUSE`, status: 'APPLIED' });
    expect(res.body.items).toEqual([
      expect.objectContaining({ bookId: id('A'), systemStock: 10, actualStock: 12, diff: 2 }),
      expect.objectContaining({ bookId: id('B'), systemStock: 5, actualStock: 3, diff: -2 }),
    ]);
    expect(await stockOf('A')).toBe(12);
    expect(await stockOf('B')).toBe(3);

    const listed = (await wh().get(URL).expect(200)).body.find((a: { id: string }) => a.id === res.body.id);
    expect(listed.items).toHaveLength(2);
  });

  it('thực tế = 0 → tồn 0, sách hiện OUT_OF_STOCK', async () => {
    await wh().post(URL, adjust([['B', 3, 0, 'Mất / hỏng hết']])).expect(201);
    expect(await stockOf('B')).toBe(0);
    const book = (await wh().get(`/books/${id('B')}`).expect(200)).body;
    expect(book.status).toBe('OUT_OF_STOCK');
  });

  it('sách ngừng kinh doanh: cân bằng tồn nhưng giữ DISCONTINUED', async () => {
    await wh().post(URL, adjust([['DIS', 3, 5]])).expect(201);
    const dis = await prisma.sach.findUniqueOrThrow({ where: { maSach: id('DIS') } });
    expect(dis.soLuongTon).toBe(5);
    expect(dis.trangThai).toBe('DISCONTINUED');
  });

  it('dòng khớp không cần lý do và không đổi tồn; dòng chênh lệch thiếu lý do → 400 cả phiếu', async () => {
    const ok = await wh().post(URL, adjust([['C', 8, 8, '']])).expect(201);
    expect(ok.body.items[0]).toMatchObject({ diff: 0, reason: '' });
    expect(await stockOf('C')).toBe(8);

    const before = await testAdjustmentCount();
    const res = await wh().post(URL, adjust([['A', 12, 13], ['C', 8, 7, '  ']])).expect(400);
    expect(res.body.message).toContain('lý do');
    expect(await stockOf('A')).toBe(12);
    expect(await testAdjustmentCount()).toBe(before);
  });

  it.each([
    ['trùng sách trong phiếu', [['A', 12, 13], ['A', 12, 14]] as Line[], 'trùng'],
    ['số thực tế âm', [['A', 12, -1]] as Line[], 'âm'],
    ['sách không tồn tại', [['KHONG_CO', 0, 1]] as Line[], 'không tồn tại'],
  ])('validation: %s → 400', async (_label, lines, text) => {
    const res = await wh().post(URL, adjust(lines)).expect(400);
    expect(res.body.message).toContain(text);
  });

  it('validation: không có dòng / số không nguyên → 400', async () => {
    await wh().post(URL, adjust([])).expect(400);
    await wh().post(URL, { ...adjust([]), items: [{ bookId: id('A'), systemStock: 12, actualStock: 1.5 }] }).expect(400);
  });

  it('tồn đã thay đổi sau khi mở form → 409, cả phiếu không áp dụng (kể cả dòng hợp lệ)', async () => {
    const before = { a: await stockOf('A'), c: await stockOf('C'), count: await testAdjustmentCount() };
    // giả lập vừa bán 1 cuốn C sau khi mở form
    await prisma.sach.update({ where: { maSach: id('C') }, data: { soLuongTon: { decrement: 1 } } });

    const res = await wh().post(URL, adjust([['A', before.a, before.a + 5], ['C', before.c, 2]])).expect(409);
    expect(res.body.message).toContain('đã thay đổi');
    expect(res.body.message).toContain(`hiện tại: ${before.c - 1}`);
    expect(await stockOf('A')).toBe(before.a); // dòng hợp lệ cũng không được áp dụng
    expect(await stockOf('C')).toBe(before.c - 1); // không ghi đè giao dịch mới
    expect(await testAdjustmentCount()).toBe(before.count);
  });

  it('2 phiếu đồng thời cùng sách từ cùng tồn lúc mở form: chỉ 1 được áp dụng', async () => {
    const a = await stockOf('A');
    const before = await testAdjustmentCount();
    const results = await Promise.all([
      wh().post(URL, adjust([['A', a, a + 1]])),
      as('WAREHOUSE2').post(URL, adjust([['A', a, a - 1]])),
    ]);
    expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([201, 409]);
    const winner = results.find((r) => r.status === 201)!;
    expect(await stockOf('A')).toBe(winner.body.items[0].actualStock);
    expect(await testAdjustmentCount()).toBe(before + 1);
  });

  it('gửi lặp: cùng nội dung → phiếu cũ, không áp dụng lại (kể cả đồng thời); khác nội dung / khác người → 409', async () => {
    const a = await stockOf('A');
    const before = await testAdjustmentCount();
    const body = adjust([['A', a, a + 3]]);

    const first = await wh().post(URL, body).expect(201);
    expect(await stockOf('A')).toBe(a + 3);
    // Gửi lại: tồn hiện tại đã khác systemStock nhưng vẫn trả phiếu cũ, không áp dụng lại
    const again = await wh().post(URL, { ...body, note: 'ghi chú khác' }).expect(201);
    expect(again.body.id).toBe(first.body.id);
    expect(await stockOf('A')).toBe(a + 3);

    const parallelBody = adjust([['A', a + 3, a + 4]]);
    const parallel = await Promise.all([wh().post(URL, parallelBody), wh().post(URL, parallelBody)]);
    expect(parallel.every((r) => r.status === 201)).toBe(true);
    expect(parallel[0].body.id).toBe(parallel[1].body.id);
    expect(await stockOf('A')).toBe(a + 4);
    expect(await testAdjustmentCount()).toBe(before + 2);

    const other = await wh().post(URL, { ...body, items: [{ ...body.items[0], actualStock: a + 9 }] }).expect(409);
    expect(other.body.message).toContain(first.body.id);
    await as('WAREHOUSE2').post(URL, body).expect(409);
    expect(await stockOf('A')).toBe(a + 4);
  });

  it('dữ liệu seed map đúng: KK-2011-009', async () => {
    const seed = (await wh().get(URL).expect(200)).body.find((a: { id: string }) => a.id === 'KK-2011-009');
    expect(seed).toMatchObject({ status: 'APPLIED', createdBy: 'Trần Hoàng Nam' });
    expect(seed.items).toEqual([
      expect.objectContaining({ bookId: 'SP001', systemStock: 44, actualStock: 45, diff: 1 }),
      expect.objectContaining({ bookId: 'SP002', systemStock: 10, actualStock: 9, diff: -1 }),
    ]);
  });
});
