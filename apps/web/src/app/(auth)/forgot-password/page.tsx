"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCircle2, Mail } from "lucide-react";
import { BRAND_CONFIG } from "@/config/brand";
import { authService } from "@/services";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  // Thông báo backend trả về (vd chế độ demo: OTP in trên console máy chủ) – không tự nói "đã gửi email".
  const [otpNotice, setOtpNotice] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !email.includes("@")) {
      setError("Vui lòng nhập địa chỉ email hợp lệ đã đăng ký với nhà sách.");
      return;
    }
    setLoading(true);
    try {
      const { message } = await authService.requestPasswordReset(email.trim());
      setOtpNotice(message);
      setOtp("");
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi yêu cầu khôi phục.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError("Mật khẩu mới cần tối thiểu 6 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không trùng khớp.");
      return;
    }
    setLoading(true);
    try {
      await authService.confirmPasswordReset(email, otp, newPassword);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đặt lại mật khẩu thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8F6] p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#E6E8E5] bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2D6A4F] text-white">
            <BookOpen className="h-4 w-4" />
          </div>
          <span className="text-base font-bold text-zinc-900">{BRAND_CONFIG.name}.</span>
        </div>

        {step === 1 && (
          <>
            <h1 className="mt-6 text-xl font-bold text-zinc-900">Khôi phục mật khẩu</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Nhập email công việc của bạn để nhận mã xác thực đặt lại mật khẩu.
            </p>

            {error && (
              <div className="mt-4 rounded-xl border border-[#FECACA] bg-[#FEE2E2] px-3.5 py-2.5 text-xs text-[#B91C1C]">
                {error}
              </div>
            )}

            <form onSubmit={handleRequestOtp} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Email nhân viên
                </label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="minhanh@mocbooks.vn"
                    className="w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] py-2.5 pl-10 pr-3.5 text-sm focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#2D6A4F] py-2.5 text-sm font-semibold text-white hover:bg-[#23533D] disabled:opacity-60"
              >
                {loading ? "Đang gửi mã..." : "Gửi mã xác thực"}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="mt-6 text-xl font-bold text-zinc-900">Nhập mã OTP &amp; Mật khẩu mới</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Nhập mã 6 chữ số cho tài khoản <strong className="text-zinc-800">{email}</strong>.
            </p>
            {otpNotice && (
              <div className="mt-3 rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3.5 py-2.5 text-xs text-zinc-600">
                {otpNotice}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-[#FECACA] bg-[#FEE2E2] px-3.5 py-2.5 text-xs text-[#B91C1C]">
                {error}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Mã xác thực OTP
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3.5 py-2.5 font-mono text-sm tracking-widest focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Mật khẩu mới
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="mt-1.5 w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3.5 py-2.5 text-sm focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="mt-1.5 w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3.5 py-2.5 text-sm focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#2D6A4F] py-2.5 text-sm font-semibold text-white hover:bg-[#23533D]"
              >
                {loading ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
              </button>
            </form>
          </>
        )}

        {step === 3 && (
          <div className="mt-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F3EE] text-[#2D6A4F]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-zinc-900">Đặt lại mật khẩu thành công</h2>
            <p className="mt-1.5 text-sm text-zinc-500">
              Bạn đã có thể sử dụng mật khẩu mới để đăng nhập vào hệ thống quản lý nhà sách.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#2D6A4F] py-2.5 text-sm font-semibold text-white hover:bg-[#23533D]"
            >
              Quay về trang Đăng nhập
            </Link>
          </div>
        )}

        {step !== 3 && (
          <div className="mt-6 border-t border-[#E6E8E5] pt-4 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-[#2D6A4F]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Quay lại Đăng nhập
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
