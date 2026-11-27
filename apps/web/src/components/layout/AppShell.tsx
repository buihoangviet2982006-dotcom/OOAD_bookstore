"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Building2,
  HelpCircle,
  LayoutGrid,
  LogOut,
  Menu,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tags,
  TicketPercent,
  Truck,
  UserCog,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { anyModuleUsesMock } from "@/config/api";
import { BRAND_CONFIG } from "@/config/brand";
import {
  canAccessPath,
  NAV_SECTIONS,
  type NavItem,
  ROLE_LABELS,
  ROLE_SHORT_LABELS,
} from "@/config/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { resetMockDb } from "@/mocks/store";
import type { UserRole } from "@/types";

const ICON_MAP: Record<NavItem["iconName"], React.ComponentType<{ className?: string }>> = {
  LayoutGrid,
  ShoppingBag,
  ReceiptText,
  RotateCcw,
  Users,
  BookOpen,
  Tags,
  Warehouse,
  Truck,
  TicketPercent,
  Building2,
  UserCog,
  BarChart3,
  ShieldCheck,
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    isHydrated,
    canSwitchRole,
    switchRole,
    logout,
  } = useAuth();
  const { showToast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8F6] text-sm text-zinc-500">
        Đang tải không gian làm việc...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F7F8F6] p-6">
        <div className="rounded-2xl border border-[#E6E8E5] bg-white p-8 text-center max-w-md w-full">
          <h2 className="text-lg font-semibold text-zinc-900">Phiên đăng nhập đã kết thúc</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Vui lòng đăng nhập lại để tiếp tục sử dụng hệ thống quản lý nhà sách.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#2D6A4F] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#23533D]"
          >
            Đi tới trang Đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  const allowed = canAccessPath(user.role, pathname);
  // Nút khôi phục dữ liệu mẫu chỉ có ý nghĩa với dữ liệu Mock trong trình duyệt.
  const mockMode = anyModuleUsesMock();

  const handleResetDemo = () => {
    resetMockDb();
    showToast("Đã khôi phục dữ liệu mẫu ban đầu", "info", "Tải lại trang nếu bạn muốn làm mới danh sách.");
    router.refresh();
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-[#E6E8E5]">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2D6A4F] text-white">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight text-zinc-900">
              {BRAND_CONFIG.name}
              <span className="text-[#2D6A4F]">.</span>
            </div>
            <div className="text-[10px] font-semibold tracking-widest text-zinc-400">
              {BRAND_CONFIG.subtitle}
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Cửa hàng – hệ thống demo một cửa hàng, không chọn chi nhánh */}
      <div className="px-4 pb-3">
        <div className="relative rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] p-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E6E8E5] bg-white text-[#2D6A4F]">
              <Store className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-zinc-800">{BRAND_CONFIG.store.name}</div>
              <div className="truncate text-[11px] text-zinc-500">{BRAND_CONFIG.store.address}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
        {NAV_SECTIONS.map((section, sIdx) => {
          const visibleItems = section.items.filter((item) =>
            item.allowedRoles.includes(user.role),
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title ?? `sec-${sIdx}`}>
              {section.title && (
                <div className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-zinc-400">
                  {section.title}
                </div>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = ICON_MAP[item.iconName];
                  const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-[#E8F3EE] text-[#2D6A4F]"
                          : "text-zinc-600 hover:bg-[#F2F4F1] hover:text-zinc-900"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon
                          className={`h-4 w-4 ${
                            isActive ? "text-[#2D6A4F]" : "text-zinc-400"
                          }`}
                        />
                        {item.label}
                      </span>
                      {item.badge && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                            isActive
                              ? "bg-white text-[#2D6A4F]"
                              : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Support & Demo Reset Box */}
      <div className="p-3">
        <div className="rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800">
            <HelpCircle className="h-4 w-4 text-[#2D6A4F]" />
            Cần hỗ trợ?
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
            {mockMode
              ? "Đang chạy dữ liệu Mock trong trình duyệt (không lưu vào máy chủ)."
              : "Quên mật khẩu hoặc tài khoản bị khóa: liên hệ Quản lý cửa hàng."}
          </p>
          {mockMode && (
            <button
              type="button"
              onClick={handleResetDemo}
              className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-[#2D6A4F] hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Khôi phục dữ liệu mẫu
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F7F8F6]">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:w-64 lg:flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 flex w-64 flex-col">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        {/* Topbar */}
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#E6E8E5] bg-white/95 px-4 sm:px-8 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Quick Role Switcher – chỉ hiện ở chế độ Mock, ẩn khi dùng xác thực thật */}
            {canSwitchRole && (
            <div className="hidden md:flex items-center gap-1 rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] p-1">
              <span className="px-2 text-[11px] font-medium text-zinc-500">Vai trò test:</span>
              {(["MANAGER", "SALES", "WAREHOUSE"] as UserRole[]).map((roleKey) => {
                const active = user.role === roleKey;
                return (
                  <button
                    key={roleKey}
                    type="button"
                    onClick={() => {
                      switchRole(roleKey);
                      showToast(`Đã chuyển sang vai trò: ${ROLE_LABELS[roleKey]}`, "info");
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "bg-[#2D6A4F] text-white"
                        : "text-zinc-600 hover:bg-white hover:text-zinc-900"
                    }`}
                  >
                    {ROLE_SHORT_LABELS[roleKey]}
                  </button>
                );
              })}
            </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F3EE] text-xs font-bold text-[#2D6A4F]">
                {user.avatarInitials}
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-sm font-semibold text-zinc-900 leading-tight">
                  {user.fullName}
                </div>
                <div className="text-xs text-zinc-500">{ROLE_LABELS[user.role]}</div>
              </div>
            </div>

            <div className="h-6 w-px bg-[#E6E8E5]" />

            <button
              type="button"
              onClick={logout}
              title="Đăng xuất"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6E8E5] bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-[#FEE2E2] hover:border-[#FECACA] hover:text-[#B91C1C] transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-7 max-w-[1440px] w-full mx-auto">
          {allowed ? (
            children
          ) : (
            <div className="my-12 mx-auto max-w-lg rounded-2xl border border-[#E6E8E5] bg-white p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEF3C7] text-[#B45309]">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-zinc-900">
                Phân hệ này không thuộc quyền của {ROLE_LABELS[user.role]}
              </h2>
              <p className="mt-1.5 text-sm text-zinc-500">
                {canSwitchRole
                  ? "Tài khoản hiện tại không được phân quyền truy cập trang này. Bạn có thể quay về Tổng quan hoặc đổi sang vai trò Quản lý trên thanh tiêu đề để kiểm tra."
                  : "Tài khoản hiện tại không được phân quyền truy cập trang này. Vui lòng quay về Tổng quan hoặc liên hệ Quản lý."}
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-medium text-white hover:bg-[#23533D]"
                >
                  Về trang Tổng quan
                </Link>
                {canSwitchRole && (
                  <button
                    type="button"
                    onClick={() => switchRole("MANAGER")}
                    className="rounded-xl border border-[#E6E8E5] bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Chuyển sang Quản lý
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
