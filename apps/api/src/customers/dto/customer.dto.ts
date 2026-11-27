import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { MOBILE_PHONE_REGEX, PhoneDigits, Trim, TrimOptional } from '../../common/transforms.js';

/**
 * Dùng cho POST và PATCH (FE gửi đủ form). Không có tier / points / totalSpent / orderCount:
 * các chỉ số này do backend tính từ hóa đơn – trường FE gửi thừa bị loại bỏ.
 */
export class CustomerDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Họ tên khách hàng không được để trống.' })
  @MaxLength(150, { message: 'Họ tên tối đa 150 ký tự.' })
  fullName: string;

  @PhoneDigits()
  @Matches(MOBILE_PHONE_REGEX, { message: 'Số điện thoại không hợp lệ (10 chữ số, bắt đầu bằng 0).' })
  phone: string;

  @TrimOptional()
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(150)
  email?: string;

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
