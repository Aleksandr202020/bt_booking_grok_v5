"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Ошибка входа");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={page}>
      <Link href="/" style={{ opacity: 0.6, fontSize: 14 }}>
        ← Назад
      </Link>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Вход</h1>

      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Телефон" value={phone} onChange={setPhone} placeholder="+371 ..." type="tel" />
        <Field label="Пароль" value={password} onChange={setPassword} type="password" />

        {error && (
          <p style={{ color: "#fca5a5", fontSize: 14 }}>{error}</p>
        )}

        <button type="submit" disabled={loading} style={primaryBtn}>
          {loading ? "..." : "Войти"}
        </button>
      </form>

      <p style={{ fontSize: 14, opacity: 0.7 }}>
        Нет аккаунта?{" "}
        <Link href={`/register?next=${encodeURIComponent(next)}`} style={{ color: "#1d9bf0" }}>
          Регистрация
        </Link>
      </p>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, opacity: 0.6 }}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        required
        style={input}
      />
    </label>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  maxWidth: 400,
  margin: "0 auto",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const input: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #38444d",
  background: "#16202a",
  color: "#e7e9ea",
  fontSize: 16,
};

const primaryBtn: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: "none",
  background: "#1d9bf0",
  color: "#fff",
  fontWeight: 600,
  fontSize: 16,
};
