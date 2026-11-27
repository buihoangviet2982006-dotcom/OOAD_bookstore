/**
 * Seed dữ liệu demo – dựa trên Mock của frontend (apps/web/src/mocks/seed.ts),
 * đã điều chỉnh để số liệu nhất quán với chứng từ (xem docs/database.md › Seed).
 *
 * An toàn khi chạy lại:
 * - Dùng createMany + skipDuplicates (INSERT ... ON CONFLICT DO NOTHING):
 *   bản ghi đã tồn tại thì bỏ qua, KHÔNG ghi đè dữ liệu người dùng đã sửa.
 * - Toàn bộ chạy trong 1 transaction: lỗi giữa chừng thì không ghi gì.
 * - Tồn kho được ghi thẳng giá trị cuối (đã tính sẵn bên dưới), không "chạy lại" chứng từ,
 *   nên seed nhiều lần không trừ/cộng kho lặp.
 *
 * Chạy: npx prisma db seed   (hoặc: node prisma/seed.ts)
 * Mật khẩu demo của các tài khoản mẫu: biến SEED_DEMO_PASSWORD, mặc định "123456".
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';
import prismaPkg from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const { PrismaClient } = prismaPkg;

// ── Kết nối: giống prisma.config.ts, không fallback sang DB mặc định ──
const envFile = path.join(import.meta.dirname, '..', '.env');
if (!process.env.DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Thiếu DATABASE_URL (xem apps/api/.env.example).');
const target = new URL(databaseUrl);
console.info(`[seed] DB đích: ${target.hostname}:${target.port || '5432'}${target.pathname}`);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

// ── Tiện ích ──

/** Hash mật khẩu bằng scrypt. Định dạng: scrypt$<salt hex>$<hash hex> (Auth module dùng chung định dạng). */
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

const at = (iso: string) => new Date(iso); // thời điểm, có múi giờ
const day = (ymd: string) => new Date(`${ymd}T00:00:00Z`); // cột kiểu DATE

/**
 * Phân bổ một khoản giảm giá cho các dòng theo tỷ lệ giá trị dòng – PHẢI giống
 * `src/promotions/pricing.ts › allocate` (phương pháp phần dư lớn nhất):
 * làm tròn xuống; phần dư chia từng đồng cho các dòng có phần lẻ lớn nhất (hòa → dòng trước),
 * nên không dòng nào bị giảm vượt giá trị dòng.
 * (Seed chạy độc lập bằng Node nên không import được code trong src.)
 */
function allocateDiscount(discount: number, lineValues: number[]): number[] {
  const total = lineValues.reduce((s, v) => s + v, 0);
  if (discount === 0 || total === 0) return lineValues.map(() => 0);
  const parts = lineValues.map((v) => Math.floor((discount * v) / total));
  const fractions = lineValues.map((v) => (discount * v) % total);
  let remainder = discount - parts.reduce((s, v) => s + v, 0);
  const order = lineValues.map((_, i) => i).sort((a, b) => fractions[b] - fractions[a] || a - b);
  for (const i of order) {
    if (remainder === 0) break;
    parts[i] += 1;
    remainder -= 1;
  }
  return parts;
}

/** 1 điểm cho mỗi 10.000đ giá trị thực trả của hóa đơn (sau đổi/trả). */
const pointsFor = (netValue: number) => Math.floor(netValue / 10_000);

// ── Danh mục ──

const theLoais = [
  { maTheLoai: 'VH', tenTheLoai: 'Văn học Việt Nam & Thế giới', moTa: 'Tiểu thuyết, truyện ngắn, tản văn kinh điển và đương đại' },
  { maTheLoai: 'KT', tenTheLoai: 'Kinh tế & Quản trị', moTa: 'Khởi nghiệp, quản trị doanh nghiệp, tài chính cá nhân, marketing' },
  { maTheLoai: 'KN', tenTheLoai: 'Tâm lý & Kỹ năng sống', moTa: 'Phát triển bản thân, tư duy phản biện, tâm lý học ứng dụng' },
  { maTheLoai: 'TN', tenTheLoai: 'Thiếu nhi & Truyện tranh', moTa: 'Sách tranh màu, truyện cổ tích, kiến thức bách khoa thiếu nhi' },
  { maTheLoai: 'CN', tenTheLoai: 'Công nghệ & Khoa học', moTa: 'Lập trình, kiến trúc phần mềm, khoa học thường thức, AI' },
  { maTheLoai: 'NN', tenTheLoai: 'Ngoại ngữ & Từ điển', moTa: 'Luyện thi IELTS, TOEIC, JLPT, HSK và ngữ pháp chuyên sâu' },
];

