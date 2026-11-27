import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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

/**
 * Một dòng kiểm kê. `systemStock` = tồn hệ thống FE hiển thị lúc mở form – chỉ dùng để phát hiện tồn đã đổi;
 * tồn lưu vào phiếu lấy từ DB. Chênh lệch (`diff`) FE gửi bị bỏ qua – backend tự tính.
 */
export class StockAdjustmentItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Thiếu mã sách kiểm kê.' })
  bookId: string;

  @IsInt({ message: 'Tồn hệ thống lúc mở form phải là số nguyên.' })
  @Min(0)
  systemStock: number;

  @IsInt({ message: 'Số lượng thực tế phải là số nguyên.' })
  @Min(0, { message: 'Số lượng thực tế không được âm.' })
  @Max(1_000_000)
  actualStock: number;

  /** Bắt buộc khi có chênh lệch (kiểm tra ở service). */
  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** Lập phiếu kiểm kê – áp dụng ngay khi lưu. createdBy / status / code FE gửi bị bỏ qua. */
export class CreateStockAdjustmentDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Phiếu kiểm kê cần ít nhất 1 đầu sách.' })
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => StockAdjustmentItemDto)
  items: StockAdjustmentItemDto[];

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @Matches(/^[A-Za-z0-9-]{8,64}$/, { message: 'Khóa yêu cầu (requestKey) không hợp lệ.' })
  requestKey: string;
}
