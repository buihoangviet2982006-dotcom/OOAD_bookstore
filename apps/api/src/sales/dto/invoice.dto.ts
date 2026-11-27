import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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

/** Một dòng giỏ hàng: chỉ mã sách + số lượng. Giá, giá vốn, thành tiền do backend lấy từ DB. */
export class CartItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Thiếu mã sách trong giỏ hàng.' })
  bookId: string;

  @IsInt({ message: 'Số lượng mua phải là số nguyên.' })
  @Min(1, { message: 'Số lượng mua phải lớn hơn 0.' })
  @Max(1000, { message: 'Số lượng mua mỗi dòng tối đa 1000.' })
  quantity: number;
}

/**
 * Dữ liệu giỏ hàng để xem trước (preview). Các trường FE gửi thừa (unitPrice, subtotal, discountAmount,
 * totalAmount, cashierId…) bị ValidationPipe loại bỏ – backend không tin chúng.
 */
export class CartDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Giỏ hàng trống, vui lòng chọn ít nhất 1 cuốn sách.' })
  @ArrayMaxSize(100, { message: 'Một hóa đơn tối đa 100 dòng.' })
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  /** null / bỏ trống = khách lẻ. */
  @TrimOptional()
  @IsOptional()
  @IsString()
  customerId?: string | null;

  @TrimOptional()
  @IsOptional()
  @IsString()
  promotionId?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() || undefined : value,
  )
  @IsOptional()
  @IsString()
  voucherCode?: string;

  @IsIn(['CASH', 'TRANSFER', 'CARD'], { message: 'Phương thức thanh toán không hợp lệ.' })
  paymentMethod: 'CASH' | 'TRANSFER' | 'CARD';

  /** Tiền khách đưa (chỉ dùng cho tiền mặt). */
  @IsOptional()
  @IsInt({ message: 'Tiền khách đưa phải là số nguyên (VNĐ).' })
  @Min(0)
  @Max(MAX_MONEY)
  amountPaid?: number;
}

/** Lập hóa đơn = giỏ hàng + khóa yêu cầu (chống lặp) + tổng tiền khách đã thấy (đối chiếu). */
export class CreateInvoiceDto extends CartDto {
  /** Khóa duy nhất cho mỗi lần thanh toán (FE sinh UUID). Gửi lại cùng khóa → trả hóa đơn đã tạo. */
  @Matches(/^[A-Za-z0-9-]{8,64}$/, { message: 'Khóa yêu cầu (requestKey) không hợp lệ.' })
  requestKey: string;

  /**
   * Tổng tiền POS đang hiển thị cho khách. Không dùng để tính – chỉ để từ chối nếu giá/khuyến mãi
   * đã thay đổi so với lúc xem trước (tránh thu tiền khác số khách đã thấy).
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY)
  expectedTotal?: number;

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
