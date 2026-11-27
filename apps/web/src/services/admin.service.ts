import { API_ENDPOINTS, shouldUseMock } from "@/config/api";
import { httpClient } from "@/lib/http-client";
import { getMockDb, saveMockDb } from "@/mocks/store";
import type {
  BackupRecord,
  BestsellerRow,
  DashboardSummary,
  Employee,
  PromotionCampaign,
  RevenueReport,
  RolePermissionItem,
  Supplier,
  SystemAccount,
  UserRole,
  Voucher,
  VoucherUsage,
} from "@/types";

export const adminService = {
  // Promotions & Vouchers
  async getPromotions(): Promise<PromotionCampaign[]> {
    if (!shouldUseMock("promotions")) {
      return httpClient.get<PromotionCampaign[]>(API_ENDPOINTS.promotions);
    }
    return [...getMockDb().promotions];
  },

  async savePromotion(
    payload: Omit<PromotionCampaign, "id"> & { id?: string },
  ): Promise<PromotionCampaign> {
    if (!shouldUseMock("promotions")) {
      return payload.id
        ? httpClient.patch<PromotionCampaign>(`${API_ENDPOINTS.promotions}/${payload.id}`, payload)
        : httpClient.post<PromotionCampaign>(API_ENDPOINTS.promotions, payload);
    }
    const db = getMockDb();
    if (payload.id) {
      const idx = db.promotions.findIndex((p) => p.id === payload.id);
      if (idx >= 0) {
        db.promotions[idx] = { ...payload, id: payload.id };
        saveMockDb(db);
        return db.promotions[idx];
      }
    }
    const created: PromotionCampaign = { ...payload, id: `PRM-${Date.now()}` };
    db.promotions.unshift(created);
    saveMockDb(db);
    return created;
  },

  async getVouchers(): Promise<Voucher[]> {
    if (!shouldUseMock("promotions")) {
      return httpClient.get<Voucher[]>(API_ENDPOINTS.vouchers);
    }
    return [...getMockDb().vouchers];
  },

  async saveVoucher(payload: Omit<Voucher, "id" | "usedCount"> & { id?: string }): Promise<Voucher> {
    if (!shouldUseMock("promotions")) {
      return payload.id
        ? httpClient.patch<Voucher>(`${API_ENDPOINTS.vouchers}/${payload.id}`, payload)
        : httpClient.post<Voucher>(API_ENDPOINTS.vouchers, payload);
    }
    const db = getMockDb();
    if (payload.id) {
      const idx = db.vouchers.findIndex((v) => v.id === payload.id);
      if (idx >= 0) {
        db.vouchers[idx] = {
          ...db.vouchers[idx],
          ...payload,
          code: payload.code.toUpperCase(),
        };
        saveMockDb(db);
        return db.vouchers[idx];
      }
    }
    const created: Voucher = {
      ...payload,
      id: `VC-${Date.now()}`,
      code: payload.code.toUpperCase(),
      usedCount: 0,
    };
    db.vouchers.unshift(created);
    saveMockDb(db);
    return created;
  },

  async getVoucherUsages(): Promise<VoucherUsage[]> {
    if (!shouldUseMock("promotions")) {
      return httpClient.get<VoucherUsage[]>(API_ENDPOINTS.voucherUsages);
    }
    return [...getMockDb().voucherUsages];
  },

  // Suppliers
  async getSuppliers(): Promise<Supplier[]> {
    if (!shouldUseMock("suppliers")) {
      return httpClient.get<Supplier[]>(API_ENDPOINTS.suppliers);
    }
    return [...getMockDb().suppliers];
  },

  async saveSupplier(
    payload: Omit<Supplier, "id" | "code" | "totalImportAmount" | "currentDebt" | "dueDate"> & {
      id?: string;
    },
  ): Promise<Supplier> {
    if (!shouldUseMock("suppliers")) {
      return payload.id
        ? httpClient.patch<Supplier>(`${API_ENDPOINTS.suppliers}/${payload.id}`, payload)
        : httpClient.post<Supplier>(API_ENDPOINTS.suppliers, payload);
    }
    const db = getMockDb();
    if (payload.id) {
      const idx = db.suppliers.findIndex((s) => s.id === payload.id);
      if (idx >= 0) {
        db.suppliers[idx] = { ...db.suppliers[idx], ...payload };
        saveMockDb(db);
        return db.suppliers[idx];
      }
    }
    const created: Supplier = {
      ...payload,
      id: `SUP-${Date.now()}`,
      code: `NCC${String(db.suppliers.length + 1).padStart(3, "0")}`,
      totalImportAmount: 0,
      currentDebt: 0,
      dueDate: null,
    };
    db.suppliers.unshift(created);
    saveMockDb(db);
    return created;
  },

  // Employees
  async getEmployees(): Promise<Employee[]> {
    if (!shouldUseMock("employees")) {
      return httpClient.get<Employee[]>(API_ENDPOINTS.employees);
    }
    return [...getMockDb().employees];
  },

  async saveEmployee(payload: Omit<Employee, "id" | "code"> & { id?: string }): Promise<Employee> {
    if (!shouldUseMock("employees")) {
      return payload.id
        ? httpClient.patch<Employee>(`${API_ENDPOINTS.employees}/${payload.id}`, payload)
        : httpClient.post<Employee>(API_ENDPOINTS.employees, payload);
    }
    const db = getMockDb();
    if (payload.id) {
      const idx = db.employees.findIndex((e) => e.id === payload.id);
      if (idx >= 0) {
        db.employees[idx] = { ...db.employees[idx], ...payload };
        saveMockDb(db);
        return db.employees[idx];
      }
    }
    const created: Employee = {
      ...payload,
      id: `EMP-${Date.now()}`,
      code: `NV${String(db.employees.length + 1).padStart(3, "0")}`,
    };
    db.employees.unshift(created);
    saveMockDb(db);
    return created;
  },

  /** Trả về thông báo của backend: đã xóa hẳn hoặc đã chuyển "Đã thôi việc". */
  async deleteEmployee(id: string): Promise<string | undefined> {
    if (!shouldUseMock("employees")) {
      const res = await httpClient.delete<{ action: "DELETED" | "RESIGNED"; message: string }>(
        `${API_ENDPOINTS.employees}/${id}`,
      );
      return res.message;
    }
    const db = getMockDb();
    db.employees = db.employees.filter((e) => e.id !== id);
    saveMockDb(db);
  },

  // Reports – chỉ có số liệu thật từ API (không có dữ liệu mẫu cho báo cáo).
  async getRevenueReport(from: string, to: string): Promise<RevenueReport> {
    requireApi("reports");
    return httpClient.get<RevenueReport>(`${API_ENDPOINTS.reports}/revenue`, { params: { from, to } });
  },

  async getBestsellers(from: string, to: string): Promise<BestsellerRow[]> {
    requireApi("reports");
    return httpClient.get<BestsellerRow[]>(`${API_ENDPOINTS.reports}/bestsellers`, { params: { from, to } });
  },

  /** Chỉ số trang Tổng quan – backend chọn số liệu theo vai trò người đăng nhập. */
  async getDashboardSummary(from: string, to: string): Promise<DashboardSummary> {
    requireApi("reports");
    return httpClient.get<DashboardSummary>(API_ENDPOINTS.dashboardSummary, { params: { from, to } });
  },

  // System Administration – chỉ Quản lý.
  async getAccounts(): Promise<SystemAccount[]> {
    if (!shouldUseMock("system")) {
      return httpClient.get<SystemAccount[]>(API_ENDPOINTS.accounts);
    }
    return [...getMockDb().accounts];
  },

  async createAccount(payload: {
    employeeId: string;
    username: string;
    email?: string;
    role: UserRole;
    password: string;
  }): Promise<SystemAccount> {
    requireApi("system");
    return httpClient.post<SystemAccount>(API_ENDPOINTS.accounts, payload);
  },

  async updateAccount(
    id: string,
    payload: { username: string; email: string; role: UserRole },
  ): Promise<SystemAccount> {
    requireApi("system");
    return httpClient.patch<SystemAccount>(`${API_ENDPOINTS.accounts}/${id}`, payload);
  },

  async setAccountLocked(id: string, locked: boolean): Promise<SystemAccount> {
    requireApi("system");
    return httpClient.post<SystemAccount>(`${API_ENDPOINTS.accounts}/${id}/${locked ? "lock" : "unlock"}`);
  },

  async resetAccountPassword(id: string, newPassword: string): Promise<string> {
    requireApi("system");
    const res = await httpClient.post<{ message: string }>(`${API_ENDPOINTS.accounts}/${id}/reset-password`, {
      newPassword,
    });
    return res.message;
  },

  /** Ma trận quyền chỉ xem – không có API lưu. */
  async getPermissions(): Promise<RolePermissionItem[]> {
    if (!shouldUseMock("system")) {
      return httpClient.get<RolePermissionItem[]>(API_ENDPOINTS.permissions);
    }
    return [...getMockDb().permissions];
  },

  async getBackups(): Promise<BackupRecord[]> {
    if (!shouldUseMock("system")) {
      return httpClient.get<BackupRecord[]>(API_ENDPOINTS.backups);
    }
    return [...getMockDb().backups].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /** Xuất JSON dữ liệu nghiệp vụ + ghi lịch sử. Phục hồi chưa triển khai (không có hàm restore). */
  async createBackup(note?: string): Promise<{ record: BackupRecord; snapshot: unknown }> {
    requireApi("system");
    return httpClient.post<{ record: BackupRecord; snapshot: unknown }>(API_ENDPOINTS.backups, { note });
  },
};

/** Chức năng chỉ chạy với backend thật – chế độ Mock báo lỗi thay vì giả lập thành công. */
function requireApi(moduleKey: "reports" | "system"): void {
  if (shouldUseMock(moduleKey)) {
    throw new Error("Chức năng này chỉ khả dụng khi kết nối API thật (không có dữ liệu mẫu).");
  }
}
