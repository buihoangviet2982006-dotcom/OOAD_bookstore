import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OOAD Bookstore",
  description: "Full-stack Bookstore built with Next.js, NestJS, Prisma, and PostgreSQL",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
