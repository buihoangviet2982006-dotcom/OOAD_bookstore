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
  | "returns"
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
  // Phân hệ đã có API thật. Các phân hệ chưa có API vẫn dùng Mock.
  auth: false, // Chặng 2
  books: false, // Chặng 3
  catalog: false, // Chặng 3 – thể loại, tác giả, NXB
  customers: false, // Chặng 4
  suppliers: false, // Chặng 4
  employees: false, // Chặng 4
  promotions: false, // Chặng 5 – CTKM, voucher, lịch sử voucher
  sales: false, // Chặng 6 – xem trước, lập hóa đơn, tra cứu hóa đơn
  returns: false, // Chặng 7 – đổi / trả hàng
  imports: false, // Chặng 8 – phiếu nhập + thanh toán NCC
  inventory: false, // Chặng 9 – kiểm kê / điều chỉnh kho
  reports: false, // Chặng 10 – báo cáo, chỉ số Tổng quan
  system: false, // Chặng 10 – tài khoản, ma trận quyền (chỉ xem), sao lưu JSON
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

/** Có module nào còn dùng dữ liệu Mock trong trình duyệt không (để hiện / ẩn chức năng chỉ dành cho Mock). */
export function anyModuleUsesMock(): boolean {
  const modules: ApiModuleKey[] = [
    "auth", "books", "catalog", "sales", "returns", "customers", "inventory",
    "imports", "promotions", "suppliers", "employees", "reports", "system",
  ];
  return modules.some(shouldUseMock);
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
  invoicePreview: "/invoices/preview",
  returns: "/returns",
  returnPreview: "/returns/preview",
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
  dashboardSummary: "/dashboard/summary",
  accounts: "/system/accounts",
  permissions: "/system/permissions",
  backups: "/system/backups",
} as const;
