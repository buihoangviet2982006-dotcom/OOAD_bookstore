import type { Metadata } from "next";
import { Providers } from "@/components/layout/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mộc Books — Quản lý Nhà sách",
  description: "Hệ thống quản lý bán hàng, kho sách, công nợ và điều hành nhà sách",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full bg-[#F7F8F6] text-zinc-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
