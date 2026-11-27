/** Số lần sai mật khẩu liên tiếp thì khóa tài khoản (quyết định review #11). */
export const MAX_FAILED_LOGINS = 5;

/** OTP quên mật khẩu: 6 chữ số, hiệu lực 5 phút, tối đa 5 lần nhập sai. */
export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

/** Thời hạn access token mặc định (phút) nếu không cấu hình JWT_EXPIRES_MINUTES: 1 ca làm việc. */
export const DEFAULT_TOKEN_TTL_MINUTES = 8 * 60;

/** Độ dài tối thiểu của JWT_SECRET. */
export const MIN_JWT_SECRET_LENGTH = 32;

/** Hệ thống demo một cửa hàng: FE vẫn cần thông tin chi nhánh trong AuthUser. */
/** Hệ thống demo MỘT cửa hàng – khớp FE `config/brand.ts`. */
export const STORE_NAME = 'Nhà sách bé bi';
export const STORE_BRANCH = { id: 'BR-01', name: 'Chi nhánh trung tâm' } as const;

/** Metadata key cho decorator @Public() và @Roles(). */
export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';
