import { API_CONFIG } from "@/config/api";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}

export const AUTH_TOKEN_KEY = "mocbooks_access_token";
export const AUTH_USER_KEY = "mocbooks_current_user";
/** Phát ra khi backend trả 401 cho request có token (hết hạn / bị thu hồi / tài khoản bị khóa). */
export const SESSION_EXPIRED_EVENT = "mocbooks:session-expired";

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

function handleSessionExpired(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  const normalizedBase = API_CONFIG.baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${normalizedBase}${normalizedPath}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { params, body, headers, ...rest } = options;
  const token = getAuthToken();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(buildUrl(path, params), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      ...rest,
      });
    } catch (error) {
      // Mất kết nối / máy chủ không chạy / quá thời gian chờ: báo rõ, KHÔNG coi là thành công.
      const timedOut = error instanceof DOMException && error.name === "AbortError";
      throw new ApiError(
        timedOut
          ? "Máy chủ phản hồi quá lâu. Thao tác có thể chưa được ghi nhận – vui lòng kiểm tra lại trước khi thử tiếp."
          : "Không kết nối được máy chủ. Kiểm tra API đang chạy rồi thử lại.",
        0,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    const payload: unknown = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text();

    if (!response.ok) {
      // Có gửi token mà vẫn 401 → phiên không còn hợp lệ, xóa phiên phía FE.
      if (response.status === 401 && token) handleSessionExpired();
      const msg =
        typeof payload === "object" && payload && "message" in payload
          ? String((payload as { message: unknown }).message)
          : `Yêu cầu thất bại (HTTP ${response.status})`;
      throw new ApiError(msg, response.status, payload);
    }

    return payload as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const httpClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, options),
};
