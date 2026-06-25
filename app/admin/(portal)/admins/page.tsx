"use client";

import { Shield, Clock } from "lucide-react";
import { ADMIN_USERS, fmtRelativeTime } from "@/lib/adminData";
import { useAdminAuth } from "@/lib/adminAuth";

const ROLE_COLORS: Record<string, string> = {
  super_admin: "text-violet-700 bg-violet-50 border-violet-200",
  support:     "text-indigo-700 bg-indigo-50 border-indigo-200",
  viewer:      "text-slate-600 bg-slate-100 border-slate-200",
};

export default function AdminUsersPage() {
  const { admin } = useAdminAuth();

  return (
    <div className="p-6 lg:p-8 max-w-[900px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Users</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage who has access to this control panel</p>
        </div>
      </div>

      {/* Permission summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { role: "Super Admin",   perms: ["Full access", "Impersonation", "Subscription changes", "Admin provisioning"] },
          { role: "Support Agent", perms: ["Tenant drill-down", "Activity log", "Alert management", "Read-only impersonation"] },
          { role: "Viewer",        perms: ["Platform dashboard", "Tenant list (read-only)", "No drill-down"] },
        ].map(({ role, perms }) => (
          <div key={role} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-indigo-500" />
              <p className="font-semibold text-slate-900 text-sm">{role}</p>
            </div>
            <ul className="space-y-1">
              {perms.map((p) => (
                <li key={p} className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Admins list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Team Members</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {ADMIN_USERS.map((u) => (
            <div key={u.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">
                {u.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{u.name}</p>
                  {admin?.email === u.email && (
                    <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">You</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{u.email}</p>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${ROLE_COLORS[u.role]}`}>
                {u.roleLabel}
              </span>
              <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5" />
                {fmtRelativeTime(u.lastLogin)}
              </div>
              <div className={`h-2 w-2 rounded-full ${u.active ? "bg-emerald-400" : "bg-slate-300"}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
