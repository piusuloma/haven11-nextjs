"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

const PUBLIC_ROUTES = new Set(["/login", "/welcome"]);

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_ROUTES.has(pathname);

  useEffect(() => {
    if (!isPublic && !user) {
      router.replace("/welcome");
    }
  }, [isPublic, user, router]);

  if (isPublic || user) {
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
