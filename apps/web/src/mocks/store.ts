import {
  INITIAL_ACCOUNTS,
  INITIAL_ADJUSTMENTS,
  INITIAL_AUTHORS,
  INITIAL_BACKUPS,
  INITIAL_BOOKS,
  INITIAL_CATEGORIES,
  INITIAL_CUSTOMERS,
  INITIAL_EMPLOYEES,
  INITIAL_INVOICES,
  INITIAL_PERMISSIONS,
  INITIAL_PROMOTIONS,
  INITIAL_PUBLISHERS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_RETURNS,
  INITIAL_SUPPLIER_PAYMENTS,
  INITIAL_SUPPLIERS,
  INITIAL_VOUCHER_USAGES,
  INITIAL_VOUCHERS,
} from "./seed";
import type {
  Author,
  BackupRecord,
  Book,
  Category,
  Customer,
  Employee,
  Invoice,
  PromotionCampaign,
  Publisher,
  PurchaseOrder,
  ReturnOrder,
  RolePermissionItem,
  StockAdjustment,
  Supplier,
  SupplierPayment,
  SystemAccount,
  Voucher,
  VoucherUsage,
} from "@/types";

export interface MockDatabase {
  categories: Category[];
  authors: Author[];
  publishers: Publisher[];
  books: Book[];
  customers: Customer[];
  invoices: Invoice[];
  returns: ReturnOrder[];
  adjustments: StockAdjustment[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  supplierPayments: SupplierPayment[];
  promotions: PromotionCampaign[];
  vouchers: Voucher[];
  voucherUsages: VoucherUsage[];
  employees: Employee[];
  accounts: SystemAccount[];
  permissions: RolePermissionItem[];
  backups: BackupRecord[];
}

const STORAGE_KEY = "mocbooks_mock_db_v1";

function createFreshDb(): MockDatabase {
  return structuredClone({
    categories: INITIAL_CATEGORIES,
    authors: INITIAL_AUTHORS,
    publishers: INITIAL_PUBLISHERS,
    books: INITIAL_BOOKS,
    customers: INITIAL_CUSTOMERS,
    invoices: INITIAL_INVOICES,
    returns: INITIAL_RETURNS,
    adjustments: INITIAL_ADJUSTMENTS,
    suppliers: INITIAL_SUPPLIERS,
    purchaseOrders: INITIAL_PURCHASE_ORDERS,
    supplierPayments: INITIAL_SUPPLIER_PAYMENTS,
    promotions: INITIAL_PROMOTIONS,
    vouchers: INITIAL_VOUCHERS,
    voucherUsages: INITIAL_VOUCHER_USAGES,
    employees: INITIAL_EMPLOYEES,
    accounts: INITIAL_ACCOUNTS,
    permissions: INITIAL_PERMISSIONS,
    backups: INITIAL_BACKUPS,
  });
}

let memoryDb: MockDatabase | null = null;

export function getMockDb(): MockDatabase {
  if (typeof window === "undefined") {
    if (!memoryDb) memoryDb = createFreshDb();
    return memoryDb;
  }

  if (!memoryDb) {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      memoryDb = raw ? (JSON.parse(raw) as MockDatabase) : createFreshDb();
    } catch {
      memoryDb = createFreshDb();
    }
  }
  return memoryDb;
}

export function saveMockDb(db: MockDatabase): void {
  memoryDb = db;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Ignore quota errors in sessionStorage
    }
  }
}

export function resetMockDb(): MockDatabase {
  const fresh = createFreshDb();
  saveMockDb(fresh);
  return fresh;
}
