"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Car = {
  id: string;
  plate: string | null;
  brandName: string;
  modelName: string;
  category: { nameRu: string };
};

type Brand = {
  id: string;
  name: string;
  models: { id: string; name: string; category: { nameRu: string } }[];
};

export default function MyCarsPage() {
  const router = useRouter();
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cars");
      const data = await res.json();
      if (res.status === 401) {
        router.push("/login?next=/cars");
        return;
      }
      if (!data.ok) throw new Error(data.error);
      setCars(data.cars);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function startAdd() {
    setAdding(true);
    setBrandId(null);
    setModelId(null);
    const res = await fetch("/api/catalog");
    const data = await res.json();
    if (data.ok) setBrands(data.brands);
  }

  async function saveCar() {
    if (!modelId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setAdding(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function removeCar(id: string) {
    if (!confirm("Удалить автомобиль?")) return;
    await fetch(`/api/cars/${id}`, { method: "DELETE" });
    await load();
  }

  const brand = brands.find((b) => b.id === brandId);

  return (
    <main style={page}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/" style={{ opacity: 0.6, fontSize: 14 }}>
          ← Назад
        </Link>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, flex: 1 }}>
          Мои автомобили
        </h1>
      </header>

      {error && <p style={{ color: "#fca5a5", fontSize: 14 }}>{error}</p>}

      {loading ? (
        <p style={{ opacity: 0.5 }}>Загрузка…</p>
      ) : cars.length === 0 && !adding ? (
        <p style={{ opacity: 0.6 }}>Пока нет сохранённых автомобилей</p>
      ) : (
        !adding &&
        cars.map((c) => (
          <div key={c.id} style={card}>
            <div>
              <div style={{ fontWeight: 600 }}>
                {c.brandName} {c.modelName}
              </div>
              <div style={{ fontSize: 13, opacity: 0.6 }}>{c.category.nameRu}</div>
            </div>
            <button
              type="button"
              onClick={() => removeCar(c.id)}
              style={{
                background: "none",
                border: "none",
                color: "#f87171",
                fontSize: 13,
              }}
            >
              Удалить
            </button>
          </div>
        ))
      )}

      {adding ? (
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, opacity: 0.6 }}>Марка</p>
          {!brandId ? (
            brands.map((b) => (
              <button key={b.id} type="button" onClick={() => setBrandId(b.id)} style={btn}>
                {b.name}
              </button>
            ))
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setBrandId(null);
                  setModelId(null);
                }}
                style={{ background: "none", border: "none", color: "#1d9bf0", textAlign: "left" }}
              >
                ← {brand?.name}
              </button>
              <p style={{ fontSize: 13, opacity: 0.6 }}>Модель</p>
              {brand?.models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModelId(m.id)}
                  style={{
                    ...btn,
                    border: modelId === m.id ? "2px solid #1d9bf0" : "1px solid #38444d",
                  }}
                >
                  <span>{m.name}</span>
                  <span style={{ fontSize: 12, opacity: 0.6 }}>{m.category.nameRu}</span>
                </button>
              ))}
              <button
                type="button"
                disabled={!modelId || saving}
                onClick={saveCar}
                style={primaryBtn}
              >
                {saving ? "..." : "Сохранить"}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                style={{ background: "none", border: "none", color: "#9ca3af" }}
              >
                Отмена
              </button>
            </>
          )}
        </section>
      ) : (
        <button type="button" onClick={startAdd} style={primaryBtn}>
          + Добавить автомобиль
        </button>
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
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 14,
  borderRadius: 12,
  border: "1px solid #38444d",
  background: "#16202a",
};

const btn: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #38444d",
  background: "#16202a",
  color: "#e7e9ea",
  textAlign: "left",
};

const primaryBtn: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: "none",
  background: "#1d9bf0",
  color: "#fff",
  fontWeight: 600,
  fontSize: 16,
  marginTop: 8,
};
