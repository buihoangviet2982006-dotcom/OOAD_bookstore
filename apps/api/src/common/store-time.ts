/** Múi giờ của cửa hàng – mọi so sánh "hôm nay" (hiệu lực khuyến mãi, hạn voucher…) dùng múi giờ này. */
export const STORE_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** Ngày hiện tại tại cửa hàng, dạng YYYY-MM-DD (không phụ thuộc múi giờ của máy chủ). */
export function todayInStore(now: Date = new Date()): string {
  // Locale en-CA định dạng ngày là YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Việt Nam không có giờ mùa hè – độ lệch cố định UTC+7. */
const STORE_UTC_OFFSET = '+07:00';

/** Thời điểm 00:00 (giờ cửa hàng) của ngày `YYYY-MM-DD`. */
export function startOfStoreDay(date: string): Date {
  return new Date(`${date}T00:00:00${STORE_UTC_OFFSET}`);
}

/** Cộng/trừ số ngày cho chuỗi ngày `YYYY-MM-DD` (tính trên lịch, không phụ thuộc múi giờ máy chủ). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Số ngày của khoảng [from, to], tính cả hai đầu. */
export function daysInRange(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}
