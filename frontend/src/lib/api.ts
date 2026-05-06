const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export type User = {
  id: number;
  username: string;
  is_admin: boolean;
};

export type Link = {
  id: number;
  code: string;
  short_url: string;
  target_url: string;
  user_id: number;
  username?: string;
  expires_at?: string | null;
  created_at: string;
};

export type AdminUser = {
  id: number;
  username: string;
  is_admin: boolean;
  created_at: string;
  links_count: number;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  opts: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (opts.auth) {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(data?.error || `Ошибка ${res.status}`, res.status);
  }
  return data as T;
}

export const api = {
  register: (username: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<User>("/api/auth/me", { auth: true }),
  listLinks: () => request<Link[]>("/api/links", { auth: true }),
  createLink: (
    target_url: string,
    custom_slug?: string,
    expires_at?: string,
  ) =>
    request<Link>("/api/links", {
      method: "POST",
      auth: true,
      body: JSON.stringify({
        target_url,
        custom_slug: custom_slug || undefined,
        expires_at: expires_at || undefined,
      }),
    }),
  deleteLink: (id: number) =>
    request<null>(`/api/links/${id}`, { method: "DELETE", auth: true }),
  adminListUsers: () => request<AdminUser[]>("/api/admin/users", { auth: true }),
  adminDeleteUser: (id: number) =>
    request<null>(`/api/admin/users/${id}`, { method: "DELETE", auth: true }),
  adminListAllLinks: () =>
    request<Link[]>("/api/admin/links", { auth: true }),
};
