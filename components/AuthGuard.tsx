"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== "/login" && !user) {
      router.replace("/login");
    }
  }, [pathname, user, router]);

  if (pathname === "/login" || user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold">
        N
      </div>
    </div>
  );
}
