/**
 * Cấu hình kết nối API trung tâm.
 * - Mặc định chạy chế độ Mock để kiểm thử toàn bộ giao diện ngay lập tức.
 * - Khi Backend hoàn thiện toàn bộ: đặt biến môi trường NEXT_PUBLIC_USE_MOCK=false.
 * - Khi Backend hoàn thiện từng phần: chỉnh cờ tương ứng trong MODULE_MOCK_OVERRIDES = false
 *   để chỉ phân hệ đó gọi API thật còn các phân hệ khác vẫn dùng Mock.
 */

export type ApiModuleKey =
  | "auth"
  | "books"
  | "catalog"
  | "sales"
  | "customers"
  | "inventory"
  | "imports"
  | "promotions"
  | "suppliers"
  | "employees"
  | "reports"
  | "system";

const GLOBAL_USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

export const MODULE_MOCK_OVERRIDES: Partial<Record<ApiModuleKey, boolean>> = {
  // Ví dụ khi đã làm xong API quản lý sách:
  // books: false,
};

export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  timeoutMs: 15000,
  useMockGlobal: GLOBAL_USE_MOCK,
};

export function shouldUseMock(moduleKey: ApiModuleKey): boolean {
  if (typeof MODULE_MOCK_OVERRIDES[moduleKey] === "boolean") {
    return MODULE_MOCK_OVERRIDES[moduleKey] as boolean;
  }
  return API_CONFIG.useMockGlobal;
}

export const API_ENDPOINTS = {
  auth: {
    login: "/auth/login",
    logout: "/auth/logout",
    me: "/auth/me",
    forgotPassword: "/auth/forgot-password",
    resetPassword: "/auth/reset-password",
  },
  books: "/books",
  categories: "/categories",
  authors: "/authors",
  publishers: "/publishers",
  invoices: "/invoices",
  returns: "/returns",
  customers: "/customers",
  stockAdjustments: "/inventory/adjustments",
  purchaseOrders: "/imports",
  supplierPayments: "/supplier-payments",
  promotions: "/promotions",
  vouchers: "/vouchers",
  voucherUsages: "/vouchers/usages",
  suppliers: "/suppliers",
  employees: "/employees",
  reports: "/reports",
  accounts: "/system/accounts",
  permissions: "/system/permissions",
  backups: "/system/backups",
} as const;
