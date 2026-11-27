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
  /** Chiết khấu hóa đơn đã phân bổ cho dòng (API thật). */
  discount?: number;
  /** Số cuốn đã đổi/trả qua các phiếu (API thật). */
  returnedQuantity?: number;
}

/** Kết quả xem trước giỏ hàng từ backend (POST /invoices/preview). */
export interface InvoicePreview {
  valid: boolean;
  messages: string[];
  lines: (InvoiceItem & { stock: number })[];
  subtotal: number;
  promotion: { id: string; name: string; applied: boolean; amount: number } | null;
  voucher: { code: string; applied: boolean; amount: number } | null;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  changeAmount: number;
}

/** Dữ liệu giỏ hàng gửi backend để xem trước – chỉ mã sách + số lượng, không gửi giá. */
export interface CartRequest {
  items: { bookId: string; quantity: number }[];
  customerId?: string | null;
  promotionId?: string;
  voucherCode?: string;
  paymentMethod: PaymentMethod;
  amountPaid?: number;
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
  /** Hạn đổi/trả YYYY-MM-DD (hết ngày, giờ Việt Nam) – API thật. */
  returnDeadline?: string;
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
  /** Giá trị thực của phần trả (đồng) – API thật. */
  value?: number;
}

/** Xem trước phiếu đổi/trả từ backend (POST /returns/preview). */
export interface ReturnPreview {
  valid: boolean;
  messages: string[];
  deadline: string;
  lines: {
    bookId: string;
    title: string;
    quantity: number;
    purchasedQuantity: number;
    alreadyReturned: number;
    value: number;
  }[];
  returnedValue: number;
  exchangeBook: { id: string; title: string; unitPrice: number; stock: number } | null;
  newBooksValue: number;
  refundAmount: number;
  extraPayment: number;
}

/** Dữ liệu gửi backend để xem trước / lập phiếu đổi trả – không gửi đơn giá hay tiền hoàn. */
export interface ReturnRequest {
  invoiceId: string;
  type: ReturnType;
  returnItems: { bookId: string; quantity: number; condition?: string }[];
  exchangeBookId?: string;
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
  /** Tiền khách bù thêm (API thật, lưu riêng với tiền hoàn). */
  extraPayment?: number;
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
  /** Mã thể loại áp dụng; "" = toàn cửa hàng (backend dùng trường này, `applicableCategory` chỉ để hiển thị). */
  applicableCategoryId?: string;
  startDate: string;
  endDate: string;
  status: PromotionStatus;
}

/** Trạng thái voucher do backend suy ra (hết hạn, tạm ngừng, hết lượt…). */
export type VoucherStatus = "ACTIVE" | "SCHEDULED" | "PAUSED" | "USED_UP" | "EXPIRED";

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
  status?: VoucherStatus;
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
  /** Trạng thái nhân viên sở hữu (tài khoản của người đã thôi việc không mở khóa được). */
  employeeStatus?: Employee["status"];
  failedLoginCount?: number;
  lastLogin: string | null;
  createdAt: string;
}

export interface RolePermissionItem {
  moduleKey: string;
  moduleName: string;
  group: string;
  /** Ghi chú giới hạn (vd "chỉ xem chương trình đang áp dụng"). */
  note: string | null;
  /** Ma trận chỉ xem – phản ánh RBAC cố định của backend. */
  permissions: Record<
    UserRole,
    {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
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
  /** Ngày YYYY-MM-DD (giờ Việt Nam). */
  date: string;
  /** dd/MM */
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  orders: number;
  booksSold: number;
}

/** Tổng kỳ báo cáo – công thức xem docs/database.md › Báo cáo. */
export interface RevenueTotals {
  invoiceAmount: number;
  exchangeIn: number;
  refunds: number;
  revenue: number;
  saleCost: number;
  returnedCost: number;
  exchangeOutCost: number;
  cost: number;
  profit: number;
  orders: number;
  booksSold: number;
}

export interface RevenueReport {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  totals: RevenueTotals;
  previousTotals: RevenueTotals;
  series: RevenuePoint[];
}

export interface BestsellerRow {
  bookId: string;
  title: string;
  soldQty: number;
  returnedQty: number;
  exchangedOutQty: number;
  netQty: number;
  revenue: number;
}

export interface DashboardCard {
  key: string;
  label: string;
  value: number;
  format: "currency" | "number";
  /** Giá trị kỳ trước; null = số liệu hiện tại, không so kỳ. */
  previous: number | null;
  series: number[] | null;
}

export interface DashboardSummary {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  role: UserRole;
  cards: DashboardCard[];
}
