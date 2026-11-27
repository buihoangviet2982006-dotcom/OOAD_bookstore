"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";
import { SESSION_EXPIRED_EVENT } from "@/lib/http-client";
import { DEMO_USERS } from "@/mocks/seed";
import { authService } from "@/services";
import type { AuthUser, LoginPayload, UserRole } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  isHydrated: boolean;
  /** false khi dùng backend thật: không có nút đổi vai trò / đăng nhập nhanh. */
  canSwitchRole: boolean;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  switchRole: (role: UserRole) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { showToast } = useToast();
  const realAuth = authService.isRealAuth();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (realAuth) {
      // Auth thật: chỉ tin phiên khi backend xác nhận qua /auth/me.
      if (!authService.hasStoredToken()) {
        void Promise.resolve().then(() => setIsHydrated(true));
        return;
      }
      authService
        .fetchCurrentUser()
        .then((me) => setUser(me))
        .catch(() => setUser(null)) // 401 đã được http-client xóa phiên; lỗi mạng → yêu cầu đăng nhập lại
        .finally(() => setIsHydrated(true));
      return;
    }

    // Chế độ Mock (chỉ khi NEXT_PUBLIC_USE_MOCK / cờ auth bật Mock): giữ hành vi demo cũ.
    void Promise.resolve().then(() => {
      const stored = authService.getStoredUser();
      if (stored) {
        setUser(stored);
      } else {
        const initial = DEMO_USERS.MANAGER;
        authService.persistSession(initial);
        setUser(initial);
      }
      setIsHydrated(true);
    });
  }, [realAuth]);

  // Backend trả 401 cho request có token (hết hạn, bị thu hồi, bị khóa) → kết thúc phiên phía FE.
  useEffect(() => {
    const onExpired = () => {
      setUser((current) => {
        if (current) showToast("Phiên đăng nhập đã kết thúc, vui lòng đăng nhập lại.", "warning");
        return null;
      });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [showToast]);

  const login = async (payload: LoginPayload) => {
    const logged = await authService.login(payload);
    setUser(logged);
    return logged;
  };

  const switchRole = (role: UserRole) => {
    if (realAuth) return; // không cho đổi vai trò khi dùng xác thực thật
    const nextUser = authService.loginAsRole(role);
    setUser(nextUser);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isHydrated,
        canSwitchRole: !realAuth,
        login,
        switchRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth phải được dùng bên trong AuthProvider");
  }
  return ctx;
}
