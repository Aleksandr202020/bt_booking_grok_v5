"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type SlotStatus = "free" | "busy" | "held" | "blocked" | "past" | "closed";

type SlotInfo = {
  time: string;
  endTime: string;
  status: SlotStatus;
};

type SlotsResponse = {
  ok: boolean;
  date: string;
  today: string;
  maxDate: string;
  closed: boolean;
  closedName: string | null;
  slots: SlotInfo[];
  error?: string;
};

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  const key = "bt_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(dateStr: string, locale = "ru-RU"): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

const statusLabel: Record<SlotStatus, string> = {
  free: "Свободно",
  busy: "Занято",
  held: "Временно недоступно",
  blocked: "Недоступно",
  past: "Прошло",
  closed: "Выходной",
};

const statusColor: Record<SlotStatus, string> = {
  free: "#16a34a",
  busy: "#6b7280",
  held: "#d97706",
  blocked: "#6b7280",
  past: "#4b5563",
  closed: "#6b7280",
};

export default function BookPage() {
  const [today, setToday] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [closed, setClosed] = useState(false);
  const [closedName, setClosedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [held, setHeld] = useState<{ date: string; time: string; expiresAt: string } | null>(null);

  const loadSlots = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/slots?date=${date}`);
      const data: SlotsResponse = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to load slots");
      setToday(data.today);
      setSelectedDate(data.date);
      setSlots(data.slots);
      setClosed(data.closed);
      setClosedName(data.closedName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/slots")
      .then((r) => r.json())
      .then((data: SlotsResponse) => {
        if (data.ok) {
          setToday(data.today);
          setSelectedDate(data.date);
          setSlots(data.slots);
          setClosed(data.closed);
          setClosedName(data.closedName);
        } else {
          setError(data.error || "Error");
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const dateOptions = useMemo(() => {
    if (!today) return [];
    const list: string[] = [];
    for (let i = 0; i <= 30; i++) {
      list.push(addDaysStr(today, i));
    }
    return list;
  }, [today]);

  async function onSelectSlot(time: string) {
    if (holding) return;
    const sessionId = getSessionId();
    setHolding(true);
    setError(null);
    try {
      const res = await fetch("/api/slots/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          time,
          sessionId,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Слот недоступен");
        await loadSlots(selectedDate);
        return;
      }
      setHeld({ date: selectedDate, time, expiresAt: data.expiresAt });
      await loadSlots(selectedDate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setHolding(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        maxWidth: 480,
        margin: "0 auto",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/" style={{ opacity: 0.6, fontSize: 14 }}>
          ← Назад
        </Link>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, flex: 1 }}>
          Записаться
        </h1>
      </header>

      <section>
        <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 8 }}>Дата</p>
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 4,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {dateOptions.map((d) => {
            const active = d === selectedDate;
            return (
              <button
                key={d}
                type="button"
                onClick={() => loadSlots(d)}
                style={{
                  flex: "0 0 auto",
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: active ? "2px solid #1d9bf0" : "1px solid #38444d",
                  background: active ? "#1d9bf022" : "#16202a",
                  color: "#e7e9ea",
                  fontSize: 13,
                  whiteSpace: "nowrap",
                }}
              >
                {formatDisplayDate(d)}
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <p
          style={{
            padding: 12,
            borderRadius: 10,
            background: "#7f1d1d44",
            color: "#fca5a5",
            fontSize: 14,
          }}
        >
          {error}
        </p>
      )}

      {held && (
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "#14532d44",
            border: "1px solid #16a34a",
            fontSize: 14,
          }}
        >
          <strong>Слот удержан 10 мин</strong>
          <div style={{ marginTop: 4, opacity: 0.9 }}>
            {formatDisplayDate(held.date)} · {held.time}
          </div>
          <p style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            Следующий шаг: авто → услуга → подтверждение (скоро)
          </p>
        </div>
      )}

      <section>
        <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 8 }}>
          {selectedDate ? formatDisplayDate(selectedDate) : "Время"}
          {closed && closedName ? ` · ${closedName}` : ""}
        </p>

        {loading ? (
          <p style={{ opacity: 0.5 }}>Загрузка…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {slots.map((slot) => {
              const selectable = slot.status === "free" && !holding;
              const isMine =
                held?.date === selectedDate && held?.time === slot.time;

              return (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!selectable && !isMine}
                  onClick={() => selectable && onSelectSlot(slot.time)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: isMine
                      ? "2px solid #16a34a"
                      : "1px solid #38444d",
                    background: isMine
                      ? "#14532d33"
                      : selectable
                        ? "#16202a"
                        : "#0f1419",
                    color: selectable || isMine ? "#e7e9ea" : "#6b7280",
                    opacity: selectable || isMine ? 1 : 0.7,
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 16 }}>
                    {slot.time}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: isMine ? "#4ade80" : statusColor[slot.status],
                    }}
                  >
                    {isMine ? "Выбрано" : statusLabel[slot.status]}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
