import { Suspense } from "react";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p style={{ padding: 16 }}>Загрузка…</p>}>{children}</Suspense>;
}
