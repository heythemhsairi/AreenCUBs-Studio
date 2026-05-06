"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root]", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#FFF8F0",
        color: "#1E1E24",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: "100%",
          background: "white",
          border: "1px solid rgba(30,30,36,0.1)",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 8px 28px rgba(30,30,36,0.06)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
          Une erreur est survenue
        </h1>
        <p style={{ marginTop: 8, fontSize: 13, color: "rgba(30,30,36,0.65)" }}>
          La page n&apos;a pas pu se charger. Détails :
        </p>
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            background: "rgba(30,30,36,0.05)",
            color: "rgba(30,30,36,0.85)",
            fontSize: 12,
            borderRadius: 8,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowX: "auto",
          }}
        >
          {error.message || "Erreur inconnue"}
          {error.digest ? `\n\nDigest: ${error.digest}` : ""}
          {"\n\n"}
          {error.stack ?? ""}
        </pre>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            onClick={reset}
            style={{
              height: 36,
              padding: "0 16px",
              background: "#3B8BBA",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
          <a
            href="/"
            style={{
              height: 36,
              padding: "0 16px",
              display: "inline-flex",
              alignItems: "center",
              border: "1px solid rgba(30,30,36,0.15)",
              borderRadius: 8,
              color: "#1E1E24",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Accueil
          </a>
        </div>
      </div>
    </main>
  );
}
