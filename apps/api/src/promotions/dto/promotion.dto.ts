import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim, TrimOptional, TrimUpper } from '../../common/transforms.js';

const MAX_MONEY = 1_000_000_000;
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/** Các trường giảm giá dùng chung cho CTKM và voucher. Ràng buộc chéo (PERCENT ≤ 100…) kiểm tra ở service. */
abstract class DiscountFieldsDto {
  @IsIn(['PERCENT', 'FIXED'], { message: 'Loại giảm phải là PERCENT hoặc FIXED.' })
  discountType: 'PERCENT' | 'FIXED';

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Giá trị giảm phải là số.' })
  @Min(0.01, { message: 'Giá trị giảm phải lớn hơn 0.' })
  @Max(MAX_MONEY)
  discountValue: number;

  /** Chỉ dùng cho PERCENT; null/bỏ trống = không giới hạn. */
  @IsOptional()
  @IsInt({ message: 'Mức giảm tối đa phải là số nguyên (VNĐ).' })
  @Min(1, { message: 'Mức giảm tối đa phải lớn hơn 0.' })
  @Max(MAX_MONEY)
  maxDiscountAmount?: number | null;

  @IsInt({ message: 'Giá trị đơn tối thiểu phải là số nguyên (VNĐ).' })
  @Min(0, { message: 'Giá trị đơn tối thiểu không được âm.' })
  @Max(MAX_MONEY)
  minOrderValue: number;

  @Matches(DATE_FORMAT, { message: 'Ngày bắt đầu phải có dạng YYYY-MM-DD.' })
  @IsDateString({ strict: true }, { message: 'Ngày bắt đầu không tồn tại.' })
  startDate: string;

  @Matches(DATE_FORMAT, { message: 'Ngày kết thúc phải có dạng YYYY-MM-DD.' })
  @IsDateString({ strict: true }, { message: 'Ngày kết thúc không tồn tại.' })
  endDate: string;
}

/**
 * CTKM – dùng cho POST và PATCH (FE gửi đủ object).
 * `status`: ACTIVE/SCHEDULED = bật, PAUSED = tạm dừng, CANCELLED = hủy; EXPIRED (suy ra) = giữ nguyên.
 */
export class PromotionDto extends DiscountFieldsDto {
  /** Mã CTKM = khóa chính. Bắt buộc khi tạo; không đổi khi sửa. */
  @TrimUpper()
  @IsOptional()
  @Matches(/^[A-Z0-9_-]{3,50}$/, { message: 'Mã chương trình gồm 3–50 ký tự chữ in hoa, số, "-" hoặc "_".' })
  code?: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Tên chương trình không được để trống.' })
  @MaxLength(200, { message: 'Tên chương trình tối đa 200 ký tự.' })
  name: string;

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** Mã thể loại áp dụng; bỏ trống = toàn cửa hàng. (`applicableCategory` dạng tên do FE gửi bị bỏ qua.) */
  @TrimOptional()
  @IsOptional()
  @IsString()
  applicableCategoryId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'SCHEDULED', 'PAUSED', 'CANCELLED', 'EXPIRED'], { message: 'Trạng thái không hợp lệ.' })
  status?: 'ACTIVE' | 'SCHEDULED' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';
}

/** Voucher – dùng cho POST và PATCH. Không có usedCount: số lượt đã dùng do nghiệp vụ bán hàng cập nhật. */
export class VoucherDto extends DiscountFieldsDto {
  /** Bỏ trống khi tạo → hệ thống sinh mã ngẫu nhiên. Không đổi khi sửa. */
  @TrimUpper()
  @IsOptional()
  @Matches(/^([A-Z0-9_-]{3,30})?$/, { message: 'Mã voucher gồm 3–30 ký tự chữ in hoa, số, "-" hoặc "_".' })
  code?: string;

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt({ message: 'Số lượt dùng tối đa phải là số nguyên.' })
  @Min(1, { message: 'Số lượt dùng tối đa phải lớn hơn 0.' })
  @Max(1_000_000)
  usageLimit: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
