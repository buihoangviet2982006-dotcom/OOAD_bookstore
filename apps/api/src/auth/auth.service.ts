import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'node:crypto';
import { hashPassword, verifyPassword } from '../common/password.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isDemoOtpLogEnabled } from './auth.config.js';
import {
  MAX_FAILED_LOGINS,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  STORE_BRANCH,
} from './auth.constants.js';
import type { AuthUserResponse, CurrentAccount, TokenPayload } from './auth.types.js';
import type { ForgotPasswordDto, LoginDto, ResetPasswordDto } from './dto/auth.dto.js';

const INVALID_CREDENTIALS = 'Tên đăng nhập hoặc mật khẩu không đúng.';
const LOCKED_MESSAGE = 'Tài khoản đang bị khóa. Vui lòng liên hệ Quản lý để mở khóa.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ───────────── Đăng nhập / đăng xuất ─────────────

  async login(dto: LoginDto): Promise<{ user: AuthUserResponse; accessToken: string }> {
    const account = await this.findAccountByIdentifier(dto.identifier);
    if (!account) throw new UnauthorizedException(INVALID_CREDENTIALS);

    if (account.trangThai === 'LOCKED') throw new ForbiddenException(LOCKED_MESSAGE);
    if (account.nhanVien.trangThai === 'RESIGNED') {
      throw new ForbiddenException('Nhân viên đã thôi việc, không thể đăng nhập.');
    }

    if (!(await verifyPassword(dto.password, account.matKhauHash))) {
      await this.recordFailedLogin(account.maTaiKhoan);
    }

    // Đăng nhập thành công: xóa bộ đếm sai, ghi lần đăng nhập cuối.
    const { count } = await this.prisma.taiKhoan.updateMany({
      where: {
        maTaiKhoan: account.maTaiKhoan,
        matKhauHash: account.matKhauHash,
        phienBan: account.phienBan,
        trangThai: 'ACTIVE',
        nhanVien: { trangThai: { not: 'RESIGNED' } },
      },
      data: { soLanSaiMatKhau: 0, lanDangNhapCuoi: new Date() },
    });
    if (count === 0) throw new UnauthorizedException('Thông tin xác thực đã thay đổi, vui lòng đăng nhập lại.');

    // Chỉ ký phiên đã kiểm chứng mật khẩu. Nếu reset sau UPDATE, guard sẽ từ chối phiên cũ này.
    const payload: TokenPayload = { sub: account.maTaiKhoan, ver: account.phienBan };
    return { user: toAuthUser(account), accessToken: await this.jwt.signAsync(payload) };
  }

  /**
   * Đăng xuất = tăng phien_ban. Mọi token đã cấp cho tài khoản (mọi thiết bị) đều mất hiệu lực –
   * chấp nhận cho demo vì không lưu danh sách phiên.
   */
  async logout(account: CurrentAccount): Promise<{ message: string }> {
    await this.revokeSessions(account.maTaiKhoan);
    return { message: 'Đã đăng xuất.' };
  }

  me(account: CurrentAccount): AuthUserResponse {
    return toAuthUser(account);
  }

  // ───────────── Quên mật khẩu (OTP) ─────────────

  async requestPasswordReset(dto: ForgotPasswordDto): Promise<{ message: string }> {
    // Chưa có dịch vụ email: chỉ hỗ trợ khi bật rõ chế độ demo (in OTP ra console máy chủ).
    if (!isDemoOtpLogEnabled(this.config)) {
      throw new ServiceUnavailableException(
        'Chức năng quên mật khẩu chưa được cấu hình kênh gửi mã. Vui lòng liên hệ Quản lý để đặt lại mật khẩu.',
      );
    }

    const account = await this.findAccountByEmail(dto.email);
    // Đặc tả QLHT: báo rõ khi tài khoản không tồn tại.
    if (!account) throw new NotFoundException('Tài khoản không tồn tại trên hệ thống.');
    if (account.trangThai === 'LOCKED') throw new ForbiddenException(LOCKED_MESSAGE);

    const otp = randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    // Ghi đè mã cũ: yêu cầu gửi lại làm mã trước đó hết hiệu lực.
    await this.prisma.taiKhoan.update({
      where: { maTaiKhoan: account.maTaiKhoan },
      data: { otpHash: await hashPassword(otp), otpHetHan: expiresAt, otpSoLanSai: 0 },
    });

    this.logger.warn(
      `[DEMO OTP] Tài khoản ${account.tenDangNhap}: ${otp} (hết hạn ${expiresAt.toISOString()})`,
    );
    return {
      message:
        'Đã tạo mã xác thực. Chế độ demo: mã được in trên console máy chủ (không gửi email). Mã có hiệu lực 5 phút.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const account = await this.findAccountByEmail(dto.email);
    if (!account?.otpHash || !account.otpHetHan) {
      throw new BadRequestException('Mã xác thực không hợp lệ hoặc chưa được yêu cầu.');
    }
    if (account.trangThai === 'LOCKED') throw new ForbiddenException(LOCKED_MESSAGE);

    if (account.otpHetHan.getTime() < Date.now()) {
      await this.clearOtp(account.maTaiKhoan);
      throw new BadRequestException('Mã xác thực đã hết hạn, vui lòng yêu cầu mã mới.');
    }

    if (!(await verifyPassword(dto.otp, account.otpHash))) {
      await this.recordFailedOtp(account.maTaiKhoan);
    }

    // Đổi mật khẩu + xóa OTP + thu hồi mọi phiên cũ. Điều kiện otpHash khớp đảm bảo mã chỉ dùng được 1 lần
    // kể cả khi có 2 request đồng thời.
    const { count } = await this.prisma.taiKhoan.updateMany({
      where: { maTaiKhoan: account.maTaiKhoan, otpHash: account.otpHash },
      data: {
        matKhauHash: await hashPassword(dto.newPassword),
        otpHash: null,
        otpHetHan: null,
        otpSoLanSai: 0,
        soLanSaiMatKhau: 0,
        phienBan: { increment: 1 },
      },
    });
    if (count === 0) {
      throw new BadRequestException('Mã xác thực đã được sử dụng, vui lòng yêu cầu mã mới.');
    }
    return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.' };
  }

  // ───────────── Hàm hỗ trợ ─────────────

  private findAccountByIdentifier(identifier: string) {
    return this.prisma.taiKhoan.findFirst({
      where: {
        OR: [
          { tenDangNhap: { equals: identifier, mode: 'insensitive' } },
          { emailKhoiPhuc: { equals: identifier, mode: 'insensitive' } },
        ],
      },
      include: { nhanVien: true },
    });
  }

  private findAccountByEmail(email: string) {
    return this.prisma.taiKhoan.findFirst({
      where: { emailKhoiPhuc: { equals: email, mode: 'insensitive' } },
    });
  }

  /** Tăng bộ đếm sai (atomic); chạm ngưỡng thì khóa tài khoản và thu hồi phiên. Luôn ném lỗi. */
  private async recordFailedLogin(maTaiKhoan: string): Promise<never> {
    const { soLanSaiMatKhau } = await this.prisma.taiKhoan.update({
      where: { maTaiKhoan },
      data: { soLanSaiMatKhau: { increment: 1 } },
    });
    if (soLanSaiMatKhau >= MAX_FAILED_LOGINS) {
      await this.prisma.taiKhoan.update({
        where: { maTaiKhoan },
        data: { trangThai: 'LOCKED', phienBan: { increment: 1 } },
      });
      throw new ForbiddenException(
        `Nhập sai mật khẩu ${MAX_FAILED_LOGINS} lần liên tiếp, tài khoản đã bị khóa. Vui lòng liên hệ Quản lý để mở khóa.`,
      );
    }
    throw new UnauthorizedException(INVALID_CREDENTIALS);
  }

  /** Tăng số lần nhập sai OTP; chạm ngưỡng thì hủy mã. Luôn ném lỗi. */
  private async recordFailedOtp(maTaiKhoan: string): Promise<never> {
    const { otpSoLanSai } = await this.prisma.taiKhoan.update({
      where: { maTaiKhoan },
      data: { otpSoLanSai: { increment: 1 } },
    });
    if (otpSoLanSai >= OTP_MAX_ATTEMPTS) {
      await this.clearOtp(maTaiKhoan);
      throw new BadRequestException(
        'Nhập sai mã xác thực quá số lần cho phép. Vui lòng yêu cầu mã mới.',
      );
    }
    throw new BadRequestException(
      `Mã xác thực không chính xác (còn ${OTP_MAX_ATTEMPTS - otpSoLanSai} lần thử).`,
    );
  }

  private clearOtp(maTaiKhoan: string) {
    return this.prisma.taiKhoan.update({
      where: { maTaiKhoan },
      data: { otpHash: null, otpHetHan: null, otpSoLanSai: 0 },
    });
  }

  private revokeSessions(maTaiKhoan: string) {
    return this.prisma.taiKhoan.update({
      where: { maTaiKhoan },
      data: { phienBan: { increment: 1 } },
    });
  }
}

/** Chuyển tài khoản (DB) sang `AuthUser` của FE. */
export function toAuthUser(account: CurrentAccount): AuthUserResponse {
  const { nhanVien } = account;
  return {
    id: account.maTaiKhoan,
    username: account.tenDangNhap,
    fullName: nhanVien.hoTen,
    email: account.emailKhoiPhuc,
    phone: nhanVien.soDienThoai,
    role: account.vaiTro,
    branchId: STORE_BRANCH.id,
    branchName: STORE_BRANCH.name,
    avatarInitials: nhanVien.hoTen
      .split(' ')
      .slice(-2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join(''),
  };
}
