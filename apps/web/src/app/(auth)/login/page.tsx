"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Eye, EyeOff } from "lucide-react";
import { BRAND_CONFIG } from "@/config/brand";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { showToast } = useToast();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
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
            <div>• Xác thực JWT &amp; đồng bộ trực tiếp PostgreSQL</div>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="p-8 sm:p-10 lg:col-span-7">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Đăng nhập hệ thống</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Nhập tên đăng nhập (hoặc email) và mật khẩu do quản lý cấp.
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
        </div>
      </div>
    </div>
  );
}
