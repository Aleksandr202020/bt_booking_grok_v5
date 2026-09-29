"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  date: string;
  time: string;
  carId: string;
  sessionId: string;
  mainServiceId: string;
  extraServiceIds: string[];
  totalCents: number;
  summary: string;
  onSuccess: (booking: {
    id: string;
    date: string;
    startTime: string;
    carBrandName: string;
    carModelName: string;
    totalPriceCents: number;
  }) => void;
};

function getSessionId(): string {
  const key = "bt_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function BookConfirmButton(props: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: props.date,
          time: props.time,
          carId: props.carId,
          sessionId: props.sessionId || getSessionId(),
          mainServiceId: props.mainServiceId,
          extraServiceIds: props.extraServiceIds,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Ошибка");
        return;
      }
      sessionStorage.removeItem("bt_active_hold");
      props.onSuccess(data.booking);
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && (
        <p style={{ color: "#fca5a5", fontSize: 14, marginBottom: 10 }}>{error}</p>
      )}
      <button
        type="button"
        disabled={loading || !props.mainServiceId}
        onClick={confirm}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 12,
          border: "none",
          background: loading ? "#38444d" : "#16a34a",
          color: "#fff",
          fontWeight: 600,
          fontSize: 16,
        }}
      >
        {loading ? "Сохраняем…" : `Подтвердить · ${(props.totalCents / 100).toFixed(0)} €`}
      </button>
    </div>
  );
}

export function BookSuccess({
  booking,
}: {
  booking: {
    id: string;
    date: string;
    startTime: string;
    carBrandName: string;
    carModelName: string;
    totalPriceCents: number;
  };
}) {
  const dateLabel = new Date(booking.date + "T12:00:00Z").toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        maxWidth: 480,
        margin: "0 auto",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        textAlign: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ fontSize: 48 }}>✓</div>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Запись подтверждена</h1>
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          background: "#14532d33",
          border: "1px solid #16a34a",
          textAlign: "left",
          lineHeight: 1.6,
        }}
      >
        <div>
          <strong>{dateLabel}</strong> · {booking.startTime}
        </div>
        <div>
          {booking.carBrandName} {booking.carModelName}
        </div>
        <div style={{ marginTop: 8, fontWeight: 700 }}>
          {(booking.totalPriceCents / 100).toFixed(0)} €
        </div>
      </div>
      <Link
        href="/bookings"
        style={{
          padding: 14,
          borderRadius: 12,
          background: "#1d9bf0",
          color: "#fff",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Мои записи
      </Link>
      <Link href="/" style={{ color: "#1d9bf0", fontSize: 14 }}>
        На главную
      </Link>
    </main>
  );
}
