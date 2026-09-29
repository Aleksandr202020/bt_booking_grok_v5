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
        Online booking system for BT Automazgātava.
        <br />
        Next.js + Prisma + Neon + Vercel
      </p>
      <p
        style={{
          marginTop: 8,
          padding: "8px 16px",
          borderRadius: 999,
          background: "#1d9bf0",
          color: "#fff",
          fontSize: "0.875rem",
          fontWeight: 600,
        }}
      >
        Setup OK — ready to build
      </p>
    </main>
  );
}
