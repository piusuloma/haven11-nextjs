"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Shield, AlertCircle } from "lucide-react";
import { useAdminAuth } from "@/lib/adminAuth";

export default function AdminLoginPage() {
  const { login } = useAdminAuth();
  const router     = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const ok = login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (ok) {
      router.replace("/admin/dashboard");
    } else {
      setError("Invalid email or password.");
    }
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/20 text-primary-foreground text-2xl font-bold mb-4">
            N
          </div>
          <h1 className="text-primary-foreground text-xl font-semibold">NativeID Admin</h1>
          <p className="text-primary-foreground/60 text-sm mt-1">Sign in to the control panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-primary-foreground/80 mb-1.5">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@nativeid.app"
              className="w-full bg-white/10 border border-white/20 text-primary-foreground rounded-xl px-4 py-3 text-sm placeholder:text-primary-foreground/30 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-colors"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-primary-foreground/80 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/10 border border-white/20 text-primary-foreground rounded-xl px-4 py-3 pr-11 text-sm placeholder:text-primary-foreground/30 focus:outline-none focus:border-white/50 focus:bg-white/15 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-foreground/40 hover:text-primary-foreground transition-colors"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm bg-destructive/20 border border-destructive/40 text-primary-foreground rounded-lg px-3 py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-white/90 disabled:opacity-60 text-primary font-semibold py-3 rounded-xl text-sm transition-colors mt-2"
          >
            {loading ? (
              <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="mt-8 border border-white/15 rounded-xl p-4 space-y-1">
          <p className="text-primary-foreground/40 text-xs font-medium uppercase tracking-wider mb-2">Demo credentials</p>
          {[
            { label: "Super Admin", email: "yemi@nativeid.app", pwd: "admin123"   },
            { label: "Support",     email: "kemi@nativeid.app", pwd: "support123" },
            { label: "Viewer",      email: "dayo@nativeid.app", pwd: "view123"    },
          ].map(({ label, email: e, pwd }) => (
            <button
              key={e}
              type="button"
              onClick={() => { setEmail(e); setPassword(pwd); setError(""); }}
              className="flex items-center justify-between w-full text-left hover:bg-white/10 rounded-lg px-2 py-1.5 transition-colors group"
            >
              <span className="text-primary-foreground/50 text-xs">{label}</span>
              <span className="text-primary-foreground/30 text-xs font-mono group-hover:text-primary-foreground/60 transition-colors">{e}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