const tacGias = [
  { maTacGia: 'TG001', tenTacGia: 'Nguyễn Nhật Ánh', quocTich: 'Việt Nam', tieuSu: 'Nhà văn chuyên viết cho thanh thiếu niên với nhiều tác phẩm gắn liền tuổi thơ.' },
  { maTacGia: 'TG002', tenTacGia: 'Haruki Murakami', quocTich: 'Nhật Bản', tieuSu: 'Tiểu thuyết gia đương đại nổi tiếng toàn cầu người Nhật Bản.' },
  { maTacGia: 'TG003', tenTacGia: 'Daniel Kahneman', quocTich: 'Israel - Mỹ', tieuSu: 'Nhà tâm lý học đạt giải Nobel Kinh tế, tác giả Tư duy nhanh và chậm.' },
  { maTacGia: 'TG004', tenTacGia: 'Robert C. Martin', quocTich: 'Mỹ', tieuSu: 'Kỹ sư phần mềm, tác giả bộ sách Clean Code và Clean Architecture.' },
  { maTacGia: 'TG005', tenTacGia: 'Morgan Housel', quocTich: 'Mỹ', tieuSu: 'Chuyên gia tài chính hành vi, tác giả Tâm lý học về tiền.' },
  { maTacGia: 'TG006', tenTacGia: 'Tô Hoài', quocTich: 'Việt Nam', tieuSu: 'Nhà văn lớn của nền văn học Việt Nam hiện đại.' },
];

const nhaXuatBans = [
  { maNXB: 'NXB001', tenNXB: 'NXB Trẻ', soDienThoai: '02839316289', email: 'hopthubandoc@nxbtre.com.vn', diaChi: '161B Lý Chính Thắng, Quận 3, TP.HCM' },
  { maNXB: 'NXB002', tenNXB: 'Nhã Nam', soDienThoai: '02435146876', email: 'info@nhanam.vn', diaChi: '59 Đỗ Quang, Cầu Giấy, Hà Nội' },
  { maNXB: 'NXB003', tenNXB: 'Alpha Books', soDienThoai: '02437226234', email: 'lienhe@alphabooks.vn', diaChi: '176 Thái Hà, Đống Đa, Hà Nội' },
  { maNXB: 'NXB004', tenNXB: 'NXB Kim Đồng', soDienThoai: '02439434730', email: 'info@nxbkimdong.com.vn', diaChi: '55 Quang Trung, Hai Bà Trưng, Hà Nội' },
];

/*
 * Tồn kho cuối giữ đúng số của Mock FE. Tồn đầu kỳ (01/11/2026) được chọn để mọi chứng từ
 * bên dưới (nhập → kiểm kê → bán → đổi) chạy theo thứ tự thời gian đều hợp lệ:
 *   SP001: 15 +30 (PN 15/11) −1 (HĐ 20/11) +1 (KK 20/11) −2 (HĐ 24/11) −1 (đổi 25/11) = 42
 *   SP002:  0 +10 (PN 10/11) −1 (KK 20/11) −1 (HĐ 25/11)                              =  8
 *   SP003:  7 +20 (PN 05/11) −1 (HĐ 26/11)                                            = 26
 *   SP004:  1  +8 (PN 05/11) −3 (HĐ 25/11)                                            =  6
 *   SP005:  8 +30 (PN 15/11) −1 (HĐ 20/11) −2 (HĐ 26/11)                              = 35
 *   SP006:  6  −3 (HĐ 24/11) +1 (trả lại khi đổi 25/11)                               =  4
 *   SP007:  0                                                                          =  0
 */
