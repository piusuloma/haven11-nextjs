"use client";

import React, { createContext, useContext, useState } from "react";

export type AdminRole = "super_admin" | "support" | "viewer";

export interface AdminUser {
  id: string;
  name: string;
  initials: string;
  email: string;
  adminRole: AdminRole;
  roleLabel: string;
}

export const ADMIN_ROSTER: AdminUser[] = [
  { id: "a1", name: "Yemi Adeyemi", initials: "YA", email: "yemi@nativeid.app",  adminRole: "super_admin", roleLabel: "Super Admin"   },
  { id: "a2", name: "Kemi Okafor",  initials: "KO", email: "kemi@nativeid.app",  adminRole: "support",     roleLabel: "Support Agent" },
  { id: "a3", name: "Dayo Balogun", initials: "DB", email: "dayo@nativeid.app",  adminRole: "viewer",      roleLabel: "Viewer"        },
];

const PASSWORDS: Record<string, string> = {
  "yemi@nativeid.app": "admin123",
  "kemi@nativeid.app": "support123",
  "dayo@nativeid.app": "view123",
};

interface AdminAuthContextValue {
  admin: AdminUser | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem("nativeid_admin_session");
      if (!stored) return null;
      const { id } = JSON.parse(stored) as { id: string };
      return ADMIN_ROSTER.find((a) => a.id === id) ?? null;
    } catch {
      return null;
    }
  });

  function login(email: string, password: string): boolean {
    const user = ADMIN_ROSTER.find((a) => a.email === email);
    if (!user || PASSWORDS[email] !== password) return false;
    setAdmin(user);
    try { localStorage.setItem("nativeid_admin_session", JSON.stringify({ id: user.id })); } catch { /**/ }
    return true;
  }

  function logout() {
    setAdmin(null);
    try { localStorage.removeItem("nativeid_admin_session"); } catch { /**/ }
  }

  return (
    <AdminAuthContext.Provider value={{ admin, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
