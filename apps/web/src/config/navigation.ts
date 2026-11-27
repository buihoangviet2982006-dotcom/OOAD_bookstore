import type { UserRole } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  iconName:
    | "LayoutGrid"
    | "ShoppingBag"
    | "ReceiptText"
    | "RotateCcw"
    | "Users"
    | "BookOpen"
    | "Tags"
    | "Warehouse"
    | "Truck"
    | "TicketPercent"
    | "Building2"
    | "UserCog"
    | "BarChart3"
    | "ShieldCheck";
  badge?: string;
  allowedRoles: UserRole[];
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  MANAGER: "Quản lý cửa hàng",
  SALES: "Nhân viên bán hàng",
  WAREHOUSE: "Nhân viên kho",
};

export const ROLE_SHORT_LABELS: Record<UserRole, string> = {
  MANAGER: "Quản lý",
  SALES: "NV Bán hàng",
  WAREHOUSE: "NV Kho",
};

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        label: "Tổng quan",
        href: "/dashboard",
        iconName: "LayoutGrid",
        allowedRoles: ["MANAGER", "SALES", "WAREHOUSE"],
      },
    ],
  },
  {
    title: "BÁN HÀNG",
    items: [
      {
        label: "Bán hàng",
        href: "/sales/pos",
        iconName: "ShoppingBag",
        badge: "POS",
        allowedRoles: ["MANAGER", "SALES"],
      },
      {
        label: "Hóa đơn",
        href: "/sales/invoices",
        iconName: "ReceiptText",
        allowedRoles: ["MANAGER", "SALES"],
      },
      {
        label: "Đổi / Trả hàng",
        href: "/sales/returns",
        iconName: "RotateCcw",
        allowedRoles: ["MANAGER", "SALES"],
      },
      {
        label: "Khách hàng",
        href: "/sales/customers",
        iconName: "Users",
        allowedRoles: ["MANAGER", "SALES"],
      },
    ],
  },
  {
    title: "KHO & SẢN PHẨM",
    items: [
      {
        label: "Quản lý sách",
        href: "/inventory/books",
        iconName: "BookOpen",
        allowedRoles: ["MANAGER", "WAREHOUSE"],
      },
      {
        label: "Danh mục sách",
        href: "/inventory/catalog",
        iconName: "Tags",
        allowedRoles: ["MANAGER", "WAREHOUSE"],
      },
      {
        label: "Quản lý kho",
        href: "/inventory/stock",
        iconName: "Warehouse",
        allowedRoles: ["MANAGER", "WAREHOUSE"],
      },
      {
        label: "Nhập hàng & Công nợ",
        href: "/inventory/imports",
        iconName: "Truck",
        allowedRoles: ["MANAGER", "WAREHOUSE"],
      },
    ],
  },
  {
    title: "QUẢN TRỊ",
    items: [
      {
        label: "Khuyến mãi & Voucher",
        href: "/admin/promotions",
        iconName: "TicketPercent",
        allowedRoles: ["MANAGER"],
      },
      {
        label: "Nhà cung cấp",
        href: "/admin/suppliers",
        iconName: "Building2",
        allowedRoles: ["MANAGER"],
      },
      {
        label: "Nhân viên",
        href: "/admin/employees",
        iconName: "UserCog",
        allowedRoles: ["MANAGER"],
      },
      {
        label: "Thống kê - Báo cáo",
        href: "/admin/reports",
        iconName: "BarChart3",
        allowedRoles: ["MANAGER"],
      },
      {
        label: "Quản lý hệ thống",
        href: "/admin/system",
        iconName: "ShieldCheck",
        allowedRoles: ["MANAGER"],
      },
    ],
  },
];

export function canAccessPath(role: UserRole, pathname: string): boolean {
  if (pathname === "/dashboard") return true;
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return item.allowedRoles.includes(role);
      }
    }
  }
  return true;
}
