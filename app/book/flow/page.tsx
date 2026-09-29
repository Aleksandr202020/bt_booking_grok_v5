"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookConfirmButton, BookSuccess } from "@/app/components/BookConfirm";

type SlotStatus = "free" | "busy" | "held" | "blocked" | "past" | "closed";
type SlotInfo = { time: string; endTime: string; status: SlotStatus; holdExpiresAt?: string; holdSessionId?: string };
type Category = { id: string; slug: string; nameLv: string; nameRu: string; nameEn: string };
type MyCar = { id: string; plate: string | null; brandName: string; modelName: string; modelId: string; category: Category };
type Brand = { id: string; name: string; models: { id: string; name: string; category: Category }[] };
type ServiceItem = { id: string; slug: string; nameRu: string; nameLv: string; nameEn: string; isExtra: boolean; priceCents: number };
type Step = "datetime" | "auth" | "car" | "service";

const HOLD_KEY = "bt_active_hold";
const LABELS: Record<SlotStatus, string> = { free: "Свободно", busy: "Занято", held: "Бронируют", blocked: "Недоступно", past: "Прошло", closed: "Выходной" };
const COLORS: Record<SlotStatus, string> = { free: "#16a34a", busy: "#6b7280", held: "#d97706", blocked: "#6b7280", past: "#4b5563", closed: "#6b7280" };

