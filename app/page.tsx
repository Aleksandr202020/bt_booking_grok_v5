import Link from "next/link";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "./components/LogoutButton";

export default async function HomePage() {
  const user = await getSession();

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        textAlign: "center",
        gap: "12px",
      }}
    >
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>BT Booking v5</h1>
      <p style={{ opacity: 0.7, maxWidth: 360, lineHeight: 1.5 }}>
        Онлайн-запись на мойку BT Automazgatava
      </p>

      {user ? <p style={{ fontSize: 14, opacity: 0.8 }}>Привет, {user.name}</p> : null}

      <Link
        href="/book"
        style={{
          marginTop: 8,
          padding: "14px 28px",
          borderRadius: 999,
          background: "#1d9bf0",
          color: "#fff",
          fontSize: "1rem",
          fontWeight: 600,
        }}
      >
        Записаться
      </Link>

      <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {user ? (
          <>
            <Link href="/cars" style={{ fontSize: 14, color: "#1d9bf0" }}>Мои автомобили</Link>
            <Link href="/bookings" style={{ fontSize: 14, color: "#1d9bf0" }}>Мои записи</Link>
            <LogoutButton />
          </>
        ) : (
          <>
            <Link href="/login" style={{ fontSize: 14, color: "#1d9bf0" }}>Вход</Link>
            <Link href="/register" style={{ fontSize: 14, color: "#1d9bf0" }}>Регистрация</Link>
          </>
        )}
      </div>
    </main>
  );
}
