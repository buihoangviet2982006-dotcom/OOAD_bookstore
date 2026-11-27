export function formatCurrency(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(value))} ₫`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function formatDate(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return "—";
  const date = new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return isoOrDate;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return "—";
  const date = new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return isoOrDate;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const diffMs = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function generateCode(prefix: string): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${prefix}-${dd}${mm}-${rand}`;
}

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD (dùng cho ô chọn ngày). */
export function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Cộng/trừ ngày cho chuỗi YYYY-MM-DD (tính trên lịch, không phụ thuộc múi giờ trình duyệt). */
export function shiftIsoDate(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD → dd/MM/yyyy (không đổi múi giờ). */
export function formatIsoDate(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/** Phần trăm thay đổi so kỳ trước; null khi kỳ trước bằng 0 (không chia được). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Giá trị ô nhập số: "" = ô đang trống (cho phép xóa để nhập lại); số 0 vẫn là giá trị hợp lệ. */
export type NumberInput = number | "";

export const toNumberInput = (raw: string): NumberInput => (raw === "" ? "" : Number(raw));

/** Nhãn các ô số bắt buộc còn trống – để báo "Vui lòng nhập …" thay vì âm thầm coi là 0. */
export function emptyNumberFields(fields: Record<string, NumberInput>): string[] {
  return Object.entries(fields)
    .filter(([, value]) => value === "")
    .map(([label]) => label);
}
