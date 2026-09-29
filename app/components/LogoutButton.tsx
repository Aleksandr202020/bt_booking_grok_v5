"use client";

export function LogoutButton() {
  return (
    <button
      type="button"
      style={{
        fontSize: 14,
        color: "#1d9bf0",
        background: "none",
        border: "none",
        cursor: "pointer",
      }}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/";
      }}
    >
      Выйти
    </button>
  );
}
