import { API_ENDPOINTS, shouldUseMock } from "@/config/api";
import { httpClient } from "@/lib/http-client";
import { REVENUE_SERIES_7D } from "@/mocks/seed";
import { getMockDb, resetMockDb, saveMockDb } from "@/mocks/store";
import type {
  BackupRecord,
  Employee,
  PromotionCampaign,
  RevenuePoint,
  RolePermissionItem,
  Supplier,
  SystemAccount,
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

  async deleteEmployee(id: string): Promise<void> {
    if (!shouldUseMock("employees")) {
      await httpClient.delete(`${API_ENDPOINTS.employees}/${id}`);
      return;
    }
    const db = getMockDb();
    db.employees = db.employees.filter((e) => e.id !== id);
    saveMockDb(db);
  },

  // Reports
  async getRevenueSeries(): Promise<RevenuePoint[]> {
    if (!shouldUseMock("reports")) {
      return httpClient.get<RevenuePoint[]>(`${API_ENDPOINTS.reports}/revenue`);
    }
    return REVENUE_SERIES_7D;
  },

  // System Administration
  async getAccounts(): Promise<SystemAccount[]> {
    if (!shouldUseMock("system")) {
      return httpClient.get<SystemAccount[]>(API_ENDPOINTS.accounts);
    }
    return [...getMockDb().accounts];
  },

  async saveAccount(
    payload: Omit<SystemAccount, "id" | "lastLogin" | "createdAt"> & { id?: string },
  ): Promise<SystemAccount> {
    if (!shouldUseMock("system")) {
      return payload.id
        ? httpClient.patch<SystemAccount>(`${API_ENDPOINTS.accounts}/${payload.id}`, payload)
        : httpClient.post<SystemAccount>(API_ENDPOINTS.accounts, payload);
    }
    const db = getMockDb();
    if (payload.id) {
      const idx = db.accounts.findIndex((a) => a.id === payload.id);
      if (idx >= 0) {
        db.accounts[idx] = { ...db.accounts[idx], ...payload };
        saveMockDb(db);
        return db.accounts[idx];
      }
    }
    const created: SystemAccount = {
      ...payload,
      id: `ACC-${Date.now()}`,
      lastLogin: null,
      createdAt: new Date().toISOString(),
    };
    db.accounts.unshift(created);
    saveMockDb(db);
    return created;
  },

  async toggleAccountStatus(id: string): Promise<SystemAccount | null> {
    if (!shouldUseMock("system")) {
      return httpClient.patch<SystemAccount>(`${API_ENDPOINTS.accounts}/${id}/toggle-status`);
    }
    const db = getMockDb();
    const acc = db.accounts.find((a) => a.id === id);
    if (!acc) return null;
    acc.status = acc.status === "ACTIVE" ? "LOCKED" : "ACTIVE";
    saveMockDb(db);
    return acc;
  },

  async resetAccountPassword(id: string, tempPassword: string): Promise<void> {
    if (!shouldUseMock("system")) {
      await httpClient.post(`${API_ENDPOINTS.accounts}/${id}/reset-password`, { tempPassword });
    }
  },

  async getPermissions(): Promise<RolePermissionItem[]> {
    if (!shouldUseMock("system")) {
      return httpClient.get<RolePermissionItem[]>(API_ENDPOINTS.permissions);
    }
    return [...getMockDb().permissions];
  },

  async savePermissions(items: RolePermissionItem[]): Promise<void> {
    if (!shouldUseMock("system")) {
      await httpClient.put(API_ENDPOINTS.permissions, { items });
      return;
    }
    const db = getMockDb();
    db.permissions = items;
    saveMockDb(db);
  },

  async getBackups(): Promise<BackupRecord[]> {
    if (!shouldUseMock("system")) {
      return httpClient.get<BackupRecord[]>(API_ENDPOINTS.backups);
    }
    return [...getMockDb().backups].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createBackup(createdBy: string, note?: string): Promise<{ record: BackupRecord; snapshot: unknown }> {
    if (!shouldUseMock("system")) {
      return httpClient.post<{ record: BackupRecord; snapshot: unknown }>(API_ENDPOINTS.backups, {
        note,
      });
    }
    const db = getMockDb();
    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, "_").slice(0, 19);
    const record: BackupRecord = {
      id: `BKP-${Date.now()}`,
      fileName: `mocbooks_backup_${stamp}.json`,
      createdAt: now.toISOString(),
      createdBy,
      sizeLabel: "15.1 MB",
      type: "MANUAL",
      status: "SUCCESS",
      note: note || "Sao lưu thủ công bởi quản trị viên",
    };
    db.backups.unshift(record);
    saveMockDb(db);
    return { record, snapshot: db };
  },

  async restoreBackup(idOrData?: string | object): Promise<void> {
    if (!shouldUseMock("system")) {
      await httpClient.post(`${API_ENDPOINTS.backups}/restore`, { payload: idOrData });
      return;
    }
    if (typeof idOrData === "object" && idOrData !== null && "books" in idOrData) {
      saveMockDb(idOrData as ReturnType<typeof getMockDb>);
      return;
    }
    const db = getMockDb();
    if (typeof idOrData === "string") {
      const target = db.backups.find((b) => b.id === idOrData);
      if (target) target.status = "RESTORED";
      saveMockDb(db);
    } else {
      resetMockDb();
    }
  },
};