const sachs = [
  { maSach: 'SP001', isbn: '978-604-1-20841-2', tenSach: 'Mắt Biếc (Bìa Mềm Tái Bản)', maTheLoai: 'VH', maTacGia: 'TG001', maNXB: 'NXB001', namXuatBan: 2024, giaNhap: 72000, giaBan: 115000, soLuongTon: 42, mucTonToiThieu: 15, viTriKe: 'Kệ A1 - Tầng 1', moTa: 'Câu chuyện tình đơn phương trong trẻo gắn với làng Đo Đo và phố thị.' },
  { maSach: 'SP002', isbn: '978-604-3-89210-4', tenSach: 'Rừng Na Uy', maTheLoai: 'VH', maTacGia: 'TG002', maNXB: 'NXB002', namXuatBan: 2025, giaNhap: 95000, giaBan: 155000, soLuongTon: 8, mucTonToiThieu: 12, viTriKe: 'Kệ A2 - Tầng 1', moTa: 'Tiểu thuyết nổi tiếng nhất của Haruki Murakami về tuổi trẻ và nỗi cô đơn.' },
  { maSach: 'SP003', isbn: '978-604-9-91204-8', tenSach: 'Tư Duy Nhanh Và Chậm', maTheLoai: 'KN', maTacGia: 'TG003', maNXB: 'NXB003', namXuatBan: 2024, giaNhap: 165000, giaBan: 269000, soLuongTon: 26, mucTonToiThieu: 10, viTriKe: 'Kệ B1 - Tầng 1', moTa: 'Khám phá hai hệ thống tư duy chi phối cách con người đưa ra quyết định.' },
  { maSach: 'SP004', isbn: '978-604-7-74102-9', tenSach: 'Clean Architecture - Kiến Trúc Phần Mềm Tinh Gọn', maTheLoai: 'CN', maTacGia: 'TG004', maNXB: 'NXB003', namXuatBan: 2025, giaNhap: 150000, giaBan: 245000, soLuongTon: 6, mucTonToiThieu: 10, viTriKe: 'Kệ C3 - Tầng 2', moTa: 'Nguyên lý thiết kế kiến trúc hệ thống bền vững, dễ bảo trì và mở rộng.' },
  { maSach: 'SP005', isbn: '978-604-3-45112-2', tenSach: 'Tâm Lý Học Về Tiền', maTheLoai: 'KT', maTacGia: 'TG005', maNXB: 'NXB001', namXuatBan: 2025, giaNhap: 105000, giaBan: 175000, soLuongTon: 35, mucTonToiThieu: 12, viTriKe: 'Kệ B2 - Tầng 1', moTa: '19 câu chuyện ngắn khám phá cách con người suy nghĩ về tiền bạc và hạnh phúc.' },
  { maSach: 'SP006', isbn: '978-604-2-28910-5', tenSach: 'Dế Mèn Phiêu Lưu Ký (Ấn Bản Minh Họa Màu)', maTheLoai: 'TN', maTacGia: 'TG006', maNXB: 'NXB004', namXuatBan: 2024, giaNhap: 58000, giaBan: 98000, soLuongTon: 4, mucTonToiThieu: 15, viTriKe: 'Kệ D1 - Tầng 1', moTa: 'Tác phẩm thiếu nhi kinh điển Việt Nam với tranh minh họa màu sống động.' },
  // Hết hàng nhưng vẫn đang kinh doanh: trạng thái lưu ACTIVE, "hết hàng" suy ra từ tồn = 0.
  { maSach: 'SP007', isbn: '978-604-1-22510-5', tenSach: 'Cho Tôi Xin Một Vé Đi Tuổi Thơ', maTheLoai: 'VH', maTacGia: 'TG001', maNXB: 'NXB001', namXuatBan: 2024, giaNhap: 55000, giaBan: 92000, soLuongTon: 0, mucTonToiThieu: 10, viTriKe: 'Kệ A1 - Tầng 1', moTa: 'Chuyến tàu trở về thế giới hồn nhiên của tuổi thơ.' },
];
const giaNhapCua = (maSach: string) => sachs.find((s) => s.maSach === maSach)!.giaNhap;
const tenSachCua = (maSach: string) => sachs.find((s) => s.maSach === maSach)!.tenSach;

// ── Nhân viên & tài khoản ──

