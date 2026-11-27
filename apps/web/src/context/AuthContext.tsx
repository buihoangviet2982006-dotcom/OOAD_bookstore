"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";
import { SESSION_EXPIRED_EVENT } from "@/lib/http-client";
import { authService } from "@/services";
import type { AuthUser, LoginPayload } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  isHydrated: boolean;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (!authService.hasStoredToken()) {
      void Promise.resolve().then(() => setIsHydrated(true));
      return;
    }
    authService
      .fetchCurrentUser()
      .then((me) => setUser(me))
      .catch(() => setUser(null))
      .finally(() => setIsHydrated(true));
  }, []);

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
        login,
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
