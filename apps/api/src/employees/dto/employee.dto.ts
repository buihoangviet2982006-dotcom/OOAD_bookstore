import { IsDateString, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { MOBILE_PHONE_REGEX, PhoneDigits, Trim, TrimOptional } from '../../common/transforms.js';

export const EMPLOYEE_ROLES = ['MANAGER', 'SALES', 'WAREHOUSE'] as const;
export const EMPLOYEE_STATUSES = ['WORKING', 'ON_LEAVE', 'RESIGNED'] as const;

/** Dùng cho POST và PATCH. `branchName` FE gửi bị bỏ qua (hệ thống một cửa hàng). */
export class EmployeeDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Họ tên nhân viên không được để trống.' })
  @MaxLength(150, { message: 'Họ tên tối đa 150 ký tự.' })
  fullName: string;

  /** Bộ phận làm việc. Quyền đăng nhập theo vai trò của tài khoản (quản lý ở phân hệ Hệ thống). */
  @IsIn(EMPLOYEE_ROLES, { message: 'Bộ phận không hợp lệ.' })
  role: (typeof EMPLOYEE_ROLES)[number];

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Chức vụ không được để trống.' })
  @MaxLength(150, { message: 'Chức vụ tối đa 150 ký tự.' })
  positionTitle: string;

  @PhoneDigits()
  @Matches(MOBILE_PHONE_REGEX, { message: 'Số điện thoại không hợp lệ (10 chữ số, bắt đầu bằng 0).' })
  phone: string;

  @Trim()
  @IsEmail({}, { message: 'Email nhân viên không hợp lệ.' })
  @MaxLength(150)
  email: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày vào làm phải có dạng YYYY-MM-DD.' })
  @IsDateString({ strict: true }, { message: 'Ngày vào làm không tồn tại.' })
  joinDate: string;

  @IsInt({ message: 'Lương cơ bản phải là số nguyên (VNĐ).' })
  @Min(0, { message: 'Lương cơ bản không được âm.' })
  @Max(10_000_000_000)
  baseSalary: number;

  @IsOptional()
  @IsIn(EMPLOYEE_STATUSES, { message: 'Trạng thái làm việc không hợp lệ.' })
  status?: (typeof EMPLOYEE_STATUSES)[number];

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}