const nhanViens = [
  { maNV: 'NV001', hoTen: 'Nguyễn Minh Anh', boPhan: 'MANAGER', chucVu: 'Cửa hàng trưởng', soDienThoai: '0903128456', email: 'minhanh@mocbooks.vn', ngayVaoLam: day('2023-03-01'), luongCoBan: 18500000, trangThai: 'WORKING', diaChi: '82 Võ Văn Tần, Quận 3, TP.HCM' },
  { maNV: 'NV002', hoTen: 'Lê Phương Thảo', boPhan: 'SALES', chucVu: 'Thu ngân & Tư vấn bán hàng', soDienThoai: '0918452789', email: 'phuongthao@mocbooks.vn', ngayVaoLam: day('2024-06-15'), luongCoBan: 9500000, trangThai: 'WORKING', diaChi: '19 Nguyễn Thượng Hiền, Bình Thạnh, TP.HCM' },
  { maNV: 'NV003', hoTen: 'Trần Hoàng Nam', boPhan: 'WAREHOUSE', chucVu: 'Phụ trách Kho & Kiểm soát hàng hóa', soDienThoai: '0987654321', email: 'hoangnam@mocbooks.vn', ngayVaoLam: day('2024-01-10'), luongCoBan: 11000000, trangThai: 'WORKING', diaChi: '304 Điện Biên Phủ, Quận 10, TP.HCM' },
  { maNV: 'NV004', hoTen: 'Bùi Khánh Linh', boPhan: 'SALES', chucVu: 'Nhân viên bán hàng ca chiều', soDienThoai: '0965321987', email: 'khanhlinh@mocbooks.vn', ngayVaoLam: day('2025-02-01'), luongCoBan: 8800000, trangThai: 'ON_LEAVE', diaChi: '54 Trần Quang Diệu, Quận 3, TP.HCM' },
] as const;

function buildTaiKhoans() {
  const password = process.env.SEED_DEMO_PASSWORD || '123456';
  const rows = [
    { maTaiKhoan: 'TK001', tenDangNhap: 'minhanh.ql', maNV: 'NV001', vaiTro: 'MANAGER', trangThai: 'ACTIVE', lanDangNhapCuoi: at('2026-11-26T08:05:00+07:00'), ngayTao: at('2023-03-01T09:00:00+07:00') },
    { maTaiKhoan: 'TK002', tenDangNhap: 'thao.bh', maNV: 'NV002', vaiTro: 'SALES', trangThai: 'ACTIVE', lanDangNhapCuoi: at('2026-11-26T08:30:00+07:00'), ngayTao: at('2024-06-15T09:00:00+07:00') },
    { maTaiKhoan: 'TK003', tenDangNhap: 'hoangnam.kho', maNV: 'NV003', vaiTro: 'WAREHOUSE', trangThai: 'ACTIVE', lanDangNhapCuoi: at('2026-11-26T07:50:00+07:00'), ngayTao: at('2024-01-10T09:00:00+07:00') },
    // Tài khoản bị khóa để demo chức năng mở khóa.
    { maTaiKhoan: 'TK004', tenDangNhap: 'linh.bh', maNV: 'NV004', vaiTro: 'SALES', trangThai: 'LOCKED', lanDangNhapCuoi: at('2026-10-30T21:15:00+07:00'), ngayTao: at('2025-02-01T09:00:00+07:00') },
  ] as const;
  return rows.map((r) => ({
    ...r,
    emailKhoiPhuc: nhanViens.find((nv) => nv.maNV === r.maNV)!.email,
    matKhauHash: hashPassword(password),
  }));
}

// ── Nhà cung cấp & khuyến mãi ──

const nhaCungCaps = [
  { maNCC: 'NCC001', tenNCC: 'Công ty Phát hành Sách NXB Trẻ', maSoThue: '0301458921', nguoiLienHe: 'Trần Minh Quân', soDienThoai: '02839316289', email: 'kinhdoanh@nxbtre.com.vn', diaChi: '161B Lý Chính Thắng, Phường Võ Thị Sáu, Quận 3, TP.HCM' },
  { maNCC: 'NCC002', tenNCC: 'Công ty Cổ phần Văn hóa & Truyền thông Nhã Nam', maSoThue: '0102849102', nguoiLienHe: 'Đỗ Thu Hà', soDienThoai: '02435146876', email: 'daily@nhanam.vn', diaChi: '59 Đỗ Quang, Phường Trung Hòa, Cầu Giấy, Hà Nội' },
  { maNCC: 'NCC003', tenNCC: 'Công ty Cổ phần Sách Alpha (Alpha Books)', maSoThue: '0101928374', nguoiLienHe: 'Lê Đức Thịnh', soDienThoai: '02437226234', email: 'b2b@alphabooks.vn', diaChi: '176 Thái Hà, Quận Đống Đa, Hà Nội' },
];

