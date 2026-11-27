import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TrimOptional } from '../../common/transforms.js';

const MAX_MONEY = 10_000_000_000;
const REQUEST_KEY = /^[A-Za-z0-9-]{8,64}$/;
const PAYMENT_METHODS = ['CASH', 'TRANSFER', 'CARD'] as const;

/** Một dòng phiếu nhập: sách + số lượng + giá nhập. Thành tiền / tổng do backend tính. */
export class PurchaseItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Thiếu mã sách trong phiếu nhập.' })
  bookId: string;

  @IsInt({ message: 'Số lượng nhập phải là số nguyên.' })
  @Min(1, { message: 'Số lượng nhập phải lớn hơn 0.' })
  @Max(100_000)
  quantity: number;

  @IsInt({ message: 'Giá nhập phải là số nguyên (VNĐ).' })
  @Min(1, { message: 'Giá nhập phải lớn hơn 0.' })
  @Max(1_000_000_000)
  importPrice: number;
}

/**
 * Lập phiếu nhập. Trường FE gửi thừa (supplierName, createdBy, totalAmount, debtAmount, subtotal…)
 * bị loại bỏ – backend tự tính tổng, công nợ; người lập lấy từ phiên đăng nhập.
 */
export class CreatePurchaseOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn nhà cung cấp.' })
  supplierId: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Vui lòng thêm ít nhất 1 đầu sách vào phiếu nhập.' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  /** Trả trước khi nhập (tạo phiếu chi trong cùng transaction). */
  @IsOptional()
  @IsInt({ message: 'Số tiền trả trước phải là số nguyên (VNĐ).' })
  @Min(0, { message: 'Số tiền trả trước không được âm.' })
  @Max(MAX_MONEY)
  paidAmount?: number;

  @IsOptional()
  @IsIn(PAYMENT_METHODS, { message: 'Phương thức trả trước không hợp lệ.' })
  prepaymentMethod?: (typeof PAYMENT_METHODS)[number];

  /** Bắt buộc khi còn nợ. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Hạn trả công nợ phải có dạng YYYY-MM-DD.' })
  @IsDateString({ strict: true }, { message: 'Hạn trả công nợ không tồn tại.' })
  dueDate?: string | null;

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @Matches(REQUEST_KEY, { message: 'Khóa yêu cầu (requestKey) không hợp lệ.' })
  requestKey: string;
}

/** Ghi nhận thanh toán NCC – bắt buộc chọn phiếu nhập (quyết định review #8). */
export class CreateSupplierPaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn nhà cung cấp.' })
  supplierId: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn phiếu nhập cần thanh toán.' })
  purchaseOrderId: string;

  @IsInt({ message: 'Số tiền thanh toán phải là số nguyên (VNĐ).' })
  @Min(1, { message: 'Số tiền thanh toán phải lớn hơn 0.' })
  @Max(MAX_MONEY)
  amount: number;

  @IsIn(PAYMENT_METHODS, { message: 'Phương thức thanh toán không hợp lệ.' })
  paymentMethod: (typeof PAYMENT_METHODS)[number];

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @Matches(REQUEST_KEY, { message: 'Khóa yêu cầu (requestKey) không hợp lệ.' })
  requestKey: string;
}
