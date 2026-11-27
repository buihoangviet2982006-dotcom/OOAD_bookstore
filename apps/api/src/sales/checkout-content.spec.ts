import type { ChiTietHoaDon, HoaDon, ThanhToan } from '@prisma/client';
import { contentDifferences, contentOfInvoice, contentOfRequest } from './checkout-content.js';
import type { CartDto } from './dto/invoice.dto.js';

const request = (extra: Partial<CartDto> = {}): CartDto => ({
  items: [
    { bookId: 'SP005', quantity: 2 },
    { bookId: 'SP003', quantity: 1 },
  ],
  customerId: 'KH001',
  voucherCode: 'MOC50K',
  paymentMethod: 'CASH',
  amountPaid: 600000,
  ...extra,
});

/** Hóa đơn đã lưu tương ứng với `request()`. */
const invoice = {
  maKH: 'KH001',
  maCTKM: null,
  maCode: 'MOC50K',
  chiTiets: [
    { maSach: 'SP003', soLuongBan: 1 },
    { maSach: 'SP005', soLuongBan: 2 },
  ],
  thanhToans: [{ phuongThuc: 'CASH', tienKhachDua: 600000 }],
} as unknown as HoaDon & { chiTiets: ChiTietHoaDon[]; thanhToans: ThanhToan[] };

const diff = (dto: CartDto) => contentDifferences(contentOfRequest(dto), contentOfInvoice(invoice));

describe('checkout-content – so sánh nội dung khi gửi lại cùng requestKey', () => {
  it('cùng nội dung: không phụ thuộc thứ tự dòng, dòng trùng được gộp', () => {
    expect(diff(request())).toEqual([]);
    expect(
      diff(
        request({
          items: [
            { bookId: 'SP003', quantity: 1 },
            { bookId: 'SP005', quantity: 1 },
            { bookId: 'SP005', quantity: 1 },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('khác sách / số lượng / khách / voucher / phương thức / tiền khách đưa → liệt kê mục khác', () => {
    expect(diff(request({ items: [{ bookId: 'SP003', quantity: 1 }] }))).toEqual(['sách / số lượng']);
    expect(diff(request({ customerId: null }))).toEqual(['khách hàng']);
    expect(diff(request({ voucherCode: undefined }))).toEqual(['mã giảm giá']);
    expect(diff(request({ promotionId: 'KM-TRITHUC11' }))).toEqual(['chương trình khuyến mãi']);
    expect(diff(request({ amountPaid: 700000 }))).toEqual(['tiền khách đưa']);
    expect(diff(request({ paymentMethod: 'TRANSFER' }))).toEqual(['phương thức thanh toán', 'tiền khách đưa']);
  });

  it('chuyển khoản / thẻ: bỏ qua tiền khách đưa', () => {
    const transfer = {
      ...invoice,
      thanhToans: [{ phuongThuc: 'TRANSFER', tienKhachDua: null }],
    } as unknown as typeof invoice;
    const content = contentOfRequest(request({ paymentMethod: 'TRANSFER', amountPaid: 123 }));
    expect(contentDifferences(content, contentOfInvoice(transfer))).toEqual([]);
  });
});