const ctkms = [
  { maCTKM: 'KM-TRITHUC11', tenCTKM: 'Tuần lễ Tri thức - Giảm 10%', moTa: 'Giảm 10% tối đa 100.000đ cho hóa đơn từ 400.000đ trở lên', loaiGiam: 'PERCENT', giaTriGiam: 10, giamToiDa: 100000, donToiThieu: 400000, maTheLoai: null, ngayBatDau: day('2026-11-01'), ngayKetThuc: day('2026-12-15') },
  { maCTKM: 'KM-THIEUNHI', tenCTKM: 'Góc Đọc Cuối Tuần Cho Bé', moTa: 'Giảm trực tiếp 30.000đ khi mua sách Thiếu nhi từ 250.000đ', loaiGiam: 'FIXED', giaTriGiam: 30000, giamToiDa: null, donToiThieu: 250000, maTheLoai: 'TN', ngayBatDau: day('2026-11-15'), ngayKetThuc: day('2026-12-31') },
  { maCTKM: 'KM-CUOINAM', tenCTKM: 'Hội Sách Mùa Đông 2026', moTa: 'Ưu đãi 15% toàn bộ cửa hàng nhân dịp tổng kết năm', loaiGiam: 'PERCENT', giaTriGiam: 15, giamToiDa: 150000, donToiThieu: 500000, maTheLoai: null, ngayBatDau: day('2026-12-20'), ngayKetThuc: day('2026-12-31') },
] as const;

// soLanDaDung = số hóa đơn seed thực sự dùng mã (Mock ghi 28/64/50 lượt không có hóa đơn tương ứng).
const maGiamGias = [
  { maCode: 'MOC50K', moTa: 'Giảm 50.000đ cho đơn hàng từ 500.000đ', loaiGiam: 'FIXED', giaTriGiam: 50000, giamToiDa: null, donToiThieu: 500000, soLanToiDa: 100, soLanDaDung: 1, ngayBatDau: day('2026-11-01'), hanSuDung: day('2026-12-31'), dangHoatDong: true },
  { maCode: 'BANMOI15', moTa: 'Giảm 15% (tối đa 60.000đ) cho khách hàng thành viên mới', loaiGiam: 'PERCENT', giaTriGiam: 15, giamToiDa: 60000, donToiThieu: 200000, soLanToiDa: 200, soLanDaDung: 1, ngayBatDau: day('2026-10-01'), hanSuDung: day('2026-12-31'), dangHoatDong: true },
  { maCode: 'VIP100K', moTa: 'Tri ân hạng Vàng & Kim Cương giảm 100.000đ đơn từ 800.000đ', loaiGiam: 'FIXED', giaTriGiam: 100000, giamToiDa: null, donToiThieu: 800000, soLanToiDa: 50, soLanDaDung: 0, ngayBatDau: day('2026-09-01'), hanSuDung: day('2026-11-20'), dangHoatDong: false },
] as const;

// ── Hóa đơn bán hàng ──

type InvoiceInput = {
  maHoaDon: string;
  ngayLap: Date;
  maKH: string | null;
  maNV: string;
  lines: { maSach: string; soLuong: number; donGia: number }[];
  maCTKM?: string;
  tienGiamCTKM?: number;
  maCode?: string;
  tienGiamVoucher?: number;
  phuongThuc: 'CASH' | 'TRANSFER' | 'CARD';
  tienKhachDua?: number;
  ghiChu?: string;
};

/*
 * Giảm giá đã kiểm tra theo quy tắc demo (CTKM trước, voucher sau):
 *   HD-2611-1042: tạm tính 619.000 ≥ 500.000 → MOC50K giảm 50.000 → 569.000
 *   HD-2511-1039: KM-TRITHUC11 10% × 890.000 = 89.000 (≤ 100.000) → 801.000
 *   HD-2411-1031: không giảm → 524.000
 *   HD-2011-1018: BANMOI15 15% × 290.000 = 43.500 (≤ 60.000) → 246.500  (bổ sung, xem docs)
 */
const invoiceInputs: InvoiceInput[] = [
  { maHoaDon: 'HD-2011-1018', ngayLap: at('2026-11-20T11:05:00+07:00'), maKH: 'KH004', maNV: 'NV002', lines: [{ maSach: 'SP001', soLuong: 1, donGia: 115000 }, { maSach: 'SP005', soLuong: 1, donGia: 175000 }], maCode: 'BANMOI15', tienGiamVoucher: 43500, phuongThuc: 'CASH', tienKhachDua: 250000 },
  { maHoaDon: 'HD-2411-1031', ngayLap: at('2026-11-24T14:20:00+07:00'), maKH: 'KH003', maNV: 'NV002', lines: [{ maSach: 'SP001', soLuong: 2, donGia: 115000 }, { maSach: 'SP006', soLuong: 3, donGia: 98000 }], phuongThuc: 'CARD' },
  { maHoaDon: 'HD-2511-1039', ngayLap: at('2026-11-25T16:40:00+07:00'), maKH: 'KH002', maNV: 'NV002', lines: [{ maSach: 'SP004', soLuong: 3, donGia: 245000 }, { maSach: 'SP002', soLuong: 1, donGia: 155000 }], maCTKM: 'KM-TRITHUC11', tienGiamCTKM: 89000, phuongThuc: 'TRANSFER' },
  { maHoaDon: 'HD-2611-1042', ngayLap: at('2026-11-26T09:15:00+07:00'), maKH: 'KH001', maNV: 'NV002', lines: [{ maSach: 'SP003', soLuong: 1, donGia: 269000 }, { maSach: 'SP005', soLuong: 2, donGia: 175000 }], maCode: 'MOC50K', tienGiamVoucher: 50000, phuongThuc: 'CASH', tienKhachDua: 600000, ghiChu: 'Tặng kèm bookmark gỗ Mộc Books' },
];

