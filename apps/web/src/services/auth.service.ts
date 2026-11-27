import { API_ENDPOINTS, shouldUseMock } from "@/config/api";
import { AUTH_TOKEN_KEY, AUTH_USER_KEY, httpClient } from "@/lib/http-client";
import { DEMO_USERS } from "@/mocks/seed";
import { getMockDb } from "@/mocks/store";
import type { AuthUser, LoginPayload, UserRole } from "@/types";

export const authService = {
  /** true khi đăng nhập qua backend thật (không còn tự đăng nhập / đổi vai trò kiểu Mock). */
  isRealAuth(): boolean {
    return !shouldUseMock("auth");
  },

  /** Xác nhận phiên với backend khi tải lại trang. Lỗi 401 sẽ bị http-client xóa phiên. */
  async fetchCurrentUser(): Promise<AuthUser> {
    const user = await httpClient.get<AuthUser>(API_ENDPOINTS.auth.me);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }
    return user;
  },

  hasStoredToken(): boolean {
    return typeof window !== "undefined" && !!window.localStorage.getItem(AUTH_TOKEN_KEY);
  },

  async login(payload: LoginPayload): Promise<AuthUser> {
    if (!shouldUseMock("auth")) {
      const res = await httpClient.post<{ user: AuthUser; accessToken: string }>(
        API_ENDPOINTS.auth.login,
        payload,
      );
      if (typeof window !== "undefined") {
        window.localStorage.setItem(AUTH_TOKEN_KEY, res.accessToken);
        window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
      }
      return res.user;
    }

    const db = getMockDb();
    const idLower = payload.identifier.trim().toLowerCase();
    const matchedAccount = db.accounts.find(
      (a) => a.username.toLowerCase() === idLower || a.email.toLowerCase() === idLower,
    );

    if (matchedAccount) {
      if (matchedAccount.status === "LOCKED") {
        throw new Error("Tài khoản này đang bị khóa. Vui lòng liên hệ Quản lý hệ thống.");
      }
      const base = DEMO_USERS[matchedAccount.role];
      const user: AuthUser = {
        ...base,
        id: matchedAccount.id,
        username: matchedAccount.username,
        fullName: matchedAccount.fullName,
        email: matchedAccount.email,
        avatarInitials: matchedAccount.fullName
          .split(" ")
          .slice(-2)
          .map((w) => w[0]?.toUpperCase() ?? "")
          .join(""),
      };
      this.persistSession(user);
      return user;
    }

    // Fallback quick demo login if user enters any non-empty credentials
    const defaultUser = DEMO_USERS.MANAGER;
    this.persistSession(defaultUser);
    return defaultUser;
  },

  loginAsRole(role: UserRole): AuthUser {
    const user = DEMO_USERS[role];
    this.persistSession(user);
    return user;
  },

  persistSession(user: AuthUser): void {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      window.localStorage.setItem(AUTH_TOKEN_KEY, `mock-token-${user.role.toLowerCase()}`);
    }
  },

  getStoredUser(): AuthUser | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(AUTH_USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    if (!shouldUseMock("auth")) {
      await httpClient.post(API_ENDPOINTS.auth.logout).catch(() => undefined);
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_USER_KEY);
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  },

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    if (!shouldUseMock("auth")) {
      return httpClient.post<{ message: string }>(API_ENDPOINTS.auth.forgotPassword, { email });
    }
    return {
      message: `Chế độ Mock (không gửi email): nhập mã 6 chữ số bất kỳ cho ${email}.`,
    };
  },

  async confirmPasswordReset(email: string, otp: string, newPassword: string): Promise<void> {
    if (!shouldUseMock("auth")) {
      await httpClient.post(API_ENDPOINTS.auth.resetPassword, { email, otp, newPassword });
    }
  },
};
