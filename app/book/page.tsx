"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SlotStatus = "free" | "busy" | "held" | "blocked" | "past" | "closed";

type SlotInfo = {
  time: string;
  endTime: string;
  status: SlotStatus;
  holdExpiresAt?: string;
  holdSessionId?: string;
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

type MyCar = {
  id: string;
  plate: string | null;
  brandName: string;
  modelName: string;
  modelId: string;
  category: Category;
};

type Brand = {
  id: string;
  name: string;
  models: { id: string; name: string; category: Category }[];
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

type Step = "datetime" | "auth" | "car" | "service";

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

function formatRemain(expiresAtIso: string, nowMs: number): string {
  const ms = new Date(expiresAtIso).getTime() - nowMs;
  if (ms <= 0) return "0:00";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const statusLabel: Record<SlotStatus, string> = {
  free: "Свободно",
  busy: "Занято",
  held: "Бронируют",
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

const HOLD_KEY = "bt_active_hold";

export default function BookPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("datetime");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [sessionId, setSessionId] = useState("");
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);

  const [today, setToday] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [closed, setClosed] = useState(false);
  const [closedName, setClosedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [held, setHeld] = useState<{ date: string; time: string; expiresAt: string } | null>(null);

  // my cars
  const [myCars, setMyCars] = useState<MyCar[]>([]);
  const [selectedCar, setSelectedCar] = useState<MyCar | null>(null);
  const [carsLoading, setCarsLoading] = useState(false);
  const [addingCar, setAddingCar] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [savingCar, setSavingCar] = useState(false);

  const [mainServices, setMainServices] = useState<ServiceItem[]>([]);
  const [extras, setExtras] = useState<ServiceItem[]>([]);
  const [selectedMainId, setSelectedMainId] = useState<string | null>(null);
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // restore hold + check auth on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(HOLD_KEY);
      if (raw) {
        const h = JSON.parse(raw) as { date: string; time: string; expiresAt: string };
        if (new Date(h.expiresAt).getTime() > Date.now()) {
          setHeld(h);
        } else {
          sessionStorage.removeItem(HOLD_KEY);
        }
      }
    } catch {
      /* ignore */
    }

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.user) setUser(d.user);
      })
      .catch(() => {});
  }, []);

  const loadSlots = useCallback(async (date: string) => {
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
        } else setError(data.error || "Error");
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (step !== "datetime" || !selectedDate) return;
    const t = setInterval(() => loadSlots(selectedDate), 15000);
    return () => clearInterval(t);
  }, [step, selectedDate, loadSlots]);

  useEffect(() => {
    if (held && new Date(held.expiresAt).getTime() <= nowMs) {
      setHeld(null);
      sessionStorage.removeItem(HOLD_KEY);
      if (selectedDate) loadSlots(selectedDate);
    }
  }, [held, nowMs, selectedDate, loadSlots]);

  const dateOptions = useMemo(() => {
    if (!today) return [];
    const list: string[] = [];
    for (let i = 0; i <= 30; i++) list.push(addDaysStr(today, i));
    return list;
  }, [today]);

  async function loadMyCars() {
    setCarsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cars");
      const data = await res.json();
      if (res.status === 401) {
        setStep("auth");
        return;
      }
      if (!data.ok) throw new Error(data.error);
      setMyCars(data.cars);
      setStep("car");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setCarsLoading(false);
    }
  }

  async function onSelectSlot(time: string) {
    if (holding) return;
    const sid = getSessionId();
    setHolding(true);
    setError(null);
    try {
      const res = await fetch("/api/slots/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, time, sessionId: sid }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Слот недоступен");
        await loadSlots(selectedDate);
        return;
      }
      const h = { date: selectedDate, time, expiresAt: data.expiresAt as string };
      setHeld(h);
      sessionStorage.setItem(HOLD_KEY, JSON.stringify(h));
      await loadSlots(selectedDate);

      // check auth
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();
      if (me.ok && me.user) {
        setUser(me.user);
        await loadMyCars();
      } else {
        setStep("auth");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setHolding(false);
    }
  }

  async function startAddCar() {
    setAddingCar(true);
    setSelectedBrandId(null);
    setSelectedModelId(null);
    const res = await fetch("/api/catalog");
    const data = await res.json();
    if (data.ok) setBrands(data.brands);
  }

  async function saveNewCar() {
    if (!selectedModelId) return;
    setSavingCar(true);
    setError(null);
    try {
      const res = await fetch("/api/cars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: selectedModelId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setAddingCar(false);
      setMyCars((prev) => [data.car, ...prev]);
      setSelectedCar(data.car);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingCar(false);
    }
  }

  async function goToService() {
    if (!selectedCar) return;
    setServicesLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/services?categoryId=${selectedCar.category.id}`
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

  const myHoldRemain =
    held && new Date(held.expiresAt).getTime() > nowMs
      ? formatRemain(held.expiresAt, nowMs)
      : null;

  const selectedBrand = brands.find((b) => b.id === selectedBrandId);

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
        {selectedCar ? ` · ${selectedCar.brandName} ${selectedCar.modelName}` : ""}
        {myHoldRemain ? ` · ${myHoldRemain}` : ""}
      </div>
    );

  function slotRightLabel(slot: SlotInfo, isMine: boolean): string {
    if (isMine) return "Выбрано";
    if (slot.status === "held" && slot.holdExpiresAt) {
      return `Бронируют · ${formatRemain(slot.holdExpiresAt, nowMs)}`;
    }
    return statusLabel[slot.status];
  }

  // ─── datetime ───
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
                  onClick={() => {
                    setLoading(true);
                    loadSlots(d);
                  }}
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

        {held && myHoldRemain && (
          <div style={holdBox}>
            <strong>Слот удержан · {myHoldRemain}</strong>
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
                const isMine =
                  !!held &&
                  held.date === selectedDate &&
                  held.time === slot.time &&
                  (!slot.holdSessionId || slot.holdSessionId === sessionId);
                const selectable = slot.status === "free" && !holding;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!selectable && !isMine}
                    onClick={() => selectable && onSelectSlot(slot.time)}
                    style={{
                      ...btnBase,
                      flexDirection: "column",
                      alignItems: "stretch",
                      gap: 4,
                      border: isMine
                        ? "2px solid #16a34a"
                        : slot.status === "held"
                          ? "1px solid #d9770666"
                          : "1px solid #38444d",
                      background: isMine
                        ? "#14532d33"
                        : selectable
                          ? "#16202a"
                          : "#0f1419",
                      color: selectable || isMine ? "#e7e9ea" : "#9ca3af",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600, fontSize: 16 }}>{slot.time}</span>
                      <span
                        style={{
                          fontSize: 13,
                          color: isMine ? "#4ade80" : statusColor[slot.status],
                        }}
                      >
                        {slotRightLabel(slot, isMine)}
                      </span>
                    </div>
                    {slot.status === "held" && !isMine && (
                      <span style={{ fontSize: 11, opacity: 0.65 }}>
                        Кто-то оформляет запись. Если не подтвердит — слот
                        освободится
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>
    );
  }

  // ─── auth required ───
  if (step === "auth") {
    const next = encodeURIComponent("/book");
    return (
      <main style={pageStyle}>
        <Header title="Вход" onBack={() => setStep("datetime")} />
        {summaryBar}
        <p style={{ lineHeight: 1.5, opacity: 0.85 }}>
          Чтобы выбрать автомобиль и подтвердить запись, войдите или
          зарегистрируйтесь. Слот удерживается ещё{" "}
          <strong>{myHoldRemain || "…"}</strong>.
        </p>
        <Link href={`/login?next=${next}`} style={primaryBtnLink}>
          Войти
        </Link>
        <Link href={`/register?next=${next}`} style={{ ...primaryBtnLink, background: "#38444d" }}>
          Регистрация
        </Link>
      </main>
    );
  }

  // ─── car: my cars ───
  if (step === "car") {
    return (
      <main style={pageStyle}>
        <Header
          title="Автомобиль"
          onBack={() => {
            setStep("datetime");
            setSelectedCar(null);
            setAddingCar(false);
          }}
        />
        {summaryBar}
        {error && <ErrorBox text={error} />}

        {carsLoading ? (
          <p style={{ opacity: 0.5 }}>Загрузка…</p>
        ) : addingCar ? (
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Label>Добавить автомобиль</Label>
            {!selectedBrandId ? (
              brands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBrandId(b.id)}
                  style={btnBase}
                >
                  {b.name}
                </button>
              ))
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBrandId(null);
                    setSelectedModelId(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#1d9bf0",
                    textAlign: "left",
                    padding: 0,
                  }}
                >
                  ← {selectedBrand?.name}
                </button>
                <Label>Модель</Label>
                {selectedBrand?.models.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModelId(m.id)}
                    style={{
                      ...btnBase,
                      border:
                        selectedModelId === m.id
                          ? "2px solid #1d9bf0"
                          : "1px solid #38444d",
                    }}
                  >
                    <span>{m.name}</span>
                    <span style={{ fontSize: 12, opacity: 0.6 }}>
                      {m.category.nameRu}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  disabled={!selectedModelId || savingCar}
                  onClick={saveNewCar}
                  style={primaryBtn}
                >
                  {savingCar ? "…" : "Сохранить и выбрать"}
                </button>
                <button
                  type="button"
                  onClick={() => setAddingCar(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#9ca3af",
                  }}
                >
                  Отмена
                </button>
              </>
            )}
          </section>
        ) : (
          <>
            <Label>Мои автомобили</Label>
            {myCars.length === 0 ? (
              <p style={{ opacity: 0.6, marginBottom: 12 }}>
                Нет сохранённых авто — добавьте первое
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {myCars.map((c) => {
                  const active = selectedCar?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCar(c)}
                      style={{
                        ...btnBase,
                        border: active
                          ? "2px solid #1d9bf0"
                          : "1px solid #38444d",
                        background: active ? "#1d9bf022" : "#16202a",
                      }}
                    >
                      <span>
                        <strong>
                          {c.brandName} {c.modelName}
                        </strong>
                        <br />
                        <span style={{ fontSize: 12, opacity: 0.65 }}>
                          {c.category.nameRu}
                        </span>
                      </span>
                      {active && (
                        <span style={{ color: "#4ade80", fontSize: 13 }}>
                          Выбрано
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={startAddCar}
              style={{
                ...primaryBtn,
                background: "#38444d",
                marginTop: 8,
              }}
            >
              + Добавить автомобиль
            </button>

            {selectedCar && (
              <button
                type="button"
                onClick={goToService}
                disabled={servicesLoading}
                style={{ ...primaryBtn, marginTop: 8 }}
              >
                {servicesLoading ? "Загрузка…" : "Далее — услуга"}
              </button>
            )}
          </>
        )}
      </main>
    );
  }

  // ─── service ───
  return (
    <main style={pageStyle}>
      <Header title="Услуга" onBack={() => setStep("car")} />
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

      <div style={totalBox}>
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
          Подтверждение записи — следующий шаг
        </p>
        <button type="button" disabled style={{ ...primaryBtn, background: "#38444d", color: "#9ca3af" }}>
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

const holdBox: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  background: "#14532d44",
  border: "1px solid #16a34a",
  fontSize: 14,
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: 12,
  border: "none",
  background: "#1d9bf0",
  color: "#fff",
  fontWeight: 600,
  fontSize: 16,
};

const primaryBtnLink: React.CSSProperties = {
  ...primaryBtn,
  display: "block",
  textAlign: "center",
  textDecoration: "none",
};

const totalBox: React.CSSProperties = {
  marginTop: 8,
  padding: 16,
  borderRadius: 12,
  background: "#16202a",
  border: "1px solid #38444d",
};

function Header({ title, onBack }: { title: string; onBack?: () => void }) {
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
