"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BRAND_CONFIG } from "@/config/brand";
import { DEMO_USERS } from "@/mocks/seed";
import { authService } from "@/services";
import type { AuthUser, LoginPayload, UserRole } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  isHydrated: boolean;
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  switchRole: (role: UserRole) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(BRAND_CONFIG.branches[0].id);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const stored = authService.getStoredUser();
      if (stored) {
        setUser(stored);
        setSelectedBranchId(stored.branchId);
      } else {
        const initial = DEMO_USERS.MANAGER;
        authService.persistSession(initial);
        setUser(initial);
      }
      setIsHydrated(true);
    });
  }, []);

  const login = async (payload: LoginPayload) => {
    const logged = await authService.login(payload);
    setUser(logged);
    setSelectedBranchId(logged.branchId);
    return logged;
  };

  const switchRole = (role: UserRole) => {
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
        selectedBranchId,
        setSelectedBranchId,
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
