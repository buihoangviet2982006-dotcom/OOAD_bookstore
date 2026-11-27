import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PhoneDigits, Trim, TrimOptional, TrimUpper, VN_PHONE_REGEX } from '../../common/transforms.js';

/**
 * Dùng cho cả tạo mới (POST) và cập nhật (PATCH) – FE luôn gửi đủ form.
 * Các trường FE gửi thừa (id, bookCount…) bị ValidationPipe loại bỏ.
 */
export class CategoryDto {
  /** Mã thể loại = khóa chính. Bắt buộc khi tạo; khi sửa phải giữ nguyên. */
  @TrimUpper()
  @IsOptional()
  @Matches(/^[A-Z0-9_-]{1,20}$/, {
    message: 'Mã thể loại gồm 1–20 ký tự chữ in hoa, số, "-" hoặc "_".',
  })
  code?: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Tên thể loại không được để trống.' })
  @MaxLength(150, { message: 'Tên thể loại tối đa 150 ký tự.' })
  name: string;

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class AuthorDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Họ tên tác giả không được để trống.' })
  @MaxLength(150, { message: 'Họ tên tác giả tối đa 150 ký tự.' })
  name: string;

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Quốc tịch tối đa 100 ký tự.' })
  nationality?: string;

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string;
}

export class PublisherDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Tên nhà xuất bản không được để trống.' })
  @MaxLength(200, { message: 'Tên nhà xuất bản tối đa 200 ký tự.' })
  name: string;

  @PhoneDigits()
  @IsOptional()
  @Matches(VN_PHONE_REGEX, { message: 'Số điện thoại NXB không hợp lệ (10–11 chữ số, bắt đầu bằng 0).' })
  phone?: string;

  @TrimOptional()
  @IsOptional()
  @IsEmail({}, { message: 'Email NXB không hợp lệ.' })
  @MaxLength(150)
  email?: string;

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}
