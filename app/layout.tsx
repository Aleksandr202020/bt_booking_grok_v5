import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BT Booking v5",
  description: "Online booking for BT Automazgātava",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="lv">
      <body>{children}</body>
    </html>
  );
}
