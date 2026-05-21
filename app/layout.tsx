import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { StoreProvider } from "@/lib/store";
import { AuthGuard } from "@/components/AuthGuard";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "NativeID ROS",
  description: "Restaurant Operating System for NativeID",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap"
        />
      </head>
      <body>
        <AuthProvider>
          <StoreProvider>
            <AuthGuard>{children}</AuthGuard>
            <Toaster position="top-right" richColors />
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
