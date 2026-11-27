import { Type } from 'class-transformer';
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
  ValidateIf,
} from 'class-validator';
import { Trim, TrimOptional } from '../../common/transforms.js';

/** Một dòng sách trả: chỉ mã sách + số lượng + tình trạng. Đơn giá / tiền hoàn do backend tính. */
export class ReturnItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Thiếu mã sách trả.' })
  bookId: string;

  @IsInt({ message: 'Số lượng trả phải là số nguyên.' })
  @Min(1, { message: 'Số lượng trả phải lớn hơn 0.' })
  @Max(1000)
  quantity: number;

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Tình trạng sách tối đa 100 ký tự.' })
  condition?: string;
}

/**
 * Xem trước phiếu đổi/trả. Trường FE gửi thừa (unitPrice, refundAmount, exchangePriceDiff,
 * handledBy, exchangeQuantity…) bị loại bỏ – backend tự tính.
 */
export class ReturnPreviewDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn hóa đơn gốc.' })
  invoiceId: string;

  @IsIn(['RETURN', 'EXCHANGE'], { message: 'Hình thức xử lý phải là RETURN hoặc EXCHANGE.' })
  type: 'RETURN' | 'EXCHANGE';

  @IsArray()
  @ArrayMinSize(1, { message: 'Vui lòng chọn ít nhất 1 sách cần trả.' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  returnItems: ReturnItemDto[];

  /** Chỉ dùng khi đổi hàng. Số lượng đổi = tổng số lượng trả (luồng FE hiện có). */
  @TrimOptional()
  @IsOptional()
  @IsString()
  exchangeBookId?: string;
}

export class CreateReturnDto extends ReturnPreviewDto {
  /** Chỉ đối chiếu preview, không dùng để tính tiền. Bắt buộc khi đổi sách. */
  @ValidateIf((dto: CreateReturnDto) => dto.type === 'EXCHANGE' || dto.expectedRefundAmount !== undefined)
  @IsInt()
  @Min(0)
  expectedRefundAmount?: number;

  @ValidateIf((dto: CreateReturnDto) => dto.type === 'EXCHANGE' || dto.expectedExtraPayment !== undefined)
  @IsInt()
  @Min(0)
  expectedExtraPayment?: number;

  /** Khóa chống lập phiếu lặp (FE sinh UUID mỗi lần mở form). */
  @Matches(/^[A-Za-z0-9-]{8,64}$/, { message: 'Khóa yêu cầu (requestKey) không hợp lệ.' })
  requestKey: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lý do đổi/trả.' })
  @MaxLength(1000)
  reason: string;
}
