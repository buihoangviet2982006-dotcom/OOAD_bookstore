import type { Prisma } from '@prisma/client';
import { todayInStore } from './store-time.js';

/** Sequence PostgreSQL cho từng loại chứng từ (tạo trong migration). */
const SEQUENCES = {
  HD: 'hoa_don_so_thu_tu', // hóa đơn
  DT: 'phieu_doi_tra_so_thu_tu', // phiếu đổi / trả
  PN: 'phieu_nhap_so_thu_tu', // phiếu nhập
  PC: 'phieu_chi_so_thu_tu', // phiếu chi thanh toán NCC
  KK: 'phieu_kiem_ke_so_thu_tu', // phiếu kiểm kê / điều chỉnh kho
} as const;

export type DocumentPrefix = keyof typeof SEQUENCES;

/**
 * Mã chứng từ `<tiền tố>-ddMM-<số>`, số lấy từ sequence nên không trùng kể cả khi lập đồng thời
 * (sequence không quay lui khi transaction bị hủy → số có thể nhảy cách, chấp nhận).
 */
export async function nextDocumentCode(tx: Prisma.TransactionClient, prefix: DocumentPrefix): Promise<string> {
  const [{ n }] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval(${SEQUENCES[prefix]}::regclass) AS n`;
  const [, month, day] = todayInStore().split('-');
  return `${prefix}-${day}${month}-${n}`;
}
