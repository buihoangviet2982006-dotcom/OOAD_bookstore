import { ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { CurrentAccount } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateReturnDto } from './dto/return.dto.js';
import { ReturnsService } from './returns.service.js';

describe('return preview settlement confirmation', () => {
  const staff = { maNV: 'TEST-STAFF' } as CurrentAccount;
  const dto: CreateReturnDto = {
    invoiceId: 'TEST-INVOICE', type: 'EXCHANGE', exchangeBookId: 'TEST-NEW',
    returnItems: [{ bookId: 'TEST-OLD', quantity: 1 }], reason: 'Test', requestKey: 'TEST-REQUEST',
    expectedRefundAmount: 0, expectedExtraPayment: 15000,
  };

  function fixture() {
    let price = 35000;
    const invoice = {
      maHoaDon: dto.invoiceId, ngayLap: new Date(), thanhToanCuoi: 20000, maKH: 'TEST-KH', doiTras: [],
      chiTiets: [{ maSach: 'TEST-OLD', tenSach: 'Old', soLuongBan: 1, donGiaBan: 20000, giamGia: 0 }],
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ ma_hoa_don: dto.invoiceId }]),
      hoaDon: { findUnique: vi.fn().mockResolvedValue(invoice), update: vi.fn() },
      sach: { findUnique: vi.fn(() => ({ maSach: 'TEST-NEW', tenSach: 'New', giaBan: price, giaNhap: 10000, soLuongTon: 1, trangThai: 'ACTIVE' })), update: vi.fn(), updateMany: vi.fn() },
      phieuDoiTra: { create: vi.fn() }, $executeRaw: vi.fn(),
    };
    const prisma = { ...tx,
      $transaction: vi.fn((fn) => fn(tx)),
      phieuDoiTra: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const service = new ReturnsService(prisma as unknown as PrismaService);
    return { tx, prisma, service, setPrice: (next: number) => { price = next; } };
  }

  it('35000 → 50000 after preview returns 409 before any document/stock/points write', async () => {
    const f = fixture();
    const { expectedRefundAmount: _refund, expectedExtraPayment: _extra, ...previewRequest } = dto;
    expect(await f.service.preview(previewRequest)).toMatchObject({ valid: true, extraPayment: 15000 });
    f.setPrice(50000);
    await expect(f.service.create(dto, staff)).rejects.toThrow(ConflictException);
    expect(f.tx.phieuDoiTra.create).not.toHaveBeenCalled();
    expect(f.tx.sach.update).not.toHaveBeenCalled();
    expect(f.tx.sach.updateMany).not.toHaveBeenCalled();
    expect(f.tx.hoaDon.update).not.toHaveBeenCalled();
    expect(f.tx.$executeRaw).not.toHaveBeenCalled();
    expect(await f.service.preview(dto)).toMatchObject({ valid: true, extraPayment: 30000 });
  });

  it('replays the saved request even after prices change and expectations are stale', async () => {
    const f = fixture();
    f.setPrice(50000);
    f.prisma.phieuDoiTra.findUnique.mockResolvedValue({
      maDoiTra: 'TEST-RETURN', maNV: staff.maNV, maHoaDon: dto.invoiceId, hinhThucXuLy: 'EXCHANGE',
      tienHoanTra: 0, tienKhachBu: 15000, ngayDoiTra: new Date(),
      hoaDon: { maKH: null, chiTiets: [] }, nhanVien: { hoTen: 'Test' },
      chiTiets: [{ maSach: 'TEST-OLD', soLuongTra: 1, maSachDoi: 'TEST-NEW', donGiaHoan: 20000, giaTriTra: 20000 }],
    } as never);
    expect(await f.service.create(dto, staff)).toMatchObject({ id: 'TEST-RETURN', extraPayment: 15000 });
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('exchange cannot omit or forge invalid expected amounts', async () => {
    for (const expectedExtraPayment of [undefined, -1, 1.5]) {
      expect(await validate(plainToInstance(CreateReturnDto, Object.assign({}, dto, { expectedExtraPayment })))).not.toHaveLength(0);
    }
    expect(await validate(plainToInstance(CreateReturnDto, dto))).toHaveLength(0);
  });
});
