import { API_ENDPOINTS } from "@/config/api";
import { AUTH_TOKEN_KEY, AUTH_USER_KEY, httpClient } from "@/lib/http-client";
import type { AuthUser, LoginPayload } from "@/types";

export const authService = {
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
    const res = await httpClient.post<{ user: AuthUser; accessToken: string }>(
      API_ENDPOINTS.auth.login,
      payload,
    );
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_TOKEN_KEY, res.accessToken);
      window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
    }
    return res.user;
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
    await httpClient.post(API_ENDPOINTS.auth.logout).catch(() => undefined);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_USER_KEY);
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  },

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    return httpClient.post<{ message: string }>(API_ENDPOINTS.auth.forgotPassword, { email });
  },

  async confirmPasswordReset(email: string, otp: string, newPassword: string): Promise<void> {
    await httpClient.post(API_ENDPOINTS.auth.resetPassword, { email, otp, newPassword });
  },
};
