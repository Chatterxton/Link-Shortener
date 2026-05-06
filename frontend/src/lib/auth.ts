import type { User } from "./api";

const USER_KEY = "user";

export const authStore = {
  setUser(user: User) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event("auth-changed"));
  },
  clear() {
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event("auth-changed"));
  },
  user(): User | null {
    if (typeof window === "undefined") return null;
    const s = localStorage.getItem(USER_KEY);
    return s ? (JSON.parse(s) as User) : null;
  },
};