function sid() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("bt_session_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("bt_session_id", id); }
  return id;
}
function addDays(d: string, n: number) {
  const x = new Date(d + "T12:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
function fmtDate(d: string) {
  return new Date(d + "T12:00:00Z").toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long" });
}
function price(c: number) { return (c / 100).toFixed(0) + " €"; }
function remain(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "0:00";
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const page: React.CSSProperties = { minHeight: "100vh", maxWidth: 480, margin: "0 auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 };
const btn: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 12, border: "1px solid #38444d", background: "#16202a", color: "#e7e9ea", textAlign: "left", width: "100%" };
const primary: React.CSSProperties = { width: "100%", padding: 14, borderRadius: 12, border: "none", background: "#1d9bf0", color: "#fff", fontWeight: 600, fontSize: 16 };

function H({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {onBack ? <button type="button" onClick={onBack} style={{ background: "none", border: "none", color: "#e7e9ea", opacity: 0.6, fontSize: 14, padding: 0 }}>← Назад</button> : <Link href="/" style={{ opacity: 0.6, fontSize: 14 }}>← Назад</Link>}
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, flex: 1 }}>{title}</h1>
    </header>
  );
}

export default function BookFlowPage() {
  const [step, setStep] = useState<Step>("datetime");
  const [now, setNow] = useState(() => Date.now());
  const [sessionId, setSessionId] = useState("");
  const [today, setToday] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [held, setHeld] = useState<{ date: string; time: string; expiresAt: string } | null>(null);
  const [myCars, setMyCars] = useState<MyCar[]>([]);
  const [selectedCar, setSelectedCar] = useState<MyCar | null>(null);
  const [carsLoading, setCarsLoading] = useState(false);
  const [addingCar, setAddingCar] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [savingCar, setSavingCar] = useState(false);
  const [mainServices, setMainServices] = useState<ServiceItem[]>([]);
  const [extras, setExtras] = useState<ServiceItem[]>([]);
  const [mainId, setMainId] = useState<string | null>(null);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [confirmed, setConfirmed] = useState<{ id: string; date: string; startTime: string; carBrandName: string; carModelName: string; totalPriceCents: number } | null>(null);

  useEffect(() => { setSessionId(sid()); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(HOLD_KEY);
      if (raw) {
        const h = JSON.parse(raw);
        if (new Date(h.expiresAt).getTime() > Date.now()) setHeld(h);
        else sessionStorage.removeItem(HOLD_KEY);
      }
    } catch {}
  }, []);

  const loadSlots = useCallback(async (date: string) => {
    try {
      const data = await (await fetch(`/api/slots?date=${date}`)).json();
      if (!data.ok) throw new Error(data.error || "Error");
      setToday(data.today); setSelectedDate(data.date); setSlots(data.slots);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch("/api/slots").then((r) => r.json()).then((d) => {
      if (d.ok) { setToday(d.today); setSelectedDate(d.date); setSlots(d.slots); }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (step !== "datetime" || !selectedDate) return;
    const t = setInterval(() => loadSlots(selectedDate), 15000);
    return () => clearInterval(t);
  }, [step, selectedDate, loadSlots]);

  const dates = useMemo(() => today ? Array.from({ length: 31 }, (_, i) => addDays(today, i)) : [], [today]);
  const brand = brands.find((b) => b.id === brandId);
  const total = useMemo(() => {
    let t = 0;
    const m = mainServices.find((s) => s.id === mainId);
    if (m) t += m.priceCents;
    for (const id of extraIds) { const e = extras.find((s) => s.id === id); if (e) t += e.priceCents; }
    return t;
  }, [mainServices, extras, mainId, extraIds]);
  const holdLeft = held && new Date(held.expiresAt).getTime() > now ? remain(held.expiresAt, now) : null;
  const summary = held && (
    <div style={{ padding: "10px 14px", borderRadius: 10, background: "#14532d44", border: "1px solid #16a34a55", fontSize: 13 }}>
      {fmtDate(held.date)} · {held.time}{selectedCar ? ` · ${selectedCar.brandName} ${selectedCar.modelName}` : ""}{holdLeft ? ` · ${holdLeft}` : ""}
    </div>
  );

  async function loadCars() {
    setCarsLoading(true);
    try {
      const res = await fetch("/api/cars");
      const data = await res.json();
      if (res.status === 401) { setStep("auth"); return; }
      if (!data.ok) throw new Error(data.error);
      setMyCars(data.cars); setStep("car");
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setCarsLoading(false); }
  }

  async function pickSlot(time: string) {
    if (holding) return;
    setHolding(true); setError(null);
    try {
      const data = await (await fetch("/api/slots/hold", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: selectedDate, time, sessionId: sid() }) })).json();
      if (!data.ok) { setError(data.error || "Слот недоступен"); await loadSlots(selectedDate); return; }
      const h = { date: selectedDate, time, expiresAt: data.expiresAt as string };
      setHeld(h); sessionStorage.setItem(HOLD_KEY, JSON.stringify(h));
      await loadSlots(selectedDate);
      const me = await (await fetch("/api/auth/me")).json();
      if (me.ok && me.user) await loadCars();
      else setStep("auth");
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setHolding(false); }
  }

  async function addCar() {
    setAddingCar(true); setBrandId(null); setModelId(null);
    const d = await (await fetch("/api/catalog")).json();
    if (d.ok) setBrands(d.brands);
  }

  async function saveCar() {
    if (!modelId) return;
    setSavingCar(true);
    try {
      const data = await (await fetch("/api/cars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modelId }) })).json();
      if (!data.ok) throw new Error(data.error);
      setAddingCar(false); setMyCars((p) => [data.car, ...p]); setSelectedCar(data.car);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setSavingCar(false); }
  }

  async function toService() {
    if (!selectedCar) return;
    setServicesLoading(true);
    try {
      const d = await (await fetch(`/api/services?categoryId=${selectedCar.category.id}`)).json();
      if (!d.ok) throw new Error(d.error);
      setMainServices(d.main); setExtras(d.extras); setMainId(d.main[0]?.id ?? null); setExtraIds([]); setStep("service");
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setServicesLoading(false); }
  }

  if (confirmed) return <BookSuccess booking={confirmed} />;

  if (step === "datetime") return (
    <main style={page}>
      <H title="Записаться" />
      <section>
        <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 8 }}>Дата</p>
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {dates.map((d) => (
            <button key={d} type="button" onClick={() => { setLoading(true); loadSlots(d); }}
              style={{ flex: "0 0 auto", padding: "10px 14px", borderRadius: 12, border: d === selectedDate ? "2px solid #1d9bf0" : "1px solid #38444d", background: d === selectedDate ? "#1d9bf022" : "#16202a", color: "#e7e9ea", fontSize: 13, whiteSpace: "nowrap" }}>
              {fmtDate(d)}
            </button>
          ))}
        </div>
      </section>
      {error && <p style={{ color: "#fca5a5", fontSize: 14 }}>{error}</p>}
      {held && holdLeft && (
        <div style={{ padding: 14, borderRadius: 12, background: "#14532d44", border: "1px solid #16a34a", fontSize: 14 }}>
          <strong>Слот удержан · {holdLeft}</strong>
          <div style={{ marginTop: 4 }}>{fmtDate(held.date)} · {held.time}</div>
        </div>
      )}
      <section>
        <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 8 }}>{selectedDate ? fmtDate(selectedDate) : "Время"}</p>
        {loading ? <p style={{ opacity: 0.5 }}>Загрузка…</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {slots.map((slot) => {
              const mine = !!held && held.date === selectedDate && held.time === slot.time && (!slot.holdSessionId || slot.holdSessionId === sessionId);
              const ok = slot.status === "free" && !holding;
              const label = mine ? "Выбрано" : slot.status === "held" && slot.holdExpiresAt ? `Бронируют · ${remain(slot.holdExpiresAt, now)}` : LABELS[slot.status];
              return (
                <button key={slot.time} type="button" disabled={!ok && !mine} onClick={() => ok && pickSlot(slot.time)}
                  style={{ ...btn, flexDirection: "column", alignItems: "stretch", gap: 4, border: mine ? "2px solid #16a34a" : "1px solid #38444d", background: mine ? "#14532d33" : ok ? "#16202a" : "#0f1419", color: ok || mine ? "#e7e9ea" : "#9ca3af" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600, fontSize: 16 }}>{slot.time}</span>
                    <span style={{ fontSize: 13, color: mine ? "#4ade80" : COLORS[slot.status] }}>{label}</span>
                  </div>
                  {slot.status === "held" && !mine && <span style={{ fontSize: 11, opacity: 0.65 }}>Кто-то оформляет запись. Если не подтвердит — слот освободится</span>}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );

  if (step === "auth") {
    const next = encodeURIComponent("/book");
    return (
      <main style={page}>
        <H title="Вход" onBack={() => setStep("datetime")} />
        {summary}
        <p style={{ lineHeight: 1.5, opacity: 0.85 }}>Войдите или зарегистрируйтесь. Слот удерживается ещё <strong>{holdLeft || "…"}</strong>.</p>
        <Link href={`/login?next=${next}`} style={{ ...primary, display: "block", textAlign: "center", textDecoration: "none" }}>Войти</Link>
        <Link href={`/register?next=${next}`} style={{ ...primary, display: "block", textAlign: "center", textDecoration: "none", background: "#38444d" }}>Регистрация</Link>
      </main>
    );
  }

  if (step === "car") return (
    <main style={page}>
      <H title="Автомобиль" onBack={() => { setStep("datetime"); setSelectedCar(null); setAddingCar(false); }} />
      {summary}
      {error && <p style={{ color: "#fca5a5" }}>{error}</p>}
      {carsLoading ? <p style={{ opacity: 0.5 }}>Загрузка…</p> : addingCar ? (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 13, opacity: 0.6 }}>Добавить автомобиль</p>
          {!brandId ? brands.map((b) => <button key={b.id} type="button" onClick={() => setBrandId(b.id)} style={btn}>{b.name}</button>) : (
            <>
              <button type="button" onClick={() => { setBrandId(null); setModelId(null); }} style={{ background: "none", border: "none", color: "#1d9bf0", textAlign: "left", padding: 0 }}>← {brand?.name}</button>
              {brand?.models.map((m) => (
                <button key={m.id} type="button" onClick={() => setModelId(m.id)} style={{ ...btn, border: modelId === m.id ? "2px solid #1d9bf0" : "1px solid #38444d" }}>
                  <span>{m.name}</span><span style={{ fontSize: 12, opacity: 0.6 }}>{m.category.nameRu}</span>
                </button>
              ))}
              <button type="button" disabled={!modelId || savingCar} onClick={saveCar} style={primary}>{savingCar ? "…" : "Сохранить и выбрать"}</button>
              <button type="button" onClick={() => setAddingCar(false)} style={{ background: "none", border: "none", color: "#9ca3af" }}>Отмена</button>
            </>
          )}
        </section>
      ) : (
        <>
          <p style={{ fontSize: 13, opacity: 0.6 }}>Мои автомобили</p>
          {myCars.length === 0 ? <p style={{ opacity: 0.6 }}>Нет авто — добавьте</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myCars.map((c) => (
                <button key={c.id} type="button" onClick={() => setSelectedCar(c)} style={{ ...btn, border: selectedCar?.id === c.id ? "2px solid #1d9bf0" : "1px solid #38444d", background: selectedCar?.id === c.id ? "#1d9bf022" : "#16202a" }}>
                  <span><strong>{c.brandName} {c.modelName}</strong><br /><span style={{ fontSize: 12, opacity: 0.65 }}>{c.category.nameRu}</span></span>
                  {selectedCar?.id === c.id && <span style={{ color: "#4ade80", fontSize: 13 }}>Выбрано</span>}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={addCar} style={{ ...primary, background: "#38444d", marginTop: 8 }}>+ Добавить автомобиль</button>
          {selectedCar && <button type="button" onClick={toService} disabled={servicesLoading} style={{ ...primary, marginTop: 8 }}>{servicesLoading ? "…" : "Далее — услуга"}</button>}
        </>
      )}
    </main>
  );

  return (
    <main style={page}>
      <H title="Услуга" onBack={() => setStep("car")} />
      {summary}
      {error && <p style={{ color: "#fca5a5" }}>{error}</p>}
      <section>
        <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 8 }}>Основная услуга</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {mainServices.map((s) => (
            <button key={s.id} type="button" onClick={() => setMainId(s.id)} style={{ ...btn, border: mainId === s.id ? "2px solid #1d9bf0" : "1px solid #38444d", background: mainId === s.id ? "#1d9bf022" : "#16202a" }}>
              <span style={{ fontWeight: 600 }}>{s.nameRu}</span><span style={{ fontWeight: 600 }}>{price(s.priceCents)}</span>
            </button>
          ))}
        </div>
      </section>
      {extras.length > 0 && (
        <section>
          <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 8 }}>Дополнительно</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {extras.map((s) => {
              const on = extraIds.includes(s.id);
              return (
                <button key={s.id} type="button" onClick={() => setExtraIds((p) => on ? p.filter((x) => x !== s.id) : [...p, s.id])} style={{ ...btn, border: on ? "2px solid #16a34a" : "1px solid #38444d", background: on ? "#14532d33" : "#16202a" }}>
                  <span>{on ? "✓ " : ""}{s.nameRu}</span><span>{price(s.priceCents)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <div style={{ marginTop: 8, padding: 16, borderRadius: 12, background: "#16202a", border: "1px solid #38444d" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 18, marginBottom: 12 }}>
          <span>Итого</span><span>{price(total)}</span>
        </div>
        {held && selectedCar && mainId && (
          <BookConfirmButton
            date={held.date}
            time={held.time}
            carId={selectedCar.id}
            sessionId={sessionId}
            mainServiceId={mainId}
            extraServiceIds={extraIds}
            totalCents={total}
            summary=""
            onSuccess={(b) => setConfirmed(b)}
          />
        )}
      </div>
    </main>
  );
}
