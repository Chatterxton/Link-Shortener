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
  note: string;
  click_count: number;
  max_clicks: number | null;
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

export type CreateLinkInput = {
  target_url: string;
  custom_slug?: string;
  expires_at?: string;
  note?: string;
  max_clicks?: number;
};

export type CreateUserInput = {
  username: string;
  password: string;
  is_admin: boolean;
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
  opts: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
    credentials: "include",
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
  needsBootstrap: () =>
    request<{ needs_bootstrap: boolean }>("/api/auth/needs-bootstrap"),
  register: (username: string, password: string) =>
    request<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<null>("/api/auth/logout", { method: "POST" }),
  me: () => request<User>("/api/auth/me"),
  listLinks: () => request<Link[]>("/api/links"),
  createLink: (input: CreateLinkInput) =>
    request<Link>("/api/links", {
      method: "POST",
      body: JSON.stringify({
        target_url: input.target_url,
        custom_slug: input.custom_slug || undefined,
        expires_at: input.expires_at || undefined,
        note: input.note || undefined,
        max_clicks: input.max_clicks ?? undefined,
      }),
    }),
  deleteLink: (id: number) =>
    request<null>(`/api/links/${id}`, { method: "DELETE" }),
  adminListUsers: () => request<AdminUser[]>("/api/admin/users"),
  adminCreateUser: (input: CreateUserInput) =>
    request<AdminUser>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  adminDeleteUser: (id: number) =>
    request<null>(`/api/admin/users/${id}`, { method: "DELETE" }),
  adminListAllLinks: () => request<Link[]>("/api/admin/links"),
};