function buildInvoices() {
  const hoaDons: Prisma.HoaDonCreateManyInput[] = [];
  const chiTiets: Prisma.ChiTietHoaDonCreateManyInput[] = [];
  const thanhToans: Prisma.ThanhToanCreateManyInput[] = [];
  for (const [index, inv] of invoiceInputs.entries()) {
    const lineValues = inv.lines.map((l) => l.soLuong * l.donGia);
    const tongTienHang = lineValues.reduce((s, v) => s + v, 0);
    const giamCTKM = inv.tienGiamCTKM ?? 0;
    const giamVoucher = inv.tienGiamVoucher ?? 0;
    const thanhToanCuoi = tongTienHang - giamCTKM - giamVoucher;
    // Seed chỉ có CTKM toàn cửa hàng nên mọi dòng đều đủ điều kiện CTKM.
    const ctkmParts = allocateDiscount(giamCTKM, lineValues);
    const voucherParts = allocateDiscount(giamVoucher, lineValues.map((v, i) => v - ctkmParts[i]));

    hoaDons.push({
      maHoaDon: inv.maHoaDon,
      ngayLap: inv.ngayLap,
      tongTienHang,
      tienGiamCTKM: giamCTKM,
      tienGiamVoucher: giamVoucher,
      thanhToanCuoi,
      // Hóa đơn 24/11 đã đổi 1 sách → đổi/trả một phần.
      trangThai: inv.maHoaDon === 'HD-2411-1031' ? 'PARTIAL_RETURN' : 'COMPLETED',
      maKH: inv.maKH,
      maNV: inv.maNV,
      maCTKM: inv.maCTKM ?? null,
      maCode: inv.maCode ?? null,
      ghiChu: inv.ghiChu ?? null,
    });
    inv.lines.forEach((l, i) =>
      chiTiets.push({
        maHoaDon: inv.maHoaDon,
        maSach: l.maSach,
        tenSach: tenSachCua(l.maSach),
        soLuongBan: l.soLuong,
        donGiaBan: l.donGia,
        giamGia: ctkmParts[i] + voucherParts[i],
        giaVon: giaNhapCua(l.maSach),
      }),
    );
    thanhToans.push({
      maThanhToan: `TT-${String(index + 1).padStart(4, '0')}`,
      ngayThanhToan: inv.ngayLap,
      soTien: thanhToanCuoi,
      phuongThuc: inv.phuongThuc,
      tienKhachDua: inv.tienKhachDua ?? null,
      maHoaDon: inv.maHoaDon,
    });
  }
  return { hoaDons, chiTiets, thanhToans };
}

// ── Đổi/trả: đổi 1 "Dế Mèn" (98.000, hóa đơn không giảm giá) lấy 1 "Mắt Biếc" (115.000) → khách bù 17.000 ──

const phieuDoiTras = [
  { maDoiTra: 'DT-2511-2001', ngayDoiTra: at('2026-11-25T10:30:00+07:00'), lyDo: 'Bị thiếu trang in ở chương 4 (lỗi nhà xuất bản)', hinhThucXuLy: 'EXCHANGE', tienHoanTra: 0, tienKhachBu: 17000, maHoaDon: 'HD-2411-1031', maNV: 'NV002' },
] as const;
const chiTietDoiTras = [
  // giaTriTra = phần lũy kế của tiền thực trả dòng gốc: floor(294.000 × 1/3) = 98.000 (src/returns/refund.ts)
  { maDoiTra: 'DT-2511-2001', maSach: 'SP006', soLuongTra: 1, tinhTrangSach: 'Lỗi in ấn từ NXB', donGiaHoan: 98000, giaTriTra: 98000, maSachDoi: 'SP001', donGiaSachDoi: 115000, giaVonSachDoi: 72000 },
];

