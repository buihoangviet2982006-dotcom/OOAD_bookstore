import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { VaiTro } from '@prisma/client';
import { Trim, TrimOptional } from '../../common/transforms.js';
import { Transform } from 'class-transformer';

const ROLES = ['MANAGER', 'SALES', 'WAREHOUSE'] as const;
const LowerTrim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
/** Rỗng → undefined (bỏ trống). */
const LowerTrimOptional = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() || undefined : value,
  );
const USERNAME = /^[a-z0-9._-]{3,50}$/;
const USERNAME_MSG = 'Tên đăng nhập 3–50 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm, gạch dưới, gạch ngang.';

/** Sửa tài khoản: tên đăng nhập, email khôi phục, vai trò. Họ tên / SĐT sửa ở hồ sơ nhân viên. */
export class UpdateAccountDto {
  @LowerTrim()
  @Matches(USERNAME, { message: USERNAME_MSG })
  username: string;

  @LowerTrim()
  @IsEmail({}, { message: 'Email khôi phục không hợp lệ.' })
  @MaxLength(150)
  email: string;

  @IsIn(ROLES, { message: 'Vai trò không hợp lệ.' })
  role: VaiTro;
}

/** Tạo tài khoản cho nhân viên có sẵn + mật khẩu khởi tạo. Bỏ trống email → dùng email nhân viên. */
export class CreateAccountDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn nhân viên.' })
  employeeId: string;

  @LowerTrim()
  @Matches(USERNAME, { message: USERNAME_MSG })
  username: string;

  @LowerTrimOptional()
  @IsOptional()
  @IsEmail({}, { message: 'Email khôi phục không hợp lệ.' })
  @MaxLength(150)
  email?: string;

  @IsIn(ROLES, { message: 'Vai trò không hợp lệ.' })
  role: VaiTro;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu khởi tạo cần tối thiểu 6 ký tự.' })
  @MaxLength(100)
  password: string;
}

export class ResetAccountPasswordDto {
  @IsString()
  @MinLength(6, { message: 'Mật khẩu mới cần tối thiểu 6 ký tự.' })
  @MaxLength(100)
  newPassword: string;
}

export class CreateBackupDto {
  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
