import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { nextSequentialCode } from '../common/codes.js';
import { bookStatus } from './book.mapper.js';
import { BookDto } from './dto/book.dto.js';

describe('bookStatus – trạng thái hiển thị', () => {
  it('đang kinh doanh, còn tồn → ACTIVE', () => expect(bookStatus('ACTIVE', 5)).toBe('ACTIVE'));
  it('đang kinh doanh, tồn = 0 → OUT_OF_STOCK', () => expect(bookStatus('ACTIVE', 0)).toBe('OUT_OF_STOCK'));
  it('ngừng kinh doanh luôn DISCONTINUED dù còn tồn', () => {
    expect(bookStatus('DISCONTINUED', 12)).toBe('DISCONTINUED');
    expect(bookStatus('DISCONTINUED', 0)).toBe('DISCONTINUED');
  });
});

describe('nextSequentialCode', () => {
  it('lấy số lớn nhất + 1, bỏ qua mã không đúng mẫu', () => {
    expect(nextSequentialCode('TG', ['TG001', 'TG009', 'X12', 'TGabc'])).toBe('TG010');
  });
  it('chưa có mã nào → 001', () => expect(nextSequentialCode('NXB', [])).toBe('NXB001'));
});

describe('BookDto – ISBN', () => {
  const base = {
    title: 'Sách test',
    categoryId: 'VH',
    authorId: 'TG001',
    publisherId: 'NXB001',
    importPrice: 1000,
    sellPrice: 2000,
    minStock: 0,
  };
  const errorsFor = async (isbn: string) =>
    (await validate(plainToInstance(BookDto, { ...base, isbn }))).map((e) => e.property);

  it.each(['978-604-1-20841-2', '9786041208412', '604-1-20841-2'])('hợp lệ: %s', async (isbn) => {
    expect(await errorsFor(isbn)).not.toContain('isbn');
  });
  it.each(['123', '978-604-1-20841-23', '97860412084AB', ''])('không hợp lệ: "%s"', async (isbn) => {
    expect(await errorsFor(isbn)).toContain('isbn');
  });
});