// ── Khách hàng: điểm = Σ pointsFor(giá trị thực trả từng hóa đơn sau đổi/trả) ──

const khachHangs = [
  { maKH: 'KH001', hoTen: 'Phạm Quỳnh Hương', soDienThoai: '0909234567', email: 'quynhhuong.pham@gmail.com', diaChi: '45 Lê Văn Sỹ, Quận 3, TP.HCM', ngayTao: at('2025-04-12T10:00:00+07:00'), ghiChu: 'Yêu thích dòng sách tâm lý học và kinh tế, thường đặt trước ấn bản mới.', diemTichLuy: pointsFor(569000) }, // 56
  { maKH: 'KH002', hoTen: 'Đặng Quốc Bảo', soDienThoai: '0938876543', email: 'quocbao.dev@gmail.com', diaChi: '112 Nguyễn Hữu Cảnh, Bình Thạnh, TP.HCM', ngayTao: at('2024-11-05T14:20:00+07:00'), ghiChu: 'Mua sách công nghệ cho team kỹ thuật hàng tháng, cần xuất thông tin rõ.', diemTichLuy: pointsFor(801000) }, // 80
  { maKH: 'KH003', hoTen: 'Võ Thị Thanh Trúc', soDienThoai: '0974112334', email: 'thanhtruc.vo@yahoo.com', diaChi: '18 Phan Xích Long, Phú Nhuận, TP.HCM', ngayTao: at('2025-08-19T11:30:00+07:00'), ghiChu: null, diemTichLuy: pointsFor(524000 + 17000) }, // 54
  { maKH: 'KH004', hoTen: 'Hoàng Gia Huy', soDienThoai: '0912998776', email: 'giahuy.hoang@outlook.com', diaChi: '290 Hai Bà Trưng, Quận 1, TP.HCM', ngayTao: at('2026-09-01T09:00:00+07:00'), ghiChu: null, diemTichLuy: pointsFor(246500) }, // 24
];

// ── Nhập hàng & thanh toán NCC (số lượng thu nhỏ so với Mock để khớp tồn kho, xem docs) ──

const phieuNhaps = [
  { maPhieuNhap: 'PN-0511-290', ngayNhap: at('2026-11-05T09:00:00+07:00'), maNCC: 'NCC003', maNV: 'NV003', tongTien: 4500000, daThanhToan: 4500000, hanThanhToan: null, ghiChu: null },
  { maPhieuNhap: 'PN-1011-298', ngayNhap: at('2026-11-10T14:00:00+07:00'), maNCC: 'NCC002', maNV: 'NV001', tongTien: 950000, daThanhToan: 300000, hanThanhToan: day('2026-11-24'), ghiChu: 'Cần tất toán công nợ đợt 2 trong tuần này' },
  { maPhieuNhap: 'PN-1511-301', ngayNhap: at('2026-11-15T10:15:00+07:00'), maNCC: 'NCC001', maNV: 'NV003', tongTien: 5310000, daThanhToan: 1600000, hanThanhToan: day('2026-11-29'), ghiChu: 'Đợt nhập sách chủ lực tháng 11' },
];
const chiTietPhieuNhaps = [
  { maPhieuNhap: 'PN-0511-290', maSach: 'SP003', soLuongNhap: 20, donGiaNhap: 165000 }, // 3.300.000
  { maPhieuNhap: 'PN-0511-290', maSach: 'SP004', soLuongNhap: 8, donGiaNhap: 150000 }, // 1.200.000
  { maPhieuNhap: 'PN-1011-298', maSach: 'SP002', soLuongNhap: 10, donGiaNhap: 95000 }, // 950.000
  { maPhieuNhap: 'PN-1511-301', maSach: 'SP001', soLuongNhap: 30, donGiaNhap: 72000 }, // 2.160.000
  { maPhieuNhap: 'PN-1511-301', maSach: 'SP005', soLuongNhap: 30, donGiaNhap: 105000 }, // 3.150.000
];
const phieuThanhToanNCCs = [
  { maThanhToanNCC: 'PC-0511-035', ngayThanhToan: at('2026-11-05T09:30:00+07:00'), maPhieuNhap: 'PN-0511-290', soTienThanhToan: 4500000, phuongThuc: 'TRANSFER', maNV: 'NV001', ghiChu: 'Tất toán 100% đơn nhập Alpha Books' },
  { maThanhToanNCC: 'PC-1011-036', ngayThanhToan: at('2026-11-10T14:30:00+07:00'), maPhieuNhap: 'PN-1011-298', soTienThanhToan: 300000, phuongThuc: 'TRANSFER', maNV: 'NV001', ghiChu: 'Tạm ứng khi nhận hàng' },
  { maThanhToanNCC: 'PC-1511-041', ngayThanhToan: at('2026-11-15T10:30:00+07:00'), maPhieuNhap: 'PN-1511-301', soTienThanhToan: 1600000, phuongThuc: 'TRANSFER', maNV: 'NV001', ghiChu: 'Thanh toán tạm ứng 30% khi nhận hàng' },
] as const;

