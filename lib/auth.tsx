"use client";

import React, { createContext, useContext, useState } from "react";

export type StaffRole = "owner" | "manager" | "cashier" | "kitchen" | "bartender" | "storekeeper";

export interface StaffUser {
  id: string;
  name: string;
  initials: string;
  role: StaffRole;
  title: string;
  pin: string;
  defaultRoute: string;
  /** Home branch id. Undefined = the Owner, who sees every branch. */
  branch?: string;
}

export const STAFF_ROSTER: StaffUser[] = [
  { id: "1", name: "Seun O.",  initials: "SO", role: "owner",       title: "Owner",          pin: "0000", defaultRoute: "/",                  branch: undefined },
  { id: "2", name: "Tunde A.", initials: "TA", role: "manager",     title: "Branch Manager", pin: "1111", defaultRoute: "/manager-dashboard", branch: "lekki" },
  { id: "3", name: "Ada O.",   initials: "AO", role: "cashier",     title: "Cashier",        pin: "2222", defaultRoute: "/cashier-home",      branch: "lekki" },
  { id: "4", name: "Amara K.", initials: "AK", role: "kitchen",     title: "Head Chef",      pin: "3333", defaultRoute: "/kitchen-home",      branch: "lekki" },
  { id: "5", name: "Chukwu B.",initials: "CB", role: "bartender",   title: "Bartender",      pin: "4444", defaultRoute: "/bar-home",          branch: "lekki" },
  { id: "6", name: "Eze M.",   initials: "EM", role: "storekeeper", title: "Storekeeper",    pin: "5555", defaultRoute: "/store-home",        branch: "strong-room" },
];

interface AuthContextValue {
  user: StaffUser | null;
  login: (id: string, pin: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem("nativeid_user");
      if (!stored) return null;
      const parsed = JSON.parse(stored) as { id: string };
      return STAFF_ROSTER.find((s) => s.id === parsed.id) ?? null;
    } catch {
      return null;
    }
  });

  function login(id: string, pin: string): boolean {
    const staff = STAFF_ROSTER.find((s) => s.id === id && s.pin === pin);
    if (!staff) return false;
    setUser(staff);
    try { localStorage.setItem("nativeid_user", JSON.stringify({ id: staff.id })); } catch { /* */ }
    return true;
  }

  function logout() {
    setUser(null);
    try { localStorage.removeItem("nativeid_user"); } catch { /* */ }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
