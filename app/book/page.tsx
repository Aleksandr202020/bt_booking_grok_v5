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

type Category = {
  id: string;
  slug: string;
  nameLv: string;
  nameRu: string;
  nameEn: string;
};

type Model = {
  id: string;
  name: string;
  category: Category;
};

type Brand = {
  id: string;
  name: string;
  models: Model[];
};

type ServiceItem = {
  id: string;
  slug: string;
  nameRu: string;
  nameLv: string;
  nameEn: string;
  isExtra: boolean;
  priceCents: number;
};

type Step = "datetime" | "car" | "service";

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

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(0) + " €";
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

const btnBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid #38444d",
  background: "#16202a",
  color: "#e7e9ea",
  textAlign: "left",
  width: "100%",
};

export default function BookPage() {
  const [step, setStep] = useState<Step>("datetime");

  // datetime
  const [today, setToday] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [closed, setClosed] = useState(false);
  const [closedName, setClosedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [held, setHeld] = useState<{ date: string; time: string; expiresAt: string } | null>(null);

  // car
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // service
  const [mainServices, setMainServices] = useState<ServiceItem[]>([]);
  const [extras, setExtras] = useState<ServiceItem[]>([]);
  const [selectedMainId, setSelectedMainId] = useState<string | null>(null);
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);

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
    for (let i = 0; i <= 30; i++) list.push(addDaysStr(today, i));
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
        body: JSON.stringify({ date: selectedDate, time, sessionId }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Слот недоступен");
        await loadSlots(selectedDate);
        return;
      }
      setHeld({ date: selectedDate, time, expiresAt: data.expiresAt });
      await loadSlots(selectedDate);

      // load catalog and go to car step
      setCatalogLoading(true);
      const catRes = await fetch("/api/catalog");
      const catData = await catRes.json();
      if (catData.ok) setBrands(catData.brands);
      setCatalogLoading(false);
      setStep("car");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setHolding(false);
    }
  }

  const selectedBrand = brands.find((b) => b.id === selectedBrandId) ?? null;

  async function goToService() {
    if (!selectedModel) return;
    setServicesLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/services?categoryId=${selectedModel.category.id}`
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to load services");
      setMainServices(data.main);
      setExtras(data.extras);
      setSelectedMainId(data.main[0]?.id ?? null);
      setSelectedExtraIds([]);
      setStep("service");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setServicesLoading(false);
    }
  }

  function toggleExtra(id: string) {
    setSelectedExtraIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const totalCents = useMemo(() => {
    let t = 0;
    const main = mainServices.find((s) => s.id === selectedMainId);
    if (main) t += main.priceCents;
    for (const id of selectedExtraIds) {
      const e = extras.find((s) => s.id === id);
      if (e) t += e.priceCents;
    }
    return t;
  }, [mainServices, extras, selectedMainId, selectedExtraIds]);

  const summaryBar =
    held && (
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          background: "#14532d44",
          border: "1px solid #16a34a55",
          fontSize: 13,
        }}
      >
        {formatDisplayDate(held.date)} · {held.time}
        {selectedModel && selectedBrand
          ? ` · ${selectedBrand.name} ${selectedModel.name}`
          : ""}
      </div>
    );

  // ─── STEP: datetime ───
  if (step === "datetime") {
    return (
      <main style={pageStyle}>
        <Header title="Записаться" />

        <section>
          <Label>Дата</Label>
          <div style={scrollRow}>
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

        {error && <ErrorBox text={error} />}

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
            <div style={{ marginTop: 4 }}>
              {formatDisplayDate(held.date)} · {held.time}
            </div>
          </div>
        )}

        <section>
          <Label>
            {selectedDate ? formatDisplayDate(selectedDate) : "Время"}
            {closed && closedName ? ` · ${closedName}` : ""}
          </Label>

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
                      ...btnBase,
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

  // ─── STEP: car ───
  if (step === "car") {
    return (
      <main style={pageStyle}>
        <Header
          title="Автомобиль"
          onBack={() => {
            setStep("datetime");
            setSelectedBrandId(null);
            setSelectedModel(null);
          }}
        />
        {summaryBar}
        {error && <ErrorBox text={error} />}

        {catalogLoading ? (
          <p style={{ opacity: 0.5 }}>Загрузка каталога…</p>
        ) : !selectedBrandId ? (
          <section>
            <Label>Марка</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {brands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBrandId(b.id)}
                  style={btnBase}
                >
                  <span style={{ fontWeight: 600 }}>{b.name}</span>
                  <span style={{ opacity: 0.5, fontSize: 13 }}>
                    {b.models.length} мод.
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section>
            <button
              type="button"
              onClick={() => {
                setSelectedBrandId(null);
                setSelectedModel(null);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#1d9bf0",
                fontSize: 13,
                marginBottom: 8,
                padding: 0,
              }}
            >
              ← {selectedBrand?.name}
            </button>
            <Label>Модель</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {selectedBrand?.models.map((m) => {
                const active = selectedModel?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModel(m)}
                    style={{
                      ...btnBase,
                      border: active
                        ? "2px solid #1d9bf0"
                        : "1px solid #38444d",
                      background: active ? "#1d9bf022" : "#16202a",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{m.name}</span>
                    <span style={{ fontSize: 12, opacity: 0.65 }}>
                      {m.category.nameRu}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedModel && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
                  Категория: <strong>{selectedModel.category.nameRu}</strong>
                  <br />
                  (определяется автоматически)
                </p>
                <button
                  type="button"
                  onClick={goToService}
                  disabled={servicesLoading}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: 12,
                    border: "none",
                    background: "#1d9bf0",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 16,
                  }}
                >
                  {servicesLoading ? "Загрузка…" : "Далее — услуга"}
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    );
  }

  // ─── STEP: service ───
  return (
    <main style={pageStyle}>
      <Header
        title="Услуга"
        onBack={() => {
          setStep("car");
        }}
      />
      {summaryBar}
      {error && <ErrorBox text={error} />}

      <section>
        <Label>Основная услуга</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {mainServices.map((s) => {
            const active = selectedMainId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedMainId(s.id)}
                style={{
                  ...btnBase,
                  border: active ? "2px solid #1d9bf0" : "1px solid #38444d",
                  background: active ? "#1d9bf022" : "#16202a",
                }}
              >
                <span style={{ fontWeight: 600 }}>{s.nameRu}</span>
                <span style={{ fontWeight: 600 }}>{formatPrice(s.priceCents)}</span>
              </button>
            );
          })}
        </div>
      </section>

      {extras.length > 0 && (
        <section>
          <Label>Дополнительно</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {extras.map((s) => {
              const active = selectedExtraIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleExtra(s.id)}
                  style={{
                    ...btnBase,
                    border: active ? "2px solid #16a34a" : "1px solid #38444d",
                    background: active ? "#14532d33" : "#16202a",
                  }}
                >
                  <span>
                    {active ? "✓ " : ""}
                    {s.nameRu}
                  </span>
                  <span>{formatPrice(s.priceCents)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div
        style={{
          marginTop: 8,
          padding: 16,
          borderRadius: 12,
          background: "#16202a",
          border: "1px solid #38444d",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 700,
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          <span>Итого</span>
          <span>{formatPrice(totalCents)}</span>
        </div>
        <p style={{ fontSize: 12, opacity: 0.55, marginBottom: 12 }}>
          Подтверждение записи — следующий шаг (регистрация / вход)
        </p>
        <button
          type="button"
          disabled
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            border: "none",
            background: "#38444d",
            color: "#9ca3af",
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          Подтвердить (скоро)
        </button>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  maxWidth: 480,
  margin: "0 auto",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const scrollRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  overflowX: "auto",
  paddingBottom: 4,
  WebkitOverflowScrolling: "touch",
};

function Header({
  title,
  onBack,
}: {
  title: string;
  onBack?: () => void;
}) {
  return (
    <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: "#e7e9ea",
            opacity: 0.6,
            fontSize: 14,
            padding: 0,
          }}
        >
          ← Назад
        </button>
      ) : (
        <Link href="/" style={{ opacity: 0.6, fontSize: 14 }}>
          ← Назад
        </Link>
      )}
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, flex: 1 }}>{title}</h1>
    </header>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 8 }}>{children}</p>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <p
      style={{
        padding: 12,
        borderRadius: 10,
        background: "#7f1d1d44",
        color: "#fca5a5",
        fontSize: 14,
      }}
    >
      {text}
    </p>
  );
}
