import { API_ENDPOINTS } from "@/config/api";
import { httpClient } from "@/lib/http-client";
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
  async getPromotions(): Promise<PromotionCampaign[]> {
    return httpClient.get<PromotionCampaign[]>(API_ENDPOINTS.promotions);
  },

  async savePromotion(
    payload: Omit<PromotionCampaign, "id"> & { id?: string },
  ): Promise<PromotionCampaign> {
    return payload.id
      ? httpClient.patch<PromotionCampaign>(`${API_ENDPOINTS.promotions}/${payload.id}`, payload)
      : httpClient.post<PromotionCampaign>(API_ENDPOINTS.promotions, payload);
  },

  async getVouchers(): Promise<Voucher[]> {
    return httpClient.get<Voucher[]>(API_ENDPOINTS.vouchers);
  },

  async saveVoucher(
    payload: Omit<Voucher, "id" | "usedCount"> & { id?: string },
  ): Promise<Voucher> {
    return payload.id
      ? httpClient.patch<Voucher>(`${API_ENDPOINTS.vouchers}/${payload.id}`, payload)
      : httpClient.post<Voucher>(API_ENDPOINTS.vouchers, payload);
  },

  async getVoucherUsages(): Promise<VoucherUsage[]> {
    return httpClient.get<VoucherUsage[]>(API_ENDPOINTS.voucherUsages);
  },

  async getSuppliers(): Promise<Supplier[]> {
    return httpClient.get<Supplier[]>(API_ENDPOINTS.suppliers);
  },

  async saveSupplier(
    payload: Omit<Supplier, "id" | "code" | "totalImportAmount" | "currentDebt" | "dueDate"> & {
      id?: string;
    },
  ): Promise<Supplier> {
    return payload.id
      ? httpClient.patch<Supplier>(`${API_ENDPOINTS.suppliers}/${payload.id}`, payload)
      : httpClient.post<Supplier>(API_ENDPOINTS.suppliers, payload);
  },

  async getEmployees(): Promise<Employee[]> {
    return httpClient.get<Employee[]>(API_ENDPOINTS.employees);
  },

  async saveEmployee(payload: Omit<Employee, "id" | "code"> & { id?: string }): Promise<Employee> {
    return payload.id
      ? httpClient.patch<Employee>(`${API_ENDPOINTS.employees}/${payload.id}`, payload)
      : httpClient.post<Employee>(API_ENDPOINTS.employees, payload);
  },

  async deleteEmployee(id: string): Promise<string | undefined> {
    const res = await httpClient.delete<{ action: "DELETED" | "RESIGNED"; message: string }>(
      `${API_ENDPOINTS.employees}/${id}`,
    );
    return res.message;
  },

  async getRevenueReport(from: string, to: string): Promise<RevenueReport> {
    return httpClient.get<RevenueReport>(`${API_ENDPOINTS.reports}/revenue`, {
      params: { from, to },
    });
  },

  async getBestsellers(from: string, to: string): Promise<BestsellerRow[]> {
    return httpClient.get<BestsellerRow[]>(`${API_ENDPOINTS.reports}/bestsellers`, {
      params: { from, to },
    });
  },

  async getDashboardSummary(from: string, to: string): Promise<DashboardSummary> {
    return httpClient.get<DashboardSummary>(API_ENDPOINTS.dashboardSummary, {
      params: { from, to },
    });
  },

  async getAccounts(): Promise<SystemAccount[]> {
    return httpClient.get<SystemAccount[]>(API_ENDPOINTS.accounts);
  },

  async createAccount(payload: {
    employeeId: string;
    username: string;
    email?: string;
    role: UserRole;
    password: string;
  }): Promise<SystemAccount> {
    return httpClient.post<SystemAccount>(API_ENDPOINTS.accounts, payload);
  },

  async updateAccount(
    id: string,
    payload: { username: string; email: string; role: UserRole },
  ): Promise<SystemAccount> {
    return httpClient.patch<SystemAccount>(`${API_ENDPOINTS.accounts}/${id}`, payload);
  },

  async setAccountLocked(id: string, locked: boolean): Promise<SystemAccount> {
    return httpClient.post<SystemAccount>(
      `${API_ENDPOINTS.accounts}/${id}/${locked ? "lock" : "unlock"}`,
    );
  },

  async resetAccountPassword(id: string, newPassword: string): Promise<string> {
    const res = await httpClient.post<{ message: string }>(
      `${API_ENDPOINTS.accounts}/${id}/reset-password`,
      { newPassword },
    );
    return res.message;
  },

  async getPermissions(): Promise<RolePermissionItem[]> {
    return httpClient.get<RolePermissionItem[]>(API_ENDPOINTS.permissions);
  },

  async getBackups(): Promise<BackupRecord[]> {
    return httpClient.get<BackupRecord[]>(API_ENDPOINTS.backups);
  },

  async createBackup(note?: string): Promise<{ record: BackupRecord; snapshot: unknown }> {
    return httpClient.post<{ record: BackupRecord; snapshot: unknown }>(API_ENDPOINTS.backups, {
      note,
    });
  },
};
