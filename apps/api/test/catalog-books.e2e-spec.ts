/**
 * E2E Danh mục + Sách – chạy với DB thật.
 * Chỉ tạo/sửa/xóa dữ liệu test có tiền tố "E2C" (và tác giả/NXB tên "E2C …"); dữ liệu seed chỉ được đọc.
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

const PREFIX = 'E2C';
const PASSWORD = 'Matkhau@123';

describe('Danh mục & Sách (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const tokens = {} as Record<VaiTro, string>;

  const as = (role: VaiTro) => ({
    get: (url: string) => http().get(url).auth(tokens[role], { type: 'bearer' }),
    post: (url: string, body: object) => http().post(url).auth(tokens[role], { type: 'bearer' }).send(body),
    patch: (url: string, body: object) => http().patch(url).auth(tokens[role], { type: 'bearer' }).send(body),
    delete: (url: string) => http().delete(url).auth(tokens[role], { type: 'bearer' }),
  });
  const warehouse = () => as('WAREHOUSE');

  /** Sách hợp lệ dựa trên danh mục seed. */
  const validBook = (sku: string, isbn: string) => ({
    sku,
    isbn,
    title: `${PREFIX} Sách ${sku}`,
    categoryId: 'VH',
    authorId: 'TG001',
    publisherId: 'NXB001',
    publishYear: 2025,
    importPrice: 50000,
    sellPrice: 80000,
    minStock: 5,
    shelfLocation: 'Kệ test',
    status: 'ACTIVE',
    description: '',
  });

  async function cleanup() {
    await prisma.thanhToan.deleteMany({ where: { maHoaDon: { startsWith: PREFIX } } });
    await prisma.chiTietHoaDon.deleteMany({ where: { maHoaDon: { startsWith: PREFIX } } });
    await prisma.hoaDon.deleteMany({ where: { maHoaDon: { startsWith: PREFIX } } });
    await prisma.sach.deleteMany({ where: { maSach: { startsWith: PREFIX } } });
    await prisma.theLoai.deleteMany({ where: { maTheLoai: { startsWith: PREFIX } } });
    await prisma.tacGia.deleteMany({ where: { tenTacGia: { startsWith: PREFIX } } });
    await prisma.nhaXuatBan.deleteMany({ where: { tenNXB: { startsWith: PREFIX } } });
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
      await prisma.nhanVien.create({
        data: {
          maNV,
          hoTen: `${PREFIX} ${role}`,
          soDienThoai: `09880000${i}0`,
          email: `${maNV.toLowerCase()}@test.local`,
          ngayVaoLam: new Date('2026-01-01'),
          boPhan: role,
          chucVu: 'Test',
        },
      });
      await prisma.taiKhoan.create({
        data: {
          maTaiKhoan: maNV,
          tenDangNhap: maNV.toLowerCase(),
          emailKhoiPhuc: `${maNV.toLowerCase()}@test.local`,
          matKhauHash: await hashPassword(PASSWORD),
          vaiTro: role,
          maNV,
        },
      });
      const res = await http().post('/auth/login').send({ identifier: maNV.toLowerCase(), password: PASSWORD });
      tokens[role] = res.body.accessToken as string;
    }
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('Phân quyền', () => {
    it('chưa đăng nhập → 401', async () => {
      await http().get('/books').expect(401);
      await http().get('/categories').expect(401);
    });

    it('SALES đọc được sách và danh mục (POS), không được ghi → 403', async () => {
      await as('SALES').get('/books').expect(200);
      await as('SALES').get('/categories').expect(200);
      await as('SALES').get('/authors').expect(200);
      await as('SALES').get('/publishers').expect(200);
      await as('SALES').post('/books', validBook(`${PREFIX}-S1`, '9790000000101')).expect(403);
      await as('SALES').post('/categories', { code: `${PREFIX}-X`, name: `${PREFIX} X` }).expect(403);
      await as('SALES').delete('/books/SP001').expect(403);
    });

    it('WAREHOUSE và MANAGER được ghi', async () => {
      await warehouse().post('/books', validBook(`${PREFIX}-W1`, '9790000000102')).expect(201);
      await as('MANAGER').post('/books', validBook(`${PREFIX}-M1`, '9790000000103')).expect(201);
    });
  });

  describe('Sách – contract & trạng thái', () => {
    it('GET /books trả đúng contract FE với dữ liệu seed', async () => {
      const res = await warehouse().get('/books').expect(200);
      const sp001 = res.body.find((b: { id: string }) => b.id === 'SP001');
      expect(sp001).toMatchObject({
        id: 'SP001',
        sku: 'SP001',
        categoryId: 'VH',
        categoryName: 'Văn học Việt Nam & Thế giới',
        authorName: 'Nguyễn Nhật Ánh',
        publisherName: 'NXB Trẻ',
        importPrice: 72000,
        sellPrice: 115000,
        status: 'ACTIVE',
      });
      expect(typeof sp001.stock).toBe('number');
      // SP007 tồn 0, đang kinh doanh → OUT_OF_STOCK (suy ra)
      expect(res.body.find((b: { id: string }) => b.id === 'SP007').status).toBe('OUT_OF_STOCK');
    });

    it('DISCONTINUED giữ nguyên dù còn tồn; mở kinh doanh lại được', async () => {
      const sku = `${PREFIX}-ST1`;
      await warehouse().post('/books', validBook(sku, '9790000000104')).expect(201);
      let res = await warehouse().get(`/books/${sku}`).expect(200);
      expect(res.body.status).toBe('OUT_OF_STOCK'); // sách mới tồn 0

      await prisma.sach.update({ where: { maSach: sku }, data: { soLuongTon: 7 } }); // giả lập đã nhập kho
      res = await warehouse().get(`/books/${sku}`).expect(200);
      expect(res.body.status).toBe('ACTIVE');

      await warehouse().patch(`/books/${sku}`, { ...validBook(sku, '9790000000104'), status: 'DISCONTINUED' }).expect(200);
      res = await warehouse().get(`/books/${sku}`).expect(200);
      expect(res.body).toMatchObject({ status: 'DISCONTINUED', stock: 7 });

      await warehouse().patch(`/books/${sku}`, { ...validBook(sku, '9790000000104'), status: 'ACTIVE' }).expect(200);
      expect((await warehouse().get(`/books/${sku}`)).body.status).toBe('ACTIVE');
    });

    it('tồn kho không sửa được qua CRUD (tạo = 0, sửa giữ nguyên); OUT_OF_STOCK gửi lên lưu ACTIVE', async () => {
      const sku = `${PREFIX}-STK`;
      const created = await warehouse()
        .post('/books', { ...validBook(sku, '9790000000105'), stock: 99, status: 'OUT_OF_STOCK' })
        .expect(201);
      expect(created.body.stock).toBe(0);
      await prisma.sach.update({ where: { maSach: sku }, data: { soLuongTon: 3 } });
      const updated = await warehouse()
        .patch(`/books/${sku}`, { ...validBook(sku, '9790000000105'), stock: 500 })
        .expect(200);
      expect(updated.body.stock).toBe(3);
      expect((await prisma.sach.findUniqueOrThrow({ where: { maSach: sku } })).trangThai).toBe('ACTIVE');
    });
  });

  describe('Sách – validation', () => {
    it('trùng mã sách → 409; trùng ISBN → 409 nêu sách đang dùng', async () => {
      await warehouse().post('/books', validBook('SP001', '9790000000106')).expect(409);
      const res = await warehouse().post('/books', validBook(`${PREFIX}-DUP`, '978-604-1-20841-2')).expect(409);
      expect(res.body.message).toContain('SP001');
    });

    it('sửa sang ISBN đã dùng → 409; giữ ISBN của chính nó → 200', async () => {
      const sku = `${PREFIX}-ISB`;
      await warehouse().post('/books', validBook(sku, '9790000000107')).expect(201);
      await warehouse().patch(`/books/${sku}`, validBook(sku, '978-604-1-20841-2')).expect(409);
      await warehouse().patch(`/books/${sku}`, validBook(sku, '9790000000107')).expect(200);
    });

    it('tham chiếu không tồn tại → 400', async () => {
      const res = await warehouse()
        .post('/books', { ...validBook(`${PREFIX}-REF`, '9790000000108'), categoryId: 'KHONG_CO' })
        .expect(400);
      expect(res.body.message).toContain('Thể loại');
    });

    it('dữ liệu sai → 400 với thông báo dạng chuỗi', async () => {
      const res = await warehouse()
        .post('/books', { ...validBook(`${PREFIX}-BAD`, '123'), title: '', sellPrice: 0, minStock: -1 })
        .expect(400);
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message).toContain('ISBN');
      expect(res.body.message).toContain('Giá bán');
    });

    it('đổi mã sách khi sửa → 400; sách không tồn tại → 404', async () => {
      await warehouse().patch('/books/SP001', validBook('SP999', '978-604-1-20841-2')).expect(400);
      await warehouse().patch('/books/KHONG_CO', validBook('KHONG_CO', '9790000000109')).expect(404);
      await warehouse().get('/books/KHONG_CO').expect(404);
      await warehouse().delete('/books/KHONG_CO').expect(404);
    });
  });

  describe('Sách – xóa & lịch sử giao dịch', () => {
    it('chưa có giao dịch, tồn 0 → xóa hẳn', async () => {
      const sku = `${PREFIX}-DEL`;
      await warehouse().post('/books', validBook(sku, '9790000000110')).expect(201);
      const res = await warehouse().delete(`/books/${sku}`).expect(200);
      expect(res.body.action).toBe('DELETED');
      await warehouse().get(`/books/${sku}`).expect(404);
    });

    it('đã có hóa đơn → chuyển DISCONTINUED; sửa giá/xóa không đổi dòng hóa đơn cũ', async () => {
      const sku = `${PREFIX}-HIS`;
      await warehouse().post('/books', validBook(sku, '9790000000111')).expect(201);
      await prisma.hoaDon.create({
        data: {
          maHoaDon: `${PREFIX}-HD1`,
          tongTienHang: 80000,
          thanhToanCuoi: 80000,
          maNV: `${PREFIX}-SALES`,
          chiTiets: {
            create: { maSach: sku, tenSach: `${PREFIX} Sách ${sku}`, soLuongBan: 1, donGiaBan: 80000, giaVon: 50000 },
          },
        },
      });

      await warehouse()
        .patch(`/books/${sku}`, { ...validBook(sku, '9790000000111'), sellPrice: 99000, importPrice: 60000 })
        .expect(200);
      const res = await warehouse().delete(`/books/${sku}`).expect(200);
      expect(res.body.action).toBe('DISCONTINUED');
      expect((await warehouse().get(`/books/${sku}`)).body.status).toBe('DISCONTINUED');

      const line = await prisma.chiTietHoaDon.findUniqueOrThrow({
        where: { maHoaDon_maSach: { maHoaDon: `${PREFIX}-HD1`, maSach: sku } },
      });
      expect(Number(line.donGiaBan)).toBe(80000);
      expect(Number(line.giaVon)).toBe(50000);
    });

    it('còn tồn kho (chưa có chứng từ) → cũng chỉ ngừng kinh doanh', async () => {
      const sku = `${PREFIX}-TON`;
      await warehouse().post('/books', validBook(sku, '9790000000112')).expect(201);
      await prisma.sach.update({ where: { maSach: sku }, data: { soLuongTon: 2 } });
      expect((await warehouse().delete(`/books/${sku}`).expect(200)).body.action).toBe('DISCONTINUED');
    });
  });

  describe('Danh mục', () => {
    it('thể loại: tạo, trùng mã/tên (không phân biệt hoa thường) → 409, sửa, xóa', async () => {
      const code = `${PREFIX}-TL`;
      const created = await warehouse().post('/categories', { code: code.toLowerCase(), name: `${PREFIX} Thể loại` }).expect(201);
      expect(created.body).toMatchObject({ id: code, code, bookCount: 0 });
      await warehouse().post('/categories', { code, name: `${PREFIX} Khác` }).expect(409);
      await warehouse().post('/categories', { code: `${PREFIX}-TL2`, name: 'văn học việt nam & thế giới' }).expect(409);
      await warehouse().patch(`/categories/${code}`, { code: 'DOI-MA', name: `${PREFIX} Mới` }).expect(400);
      const updated = await warehouse().patch(`/categories/${code}`, { code, name: `${PREFIX} Mới` }).expect(200);
      expect(updated.body.name).toBe(`${PREFIX} Mới`);
      await warehouse().delete(`/categories/${code}`).expect(200);
      await warehouse().delete(`/categories/${code}`).expect(404);
    });

    it('không xóa được thể loại / tác giả / NXB đang có sách → 409', async () => {
      expect((await warehouse().delete('/categories/VH').expect(409)).body.message).toContain('đầu sách');
      await warehouse().delete('/authors/TG001').expect(409);
      await warehouse().delete('/publishers/NXB001').expect(409);
    });

    it('bookCount đúng theo số sách', async () => {
      const res = await warehouse().get('/categories').expect(200);
      const vh = res.body.find((c: { id: string }) => c.id === 'VH');
      expect(vh.bookCount).toBe(await prisma.sach.count({ where: { maTheLoai: 'VH' } }));
    });

    it('tác giả: tự sinh mã TGxxx, bắt buộc họ tên, xóa khi chưa có sách', async () => {
      await warehouse().post('/authors', { name: '  ' }).expect(400);
      const res = await warehouse().post('/authors', { name: `${PREFIX} Tác giả`, nationality: '', bio: '' }).expect(201);
      expect(res.body.id).toMatch(/^TG\d{3,}$/);
      expect(res.body).toMatchObject({ nationality: '', bio: '', bookCount: 0 });
      await warehouse().delete(`/authors/${res.body.id}`).expect(200);
    });

    it('NXB: SĐT/email sai định dạng → 400; email rỗng được chấp nhận; SĐT chuẩn hóa', async () => {
      await warehouse().post('/publishers', { name: `${PREFIX} NXB`, phone: '12345' }).expect(400);
      await warehouse().post('/publishers', { name: `${PREFIX} NXB`, email: 'khong-phai-email' }).expect(400);
      const res = await warehouse()
        .post('/publishers', { name: `${PREFIX} NXB`, phone: '028 3931 6289', email: '', address: '' })
        .expect(201);
      expect(res.body).toMatchObject({ phone: '02839316289', email: '', address: '' });
      expect(res.body.id).toMatch(/^NXB\d{3,}$/);
      await warehouse().patch('/publishers/KHONG_CO', { name: 'X' }).expect(404);
    });
  });
});
