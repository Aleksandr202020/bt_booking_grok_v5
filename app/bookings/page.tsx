"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Booking = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  carBrandName: string;
  carModelName: string;
  totalPriceCents: number;
  services: { nameRu: string; priceCents: number }[];
};

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

export default function MyBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((d) => {
        if (rStatus401(d)) {
          router.push("/login?next=/bookings");
          return;
        }
        if (!d.ok) throw new Error(d.error);
        setBookings(d.bookings);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [router]);

  function rStatus401(d: { error?: string }) {
    return d.error === "Войдите в аккаунт";
  }

  return (
    <main style={page}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/" style={{ opacity: 0.6, fontSize: 14 }}>
          ← Назад
        </Link>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, flex: 1 }}>
          Мои записи
        </h1>
      </header>

      {error && <p style={{ color: "#fca5a5" }}>{error}</p>}
      {loading ? (
        <p style={{ opacity: 0.5 }}>Загрузка…</p>
      ) : bookings.length === 0 ? (
        <p style={{ opacity: 0.6 }}>
          Пока нет записей.{" "}
          <Link href="/book" style={{ color: "#1d9bf0" }}>
            Записаться
          </Link>
        </p>
      ) : (
        bookings.map((b) => (
          <div key={b.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>
                {formatDate(b.date)} · {b.startTime}
              </strong>
              <span style={{ fontSize: 13, opacity: 0.7 }}>{b.status}</span>
            </div>
            <div style={{ marginTop: 6, fontSize: 14 }}>
              {b.carBrandName} {b.carModelName}
            </div>
            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>
              {b.services.map((s) => s.nameRu).join(", ")}
            </div>
            <div style={{ marginTop: 8, fontWeight: 600 }}>
              {(b.totalPriceCents / 100).toFixed(0)} €
            </div>
          </div>
        ))
      )}
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  maxWidth: 480,
  margin: "0 auto",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const card: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: "1px solid #38444d",
  background: "#16202a",
};
