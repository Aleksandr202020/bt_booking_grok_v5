import Link from "next/link";

export default function HomePage() {
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
        gap: "16px",
      }}
    >
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>BT Booking v5</h1>
      <p style={{ opacity: 0.7, maxWidth: 360, lineHeight: 1.5 }}>
        Online booking for BT Automazgatava
      </p>
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
      <p style={{ marginTop: 24, fontSize: "0.8rem", opacity: 0.45 }}>
        <a href="/api/health" style={{ textDecoration: "underline" }}>
          /api/health
        </a>
      </p>
    </main>
  );
}