// ── Kiểm kê: số lượng hệ thống = tồn thực tế tại thời điểm kiểm kê (theo bảng tồn ở trên) ──

const phieuKiemKes = [
  { maKiemKe: 'KK-2011-009', ngayKiemKe: at('2026-11-20T17:30:00+07:00'), maNV: 'NV003', ghiChu: 'Kiểm kê định kỳ kệ Văn học & Thiếu nhi cuối tuần' },
];
const chiTietKiemKes = [
  { maKiemKe: 'KK-2011-009', maSach: 'SP002', soLuongHeThong: 10, soLuongThucTe: 9, lyDo: '1 cuốn rách bìa chuyển sang kệ sách mẫu trưng bày' },
  { maKiemKe: 'KK-2011-009', maSach: 'SP001', soLuongHeThong: 44, soLuongThucTe: 45, lyDo: 'Bổ sung 1 cuốn sót từ kho phụ' },
];

// ── Ghi dữ liệu ──

async function main() {
  const { hoaDons, chiTiets, thanhToans } = buildInvoices();
  const taiKhoans = buildTaiKhoans();
  const skip = { skipDuplicates: true } as const;

  const inserted = await prisma.$transaction(async (tx) => ({
    theLoai: (await tx.theLoai.createMany({ data: theLoais, ...skip })).count,
    tacGia: (await tx.tacGia.createMany({ data: tacGias, ...skip })).count,
    nhaXuatBan: (await tx.nhaXuatBan.createMany({ data: nhaXuatBans, ...skip })).count,
    sach: (await tx.sach.createMany({ data: sachs, ...skip })).count,
    nhanVien: (await tx.nhanVien.createMany({ data: [...nhanViens], ...skip })).count,
    taiKhoan: (await tx.taiKhoan.createMany({ data: taiKhoans, ...skip })).count,
    khachHang: (await tx.khachHang.createMany({ data: khachHangs, ...skip })).count,
    nhaCungCap: (await tx.nhaCungCap.createMany({ data: nhaCungCaps, ...skip })).count,
    ctkm: (await tx.chuongTrinhKhuyenMai.createMany({ data: [...ctkms], ...skip })).count,
    maGiamGia: (await tx.maGiamGia.createMany({ data: [...maGiamGias], ...skip })).count,
    hoaDon: (await tx.hoaDon.createMany({ data: hoaDons, ...skip })).count,
    chiTietHoaDon: (await tx.chiTietHoaDon.createMany({ data: chiTiets, ...skip })).count,
    thanhToan: (await tx.thanhToan.createMany({ data: thanhToans, ...skip })).count,
    phieuDoiTra: (await tx.phieuDoiTra.createMany({ data: [...phieuDoiTras], ...skip })).count,
    chiTietDoiTra: (await tx.chiTietDoiTra.createMany({ data: chiTietDoiTras, ...skip })).count,
    phieuNhap: (await tx.phieuNhap.createMany({ data: phieuNhaps, ...skip })).count,
    chiTietPhieuNhap: (await tx.chiTietPhieuNhap.createMany({ data: chiTietPhieuNhaps, ...skip })).count,
    phieuThanhToanNCC: (await tx.phieuThanhToanNCC.createMany({ data: [...phieuThanhToanNCCs], ...skip })).count,
    phieuKiemKe: (await tx.phieuKiemKe.createMany({ data: phieuKiemKes, ...skip })).count,
    chiTietKiemKe: (await tx.chiTietKiemKe.createMany({ data: chiTietKiemKes, ...skip })).count,
  }));

  const total = Object.values(inserted).reduce((s, n) => s + n, 0);
  console.info(`[seed] Đã thêm mới ${total} bản ghi (bản ghi đã tồn tại được giữ nguyên).`);
  console.table(inserted);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
