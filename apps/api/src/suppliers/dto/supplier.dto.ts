import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PhoneDigits, Trim, TrimOptional, VN_PHONE_REGEX } from '../../common/transforms.js';

/**
 * Dùng cho POST và PATCH. Không có totalImportAmount / currentDebt / dueDate:
 * các số này do backend tính từ phiếu nhập.
 */
export class SupplierDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Tên nhà cung cấp không được để trống.' })
  @MaxLength(200, { message: 'Tên nhà cung cấp tối đa 200 ký tự.' })
  name: string;

  /** Mã số thuế Việt Nam: 10 số, hoặc 10 số + "-" + 3 số (chi nhánh). */
  @TrimOptional()
  @IsOptional()
  @Matches(/^\d{10}(-\d{3})?$/, { message: 'Mã số thuế không hợp lệ (10 chữ số hoặc dạng 0123456789-001).' })
  taxCode?: string;

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  contactPerson?: string;

  @PhoneDigits()
  @Matches(VN_PHONE_REGEX, { message: 'Số điện thoại NCC không hợp lệ (10–11 chữ số, bắt đầu bằng 0).' })
  phone: string;

  @TrimOptional()
  @IsOptional()
  @IsEmail({}, { message: 'Email NCC không hợp lệ.' })
  @MaxLength(150)
  email?: string;

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  /** ACTIVE = đang hợp tác, INACTIVE = ngừng hợp tác (vẫn giữ lịch sử & công nợ). */
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'], { message: 'Trạng thái hợp tác không hợp lệ.' })
  status?: 'ACTIVE' | 'INACTIVE';
}
