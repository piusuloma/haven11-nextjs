import { AdminAuthProvider } from "@/lib/adminAuth";

export const metadata = { title: "NativeID Admin Portal" };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      {children}
    </AdminAuthProvider>
  );
}
