import type { VaiTro } from '@prisma/client';

type Op = 'view' | 'create' | 'edit' | 'delete';

interface ModuleRule {
  moduleKey: string;
  moduleName: string;
  group: string;
  /** Endpoint GET đại diện – test e2e gọi thử để đối chiếu cột "Xem" với RBAC thật. */
  probe: string;
  /** Thao tác có API, kèm vai trò (ngoài MANAGER) được làm. MANAGER luôn được mọi thao tác có API. */
  ops: Partial<Record<Op, VaiTro[]>>;
  note?: string;
}

/**
 * Ma trận quyền CHỈ XEM – mô tả lại RBAC cố định đang áp dụng ở các controller (@Roles).
 * Thao tác không có API (vd sửa/xóa hóa đơn) được đánh dấu không có cho mọi vai trò.
 * Sửa quyền ở đây không đổi quyền thật; đổi quyền phải sửa @Roles trong controller.
 */
export const MODULE_RULES: ModuleRule[] = [
  { moduleKey: 'dashboard', moduleName: 'Tổng quan', group: 'Chung', probe: '/dashboard/summary?from=2026-01-01&to=2026-01-01', ops: { view: ['SALES', 'WAREHOUSE'] }, note: 'Số liệu khác nhau theo vai trò; doanh thu toàn cửa hàng chỉ Quản lý.' },
  { moduleKey: 'sales', moduleName: 'Bán hàng & Hóa đơn', group: 'Bán hàng', probe: '/invoices', ops: { view: ['SALES'], create: ['SALES'] }, note: 'Hóa đơn đã lập không sửa/xóa.' },
  { moduleKey: 'returns', moduleName: 'Đổi / Trả hàng', group: 'Bán hàng', probe: '/returns', ops: { view: ['SALES'], create: ['SALES'] } },
  { moduleKey: 'customers', moduleName: 'Khách hàng', group: 'Bán hàng', probe: '/customers', ops: { view: ['SALES'], create: ['SALES'], edit: ['SALES'], delete: ['SALES'] }, note: 'Khách đã có hóa đơn không xóa được.' },
  { moduleKey: 'books', moduleName: 'Sách', group: 'Kho & Sản phẩm', probe: '/books', ops: { view: ['SALES', 'WAREHOUSE'], create: ['WAREHOUSE'], edit: ['WAREHOUSE'], delete: ['WAREHOUSE'] }, note: 'Bán hàng chỉ xem để tra cứu tại quầy.' },
  { moduleKey: 'catalog', moduleName: 'Thể loại, Tác giả, NXB', group: 'Kho & Sản phẩm', probe: '/categories', ops: { view: ['SALES', 'WAREHOUSE'], create: ['WAREHOUSE'], edit: ['WAREHOUSE'], delete: ['WAREHOUSE'] } },
  { moduleKey: 'inventory', moduleName: 'Kiểm kê kho', group: 'Kho & Sản phẩm', probe: '/inventory/adjustments', ops: { view: ['WAREHOUSE'], create: ['WAREHOUSE'] }, note: 'Phiếu áp dụng ngay, không sửa/xóa.' },
  { moduleKey: 'imports', moduleName: 'Nhập hàng & Thanh toán NCC', group: 'Kho & Sản phẩm', probe: '/imports', ops: { view: ['WAREHOUSE'], create: ['WAREHOUSE'] } },
  { moduleKey: 'suppliers', moduleName: 'Nhà cung cấp', group: 'Kho & Sản phẩm', probe: '/suppliers', ops: { view: ['WAREHOUSE'], create: ['WAREHOUSE'], edit: ['WAREHOUSE'] }, note: 'Không xóa; ngừng hợp tác = INACTIVE.' },
  { moduleKey: 'promotions', moduleName: 'Khuyến mãi & Voucher', group: 'Quản trị', probe: '/promotions', ops: { view: ['SALES'], create: [], edit: [] }, note: 'Bán hàng chỉ xem chương trình/voucher đang áp dụng.' },
  { moduleKey: 'employees', moduleName: 'Nhân viên', group: 'Quản trị', probe: '/employees', ops: { view: [], create: [], edit: [], delete: [] } },
  { moduleKey: 'reports', moduleName: 'Thống kê – Báo cáo', group: 'Quản trị', probe: '/reports/bestsellers?from=2026-01-01&to=2026-01-01', ops: { view: [] } },
  { moduleKey: 'system', moduleName: 'Tài khoản, phân quyền, sao lưu', group: 'Quản trị', probe: '/system/accounts', ops: { view: [], create: [], edit: [] }, note: 'Phân quyền chỉ xem; sao lưu = xuất JSON, chưa có phục hồi.' },
];

const ROLES: VaiTro[] = ['MANAGER', 'SALES', 'WAREHOUSE'];
const OPS: Op[] = ['view', 'create', 'edit', 'delete'];

export function allows(rule: ModuleRule, role: VaiTro, op: Op): boolean {
  const roles = rule.ops[op];
  return roles !== undefined && (role === 'MANAGER' || roles.includes(role));
}

/** Ma trận theo hình dạng `RolePermissionItem` của FE. */
export function permissionMatrix() {
  return MODULE_RULES.map((rule) => ({
    moduleKey: rule.moduleKey,
    moduleName: rule.moduleName,
    group: rule.group,
    note: rule.note ?? null,
    permissions: Object.fromEntries(
      ROLES.map((role) => [role, Object.fromEntries(OPS.map((op) => [op, allows(rule, role, op)]))]),
    ),
  }));
}
