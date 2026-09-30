"use client";

import { useCallback, useEffect, useState } from "react";
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

const statusRu: Record<string, string> = {
  CONFIRMED: "Подтверждена",
  CANCELLED: "Отменена",
  COMPLETED: "Завершена",
};

export default function MyBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bookings");
      const d = await res.json();
      if (d.error === "Войдите в аккаунт") {
        router.push("/login?next=/bookings");
        return;
      }
      if (!d.ok) throw new Error(d.error);
      setBookings(d.bookings);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function cancel(id: string) {
    if (!confirm("Отменить эту запись?")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "Ошибка отмены");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
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

      {error && <p style={{ color: "#fca5a5", fontSize: 14 }}>{error}</p>}

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
        bookings.map((b) => {
          const canCancel = b.status === "CONFIRMED";
          return (
            <div key={b.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>
                  {formatDate(b.date)} · {b.startTime}
                </strong>
                <span
                  style={{
                    fontSize: 13,
                    color:
                      b.status === "CANCELLED"
                        ? "#f87171"
                        : b.status === "CONFIRMED"
                          ? "#4ade80"
                          : "#9ca3af",
                  }}
                >
                  {statusRu[b.status] || b.status}
                </span>
              </div>
              <div style={{ marginTop: 6, fontSize: 14 }}>
                {b.carBrandName} {b.carModelName}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>
                {b.services.map((s) => s.nameRu).join(", ")}
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontWeight: 600 }}>
                  {(b.totalPriceCents / 100).toFixed(0)} €
                </span>
                {canCancel && (
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => cancel(b.id)}
                    style={{
                      background: "none",
                      border: "1px solid #f87171",
                      color: "#f87171",
                      borderRadius: 8,
                      padding: "6px 12px",
                      fontSize: 13,
                    }}
                  >
                    {busyId === b.id ? "…" : "Отменить"}
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}

      <Link
        href="/book"
        style={{
          marginTop: 8,
          padding: 14,
          borderRadius: 12,
          background: "#1d9bf0",
          color: "#fff",
          fontWeight: 600,
          textAlign: "center",
          textDecoration: "none",
        }}
      >
        + Новая запись
      </Link>
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
