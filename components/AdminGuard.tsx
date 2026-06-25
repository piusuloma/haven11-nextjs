"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/adminAuth";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { admin } = useAdminAuth();
  const router    = useRouter();

  useEffect(() => {
    if (!admin) router.replace("/admin/login");
  }, [admin, router]);

  if (!admin) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/20 text-primary-foreground text-xl font-bold">
          N
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
