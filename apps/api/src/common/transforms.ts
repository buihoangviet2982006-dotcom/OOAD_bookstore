import { Transform } from 'class-transformer';

/** Cắt khoảng trắng hai đầu; chuỗi rỗng → undefined (coi như không nhập – FE hay gửi ""). */
export const TrimOptional = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  });

/** Cắt khoảng trắng hai đầu (trường bắt buộc: giữ "" để validator báo thiếu). */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/** Cắt khoảng trắng và viết hoa (mã nghiệp vụ). */
export const TrimUpper = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  );

/** Số điện thoại: bỏ khoảng trắng, dấu chấm, gạch ngang. Rỗng → undefined. */
export const PhoneDigits = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const digits = value.replace(/[\s.-]/g, '');
    return digits === '' ? undefined : digits;
  });

/** Regex số điện thoại Việt Nam: 10 số di động hoặc 11 số cố định, bắt đầu bằng 0. */
export const VN_PHONE_REGEX = /^0\d{9,10}$/;

/** Số di động 10 chữ số (đặc tả QLKH: SĐT khách hàng 10 chữ số). */
export const MOBILE_PHONE_REGEX = /^0\d{9}$/;

/** Ngày dạng YYYY-MM-DD → Date (UTC 00:00) để lưu cột DATE; Date → YYYY-MM-DD. */
export const toDateOnly = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
export const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);
