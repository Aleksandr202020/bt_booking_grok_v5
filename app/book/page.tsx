"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Redirect to multi-step flow (kept as separate modules for size) */
export default function BookPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/book/flow");
  }, [router]);
  return (
    <main style={{ padding: 24, textAlign: "center" }}>
      <p style={{ opacity: 0.6 }}>Загрузка…</p>
    </main>
  );
}
