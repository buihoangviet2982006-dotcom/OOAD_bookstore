import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { OTP_LENGTH } from '../auth.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class LoginDto {
  /** Tên đăng nhập hoặc email. */
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên đăng nhập hoặc email.' })
  @MaxLength(150)
  identifier: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu.' })
  @MaxLength(128)
  password: string;
}

export class ForgotPasswordDto {
  @Transform(trim)
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email: string;
}

export class ResetPasswordDto {
  @Transform(trim)
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email: string;

  @Transform(trim)
  @Matches(new RegExp(`^\\d{${OTP_LENGTH}}$`), {
    message: `Mã xác thực gồm ${OTP_LENGTH} chữ số.`,
  })
  otp: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu mới cần tối thiểu 6 ký tự.' })
  @MaxLength(128, { message: 'Mật khẩu mới tối đa 128 ký tự.' })
  newPassword: string;
}
