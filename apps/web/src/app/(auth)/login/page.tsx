"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Eye, EyeOff, KeyRound, ShieldCheck, ShoppingBag, Warehouse } from "lucide-react";
import { BRAND_CONFIG } from "@/config/brand";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import type { UserRole } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const { login, switchRole } = useAuth();
  const { showToast } = useToast();

  const [identifier, setIdentifier] = useState("minhanh.ql");
  const [password, setPassword] = useState("123456");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!identifier.trim() || !password.trim()) {
      setErrorMsg("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }
    setSubmitting(true);
    try {
      const user = await login({ identifier, password });
      showToast(`Chào mừng quay trở lại, ${user.fullName}!`);
      router.push("/dashboard");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Đăng nhập không thành công.");
    } finally {
      setSubmitting(false);
    }
  };

  const quickLogin = (role: UserRole, targetPath: string) => {
    switchRole(role);
    showToast("Đăng nhập nhanh tài khoản mẫu thành công!");
    router.push(targetPath);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8F6] p-4 sm:p-8">
      <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white shadow-sm lg:grid-cols-12">
        {/* Left Editorial Column */}
        <div className="flex flex-col justify-between bg-[#2D6A4F] p-8 text-white lg:col-span-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-lg font-bold tracking-tight">{BRAND_CONFIG.name}.</div>
                <div className="text-[10px] tracking-widest text-white/75">
                  {BRAND_CONFIG.subtitle}
                </div>
              </div>
            </div>

            <h1 className="mt-10 text-2xl font-bold leading-snug">
              Nền tảng vận hành nhà sách tinh gọn &amp; chuẩn xác.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/80">
              Quản lý xuyên suốt từ quầy thu ngân POS, tồn kho đầu sách, công nợ nhà xuất bản đến báo cáo doanh thu theo thời gian thực.
            </p>
          </div>

          <div className="mt-10 space-y-2.5 border-t border-white/15 pt-5 text-xs text-white/80">
            <div>• Phân quyền rõ ràng: Bán hàng, Kho, Quản lý</div>
            <div>• Cảnh báo tồn kho thấp &amp; nợ đến hạn tự động</div>
            <div>• Tầng dữ liệu tách biệt, sẵn sàng kết nối API</div>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="p-8 sm:p-10 lg:col-span-7">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Đăng nhập hệ thống</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Nhập thông tin tài khoản nhân viên hoặc chọn nhanh vai trò mẫu bên dưới.
            </p>
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-xl border border-[#FECACA] bg-[#FEE2E2] px-4 py-3 text-sm text-[#B91C1C]">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">
                Tên đăng nhập hoặc Email
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="VD: minhanh.ql, thao.bh, hoangnam.kho"
                className="mt-1.5 w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3.5 py-2.5 text-sm text-zinc-900 focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Mật khẩu
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-[#2D6A4F] hover:underline"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative mt-1.5">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3.5 py-2.5 pr-10 text-sm text-zinc-900 focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#23533D] disabled:opacity-60"
            >
              {submitting ? "Đang xác thực..." : "Đăng nhập vào cửa hàng"}
            </button>
          </form>

          {/* Demo Quick Access Roles */}
          <div className="mt-7 border-t border-[#E6E8E5] pt-6">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <KeyRound className="h-3.5 w-3.5" />
              Đăng nhập nhanh theo vai trò (Dữ liệu mẫu)
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => quickLogin("SALES", "/sales/pos")}
                className="flex flex-col items-start rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] p-3 text-left transition-colors hover:border-[#2D6A4F] hover:bg-[#E8F3EE]/50"
              >
                <ShoppingBag className="h-4 w-4 text-[#2D6A4F]" />
                <span className="mt-2 text-xs font-semibold text-zinc-900">NV Bán hàng</span>
                <span className="text-[11px] text-zinc-500">thao.bh • Quầy POS</span>
              </button>

              <button
                type="button"
                onClick={() => quickLogin("WAREHOUSE", "/inventory/books")}
                className="flex flex-col items-start rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] p-3 text-left transition-colors hover:border-[#2D6A4F] hover:bg-[#E8F3EE]/50"
              >
                <Warehouse className="h-4 w-4 text-[#2D6A4F]" />
                <span className="mt-2 text-xs font-semibold text-zinc-900">Nhân viên kho</span>
                <span className="text-[11px] text-zinc-500">hoangnam.kho • Sách &amp; Kho</span>
              </button>

              <button
                type="button"
                onClick={() => quickLogin("MANAGER", "/dashboard")}
                className="flex flex-col items-start rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] p-3 text-left transition-colors hover:border-[#2D6A4F] hover:bg-[#E8F3EE]/50"
              >
                <ShieldCheck className="h-4 w-4 text-[#2D6A4F]" />
                <span className="mt-2 text-xs font-semibold text-zinc-900">Quản lý</span>
                <span className="text-[11px] text-zinc-500">minhanh.ql • Toàn quyền</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
