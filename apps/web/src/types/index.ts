export type UserRole = "MANAGER" | "SALES" | "WAREHOUSE";

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  branchId: string;
  branchName: string;
  avatarInitials: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description: string;
  bookCount?: number;
}

export interface Author {
  id: string;
  name: string;
  nationality: string;
  bio: string;
  bookCount?: number;
}

export interface Publisher {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  bookCount?: number;
}

export type BookStatus = "ACTIVE" | "OUT_OF_STOCK" | "DISCONTINUED";

export interface Book {
  id: string;
  sku: string;
  isbn: string;
  title: string;
  categoryId: string;
  categoryName: string;
  authorId: string;
  authorName: string;
  publisherId: string;
  publisherName: string;
  publishYear: number;
  importPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  shelfLocation: string;
  status: BookStatus;
  description: string;
}

export type CustomerTier = "STANDARD" | "SILVER" | "GOLD" | "DIAMOND";

export interface Customer {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  tier: CustomerTier;
  points: number;
  totalSpent: number;
  orderCount: number;
  lastPurchaseDate: string | null;
  createdAt: string;
  notes?: string;
}

export type PaymentMethod = "CASH" | "TRANSFER" | "CARD";
export type InvoiceStatus = "COMPLETED" | "PARTIAL_RETURN" | "RETURNED" | "CANCELLED";

export interface InvoiceItem {
  bookId: string;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Invoice {
  id: string;
  code: string;
  createdAt: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  cashierId: string;
  cashierName: string;
  items: InvoiceItem[];
  subtotal: number;
  promotionId?: string;
  promotionName?: string;
  voucherCode?: string;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  changeAmount: number;
  paymentMethod: PaymentMethod;
  status: InvoiceStatus;
  note?: string;
}

export type ReturnType = "RETURN" | "EXCHANGE";
export type ReturnStatus = "COMPLETED" | "PENDING" | "REJECTED";

export interface ReturnOrderItem {
  bookId: string;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: number;
  condition: string;
}

export interface ReturnOrder {
  id: string;
  code: string;
  invoiceId: string;
  invoiceCode: string;
  customerId: string | null;
  customerName: string;
  createdAt: string;
  type: ReturnType;
  reason: string;
  returnItems: ReturnOrderItem[];
  exchangeBookId?: string;
  exchangeBookTitle?: string;
  exchangeQuantity?: number;
  exchangePriceDiff: number; // < 0 hoàn tiền khách, > 0 khách bù thêm
  refundAmount: number;
  status: ReturnStatus;
  handledBy: string;
}

export interface StockAdjustmentItem {
  bookId: string;
  sku: string;
  title: string;
  systemStock: number;
  actualStock: number;
  diff: number;
  reason: string;
}

export interface StockAdjustment {
  id: string;
  code: string;
  createdAt: string;
  createdBy: string;
  note: string;
  status: "APPLIED" | "DRAFT";
  items: StockAdjustmentItem[];
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  taxCode: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  totalImportAmount: number;
  currentDebt: number;
  dueDate: string | null;
  status: "ACTIVE" | "INACTIVE";
}

export interface PurchaseOrderItem {
  bookId: string;
  sku: string;
  title: string;
  quantity: number;
  importPrice: number;
  subtotal: number;
}

export type DebtStatus = "PAID" | "PARTIAL" | "UNPAID" | "OVERDUE";

export interface PurchaseOrder {
  id: string;
  code: string;
  supplierId: string;
  supplierName: string;
  createdAt: string;
  createdBy: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  dueDate: string | null;
  debtStatus: DebtStatus;
  note?: string;
}

export interface SupplierPayment {
  id: string;
  code: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId?: string;
  purchaseOrderCode?: string;
  paidAt: string;
  amount: number;
  paymentMethod: PaymentMethod;
  recordedBy: string;
  note?: string;
}

export type DiscountType = "PERCENT" | "FIXED";
export type PromotionStatus = "ACTIVE" | "SCHEDULED" | "PAUSED" | "CANCELLED" | "EXPIRED";

export interface PromotionCampaign {
  id: string;
  code: string;
  name: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderValue: number;
  applicableCategory?: string;
  startDate: string;
  endDate: string;
  status: PromotionStatus;
}

export interface Voucher {
  id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderValue: number;
  usageLimit: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface VoucherUsage {
  id: string;
  voucherCode: string;
  invoiceCode: string;
  customerName: string;
  usedAt: string;
  discountAmount: number;
  orderTotal: number;
}

export interface Employee {
  id: string;
  code: string;
  fullName: string;
  role: UserRole;
  positionTitle: string;
  phone: string;
  email: string;
  branchName: string;
  joinDate: string;
  baseSalary: number;
  status: "WORKING" | "ON_LEAVE" | "RESIGNED";
  address: string;
}

export interface SystemAccount {
  id: string;
  username: string;
  employeeId: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: "ACTIVE" | "LOCKED";
  lastLogin: string | null;
  createdAt: string;
}

export interface RolePermissionItem {
  moduleKey: string;
  moduleName: string;
  group: string;
  permissions: Record<
    UserRole,
    {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
      export: boolean;
    }
  >;
}

export interface BackupRecord {
  id: string;
  fileName: string;
  createdAt: string;
  createdBy: string;
  sizeLabel: string;
  type: "MANUAL" | "SCHEDULED";
  status: "SUCCESS" | "RESTORED";
  note?: string;
}

export interface RevenuePoint {
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  orders: number;
}
