"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [dbId, setDbId] = useState("");
  const [saved, setSaved] = useState("");
  const router = useRouter();

  useEffect(() => {
    const s = localStorage.getItem("finflow-db");
    if (s) { setSaved(s); setDbId(s); }
  }, []);

  const go = () => {
    const id = dbId.trim().replace(/-/g, "");
    if (!id) return;
    localStorage.setItem("finflow-db", id);
    router.push(`/${id}`);
  };

  return (
    <div style={{
      background: "#0a0e1a", color: "#e2e8f0", height: "100vh",
      fontFamily: "'Inter',system-ui,sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ textAlign: "center", maxWidth: 440, padding: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 32 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#8b5cf6)" }} />
          <span style={{ fontWeight: 700, fontSize: 28, color: "#fff", letterSpacing: "-0.03em" }}>FinFlow</span>
        </div>

        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
          Connectez votre base de données Notion pour commencer le suivi financier.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={dbId}
            onChange={e => setDbId(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") go(); }}
            placeholder="ID de la base Notion (ex: abc123def456...)"
            style={{
              flex: 1, padding: "12px 16px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, color: "#fff", fontSize: 14,
              outline: "none",
            }}
          />
          <button
            onClick={go}
            style={{
              padding: "12px 24px",
              background: "linear-gradient(135deg,#3b82f6,#8b5cf6)",
              border: "none", borderRadius: 10, color: "#fff",
              cursor: "pointer", fontSize: 14, fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            Ouvrir
          </button>
        </div>

        {saved && (
          <button
            onClick={() => router.push(`/${saved}`)}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: "8px 16px",
              color: "#94a3b8", cursor: "pointer", fontSize: 12,
            }}
          >
            Reprendre la dernière session → {saved.slice(0, 8)}...
          </button>
        )}

        <div style={{ marginTop: 40, padding: 20, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", textAlign: "left" }}>
          <p style={{ fontWeight: 600, color: "#94a3b8", fontSize: 12, marginBottom: 12 }}>Configuration Notion requise</p>
          <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.8 }}>
            <p>Votre base Notion doit contenir ces propriétés :</p>
            <ul style={{ paddingLeft: 16, marginTop: 4 }}>
              <li><strong style={{ color: "#94a3b8" }}>Libellé</strong> — Titre (type Title)</li>
              <li><strong style={{ color: "#94a3b8" }}>Montant</strong> — Nombre (type Number)</li>
              <li><strong style={{ color: "#94a3b8" }}>Type</strong> — Sélection : "Recette" ou "Dépense"</li>
              <li><strong style={{ color: "#94a3b8" }}>Catégorie</strong> — Sélection (vos catégories personnalisées)</li>
              <li><strong style={{ color: "#94a3b8" }}>Date</strong> — Date</li>
              <li><strong style={{ color: "#94a3b8" }}>Validé</strong> — Case à cocher</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
