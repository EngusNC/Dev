"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────
const MONTHS_FULL = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_L = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const DEFAULT_CATS = ["Autre"];

const fmtF = (n: number) => n.toLocaleString("fr-FR",{minimumFractionDigits:0,maximumFractionDigits:0});
const fmt = (n: number) => {const a=Math.abs(n);if(a>=1000)return(n<0?"-":"")+(a/1000).toFixed(a%1000===0?0:1)+"k";return n.toLocaleString("fr-FR");};
function dim(y: number, m: number){return new Date(y,m+1,0).getDate();}
function dow(y: number, m: number, d: number){return(new Date(y,m,d).getDay()+6)%7;}
function pad2(n: number){return n.toString().padStart(2,"0");}
function toDateStr(y: number, m: number, d: number){return `${y}-${pad2(m+1)}-${pad2(d)}`;}

const G="#34d399",R="#f87171",B="#3b82f6";

// ─── Themes ──────────────────────────────────────────────────
const themes={
  dark:{
    bg:"#0a0e1a",headerBg:"rgba(10,14,26,0.97)",colHdrBg:"rgba(255,255,255,0.03)",
    border:"rgba(255,255,255,0.05)",borderS:"rgba(255,255,255,0.08)",
    text:"#e2e8f0",dim:"#64748b",muted:"#4b5563",white:"#fff",
    weBg:"rgba(255,255,255,0.015)",weText:"#6366f1",
    dropBg:"rgba(59,130,246,0.12)",
    cardIncBg:"rgba(52,211,153,0.08)",cardExpBg:"rgba(248,113,113,0.08)",
    cardIncBgDone:"rgba(52,211,153,0.18)",cardExpBgDone:"rgba(248,113,113,0.18)",
    modalBg:"#111827",overlay:"rgba(0,0,0,0.6)",
    inputBg:"rgba(255,255,255,0.05)",inputBd:"rgba(255,255,255,0.08)",
    togBg:"rgba(255,255,255,0.05)",togAct:"rgba(255,255,255,0.12)",
    secBg:"rgba(255,255,255,0.06)",secCol:"#94a3b8",optBg:"#1e293b",
    surface:"rgba(255,255,255,0.02)",
    errBg:"rgba(248,113,113,0.1)",errText:"#fca5a5",
    loadBg:"rgba(59,130,246,0.08)",loadText:"#93c5fd",
  },
  light:{
    bg:"#f1f3f5",headerBg:"rgba(241,243,245,0.97)",colHdrBg:"#f8f9fa",
    border:"#e9ecef",borderS:"#dee2e6",
    text:"#343a40",dim:"#868e96",muted:"#adb5bd",white:"#212529",
    weBg:"#f8f9fa",weText:"#7c3aed",
    dropBg:"rgba(59,130,246,0.08)",
    cardIncBg:"rgba(52,211,153,0.1)",cardExpBg:"rgba(248,113,113,0.1)",
    cardIncBgDone:"rgba(52,211,153,0.22)",cardExpBgDone:"rgba(248,113,113,0.22)",
    modalBg:"#ffffff",overlay:"rgba(0,0,0,0.25)",
    inputBg:"#f8f9fa",inputBd:"#dee2e6",
    togBg:"#e9ecef",togAct:"#dee2e6",
    secBg:"#e9ecef",secCol:"#495057",optBg:"#fff",
    surface:"#ffffff",
    errBg:"rgba(248,113,113,0.08)",errText:"#dc2626",
    loadBg:"rgba(59,130,246,0.06)",loadText:"#2563eb",
  }
};

// ─── API helpers ─────────────────────────────────────────────
const api = {
  async getCards(dbId: string, year: number) {
    const r = await fetch(`/api/cards?db=${dbId}&year=${year}`);
    if (!r.ok) throw new Error((await r.json()).error || "Erreur API");
    return r.json();
  },
  async createCard(dbId: string, data: any) {
    const r = await fetch(`/api/cards?db=${dbId}`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(data) });
    if (!r.ok) throw new Error((await r.json()).error || "Erreur API");
    return r.json();
  },
  async updateCard(id: string, data: any) {
    const r = await fetch(`/api/cards/${id}`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify(data) });
    if (!r.ok) throw new Error((await r.json()).error || "Erreur API");
    return r.json();
  },
  async deleteCard(id: string) {
    const r = await fetch(`/api/cards/${id}`, { method: "DELETE" });
    if (!r.ok) throw new Error((await r.json()).error || "Erreur API");
  },
  async getCategories(dbId: string) {
    const r = await fetch(`/api/categories?db=${dbId}`);
    if (!r.ok) throw new Error((await r.json()).error || "Erreur API");
    return r.json();
  },
  async getBalanceBefore(dbId: string, year: number) {
    const r = await fetch(`/api/balance?db=${dbId}&year=${year}`);
    if (!r.ok) throw new Error((await r.json()).error || "Erreur API");
    return r.json();
  },
};

// ─── Types ───────────────────────────────────────────────────
interface Card {
  id: string;
  label: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  done: boolean;
  year: number;
  month: number;
  day: number;
}

interface FinFlowProps {
  dbId: string;
}

// ─── Component ───────────────────────────────────────────────
export default function FinFlow({ dbId }: FinFlowProps) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [startBalance, setStartBalance] = useState(0);
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATS);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<any>(null);
  const [dragCard, setDragCard] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [editBal, setEditBal] = useState(false);
  const [balIn, setBalIn] = useState("");
  const [form, setForm] = useState({type:"expense" as "income"|"expense",label:"",amount:"",category:"Autre",date:""});
  const [dark, setDark] = useState(true);
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({label:"",amount:""});
  const [compact, setCompact] = useState(false);
  const [carryOver, setCarryOver] = useState({ realized: 0, projected: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = dark ? themes.dark : themes.light;

  // ─── Load data ──────────────────────────────────────────────
  const loadData = useCallback(async (yr?: number) => {
    const targetYear = yr ?? year;
    try {
      setError(null);
      setSyncing(true);
      const [fetchedCards, cats, carry] = await Promise.all([
        api.getCards(dbId, targetYear),
        api.getCategories(dbId),
        api.getBalanceBefore(dbId, targetYear),
      ]);
      setCards(fetchedCards);
      setCarryOver(carry);
      if (cats.length > 0) setCategories(cats);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [dbId, year]);

  useEffect(() => { loadData(); }, [dbId]);
  useEffect(() => { if (!loading) loadData(year); }, [year]);

  // Auto-refresh every 30s (sync with Notion edits from others)
  useEffect(() => {
    const interval = setInterval(() => loadData(), 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Scroll to current month on first load
  useEffect(() => {
    if (!loading && scrollRef.current && year === new Date().getFullYear()) {
      const c = scrollRef.current.querySelector(`[data-month="${new Date().getMonth()}"]`);
      if (c) c.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    }
  }, [loading]);

  // Persist preferences in localStorage
  useEffect(() => {
    const saved = localStorage.getItem("finflow-dark");
    if (saved !== null) setDark(saved === "true");
    const savedCompact = localStorage.getItem("finflow-compact");
    if (savedCompact !== null) setCompact(savedCompact === "true");
  }, []);
  useEffect(() => { localStorage.setItem("finflow-dark", String(dark)); }, [dark]);
  useEffect(() => { localStorage.setItem("finflow-compact", String(compact)); }, [compact]);

  // ─── CRUD with optimistic updates ──────────────────────────
  const addCard = async (data: { month: number; day: number; type: "income"|"expense"; label: string; amount: number; category: string }) => {
    const dateStr = toDateStr(year, data.month, data.day);
    const tempId = "temp-" + Date.now();
    const optimistic: Card = { id: tempId, ...data, date: dateStr, done: false, year, month: data.month, day: data.day };
    setCards(prev => [...prev, optimistic]);
    try {
      const created = await api.createCard(dbId, { label: data.label, amount: data.amount, type: data.type, category: data.category, date: dateStr });
      setCards(prev => prev.map(c => c.id === tempId ? created : c));
    } catch (e: any) {
      setCards(prev => prev.filter(c => c.id !== tempId));
      setError(e.message);
    }
  };

  const updateCardData = async (id: string, data: Partial<Card>) => {
    let localUpdate = { ...data };
    if (data.date) {
      const [y, m, d] = data.date.split("-").map(Number);
      localUpdate = { ...localUpdate, year: y, month: m - 1, day: d };
    }
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...localUpdate } : c));
    try {
      await api.updateCard(id, data);
    } catch (e: any) {
      loadData(); // revert to server state
      setError(e.message);
    }
  };

  const removeCard = async (id: string) => {
    const backup = cards.find(c => c.id === id);
    setCards(prev => prev.filter(c => c.id !== id));
    try {
      await api.deleteCard(id);
    } catch (e: any) {
      if (backup) setCards(prev => [...prev, backup]);
      setError(e.message);
    }
  };

  const moveCardTo = async (id: string, newMonth: number, newDay: number) => {
    const dateStr = toDateStr(year, newMonth, newDay);
    setCards(prev => prev.map(c => c.id === id ? { ...c, month: newMonth, day: newDay, date: dateStr } : c));
    try {
      await api.updateCard(id, { date: dateStr });
    } catch (e: any) {
      loadData();
      setError(e.message);
    }
  };

  const toggleDone = async (id: string) => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    updateCardData(id, { done: !card.done });
  };

  // ─── Compute balances ──────────────────────────────────────
  let runReal = startBalance + carryOver.realized, runProj = startBalance + carryOver.projected;
  const md = Array.from({ length: 12 }, (_, m) => {
    const mc = cards.filter(c => c.year === year && c.month === m);
    const realInc = mc.filter(c => c.type === "income" && c.done).reduce((s, c) => s + c.amount, 0);
    const realExp = mc.filter(c => c.type === "expense" && c.done).reduce((s, c) => s + c.amount, 0);
    const allInc = mc.filter(c => c.type === "income").reduce((s, c) => s + c.amount, 0);
    const allExp = mc.filter(c => c.type === "expense").reduce((s, c) => s + c.amount, 0);
    runReal += realInc - realExp;
    runProj += allInc - allExp;
    return { realBal: runReal, projBal: runProj, income: allInc, expense: allExp };
  });
  const lastReal = md[11].realBal, lastProj = md[11].projBal;

  // ─── Drag & Drop ───────────────────────────────────────────
  const onDS = (e: React.DragEvent, id: string) => { setDragCard(id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text", id); };
  const onDO = (e: React.DragEvent, m: number, d: number) => { e.preventDefault(); setDropTarget(`${m}-${d}`); };
  const onDL = () => setDropTarget(null);
  const onDr = (e: React.DragEvent, m: number, d: number) => { e.preventDefault(); if (dragCard) moveCardTo(dragCard, m, d); setDragCard(null); setDropTarget(null); };

  // ─── Modals ─────────────────────────────────────────────────
  const openAdd = (m: number, d: number) => { setForm({ type: "expense", label: "", amount: "", category: categories[0] || "Autre", date: toDateStr(year, m, d) }); setModal({ mode: "add", month: m, day: d }); };
  const openEdit = (card: Card) => { setForm({ type: card.type, label: card.label, amount: card.amount.toString(), category: card.category || "Autre", date: card.date }); setModal({ mode: "edit", card }); };
  const openDay = (m: number, d: number) => setModal({ mode: "day", month: m, day: d });

  const saveForm = () => {
    const amt = parseFloat(form.amount); if (!form.label || isNaN(amt) || amt <= 0) return;
    if (modal.mode === "add") {
      const [, mm, dd] = form.date.split("-").map(Number);
      addCard({ month: mm - 1, day: dd, type: form.type, label: form.label, amount: amt, category: form.category });
    } else if (modal.mode === "edit") {
      const updates: Partial<Card> = { type: form.type, label: form.label, amount: amt, category: form.category };
      if (form.date && form.date !== modal.card.date) updates.date = form.date;
      updateCardData(modal.card.id, updates);
    }
    setModal(null);
  };

  // ─── Inline edit ────────────────────────────────────────────
  const startInlineEdit = (e: React.MouseEvent, c: Card) => { e.preventDefault(); e.stopPropagation(); setEditingCard(c.id); setEditForm({ label: c.label, amount: c.amount.toString() }); };
  const saveInlineEdit = (id: string) => {
    const amt = parseFloat(editForm.amount);
    if (editForm.label && !isNaN(amt) && amt > 0) updateCardData(id, { label: editForm.label, amount: amt });
    setEditingCard(null);
  };

  // ─── Hover popout ───────────────────────────────────────────
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [popPos, setPopPos] = useState<any>(null);
  const hoverTimeout = useRef<any>(null);
  const onCellEnter = (e: React.MouseEvent, mi: number, d: number, dc: Card[]) => { if (dc.length <= 1) return; clearTimeout(hoverTimeout.current); const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); hoverTimeout.current = setTimeout(() => { setHoveredCell(`${mi}-${d}`); setPopPos({ left: rect.left, top: rect.top, width: rect.width }); }, 180); };
  const onCellLeave = () => { clearTimeout(hoverTimeout.current); setHoveredCell(null); setPopPos(null); };

  const COL_W = 220, ROW_H = 54;

  // ─── Loading state ──────────────────────────────────────────
  if (loading) return (
    <div style={{ background: t.bg, color: t.white, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',system-ui,sans-serif", flexDirection: "column", gap: 12 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", animation: "pulse 1s infinite" }} />
      <span style={{ opacity: 0.4, fontSize: 13 }}>Connexion à Notion...</span>
      <style>{`@keyframes pulse{0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:1;transform:scale(1.5)}}`}</style>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div style={{ background: t.bg, color: t.text, height: "100vh", fontFamily: "'Inter',system-ui,sans-serif", fontSize: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${t.border}`, background: t.headerBg, flexShrink: 0, zIndex: 50, backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#8b5cf6)" }} />
              <span style={{ fontWeight: 700, fontSize: 15, color: t.white, letterSpacing: "-0.02em" }}>FinFlow</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 2, background: t.togBg, borderRadius: 8, padding: "3px" }}>
              <button onClick={() => setYear(year - 1)} style={{ background: "none", border: "none", color: t.dim, cursor: "pointer", padding: "2px 8px", fontSize: 14 }}>‹</button>
              <span style={{ fontWeight: 600, fontSize: 14, color: t.white, minWidth: 42, textAlign: "center" }}>{year}</span>
              <button onClick={() => setYear(year + 1)} style={{ background: "none", border: "none", color: t.dim, cursor: "pointer", padding: "2px 8px", fontSize: 14 }}>›</button>
            </div>
            {syncing && <span style={{ fontSize: 10, color: t.dim, padding: "2px 8px", background: t.loadBg, borderRadius: 4 }}>Sync...</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: t.dim, fontSize: 11 }}>Solde initial</span>
              {editBal ? (
                <input autoFocus value={balIn} onChange={e => setBalIn(e.target.value)}
                  onBlur={() => { setStartBalance(parseFloat(balIn) || 0); setEditBal(false); }}
                  onKeyDown={e => { if (e.key === "Enter") { setStartBalance(parseFloat(balIn) || 0); setEditBal(false); } }}
                  style={{ background: t.inputBg, border: "1px solid rgba(59,130,246,0.5)", borderRadius: 6, color: t.white, padding: "3px 8px", width: 90, fontSize: 12, outline: "none" }} />
              ) : (
                <button onClick={() => { setBalIn(startBalance.toString()); setEditBal(true); }}
                  style={{ background: t.togBg, border: `1px solid ${t.borderS}`, borderRadius: 6, color: t.white, padding: "3px 8px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  {fmtF(startBalance)} €
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
              <span style={{ color: t.dim }}>Réalisé <span style={{ color: lastReal >= 0 ? G : R, fontWeight: 700 }}>{lastReal >= 0 ? "+" : ""}{fmtF(lastReal)} €</span></span>
              <span style={{ color: t.dim }}>Projeté <span style={{ color: lastProj >= 0 ? G : R, fontWeight: 700 }}>{lastProj >= 0 ? "+" : ""}{fmtF(lastProj)} €</span></span>
            </div>
            <button onClick={() => setCompact(!compact)} title={compact ? "Vue détaillée" : "Vue synthétique"} style={{ background: compact ? t.togAct : t.togBg, border: `1px solid ${t.border}`, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: compact ? t.white : t.dim, lineHeight: 1, fontWeight: compact ? 600 : 400 }}>
              {compact ? "≡ Mois" : "≡ Jours"}
            </button>
            <button onClick={() => loadData()} title="Rafraîchir depuis Notion" style={{ background: t.togBg, border: `1px solid ${t.border}`, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12, color: t.dim, lineHeight: 1 }}>
              ↻
            </button>
            <button onClick={() => setDark(!dark)} style={{ background: t.togBg, border: `1px solid ${t.border}`, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 13, color: t.dim, lineHeight: 1 }}>
              {dark ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
        {/* Error banner */}
        {error && (
          <div style={{ marginTop: 8, padding: "6px 12px", background: t.errBg, borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: t.errText }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: t.errText, cursor: "pointer", fontSize: 14, padding: "0 4px" }}>×</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div ref={scrollRef} style={{ display: "flex", minWidth: "fit-content" }}>
          {MONTHS_FULL.map((mName, mi) => {
            const days = dim(year, mi); const m = md[mi];
            return (
              <div key={mi} data-month={mi} style={{ width: COL_W, minWidth: COL_W, borderRight: `1px solid ${t.border}`, flexShrink: 0 }}>
                {/* Sticky month header */}
                <div style={{ position: "sticky", top: 0, zIndex: 10, padding: "7px 10px", borderBottom: `1px solid ${t.border}`, background: t.colHdrBg, backdropFilter: "blur(8px)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: t.white }}>{mName}</span>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: m.realBal >= 0 ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)", color: m.realBal >= 0 ? G : R }}>
                        {m.realBal >= 0 ? "+" : ""}{fmt(m.realBal)} €
                      </span>
                      {m.projBal !== m.realBal && (
                        <span style={{ fontSize: 9, color: t.dim, fontStyle: "italic" }}>
                          proj. {m.projBal >= 0 ? "+" : ""}{fmt(m.projBal)} €
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Day rows / Compact view */}
                {compact ? (
                  <div style={{ flex: 1, overflow: "auto", padding: "4px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
                    {(() => {
                      const mc = cards.filter(c => c.year === year && c.month === mi).sort((a, b) => a.day - b.day);
                      const incTotal = mc.filter(c => c.type === "income").reduce((s, c) => s + c.amount, 0);
                      const expTotal = mc.filter(c => c.type === "expense").reduce((s, c) => s + c.amount, 0);
                      return (
                        <>
                          {mc.length === 0 && (
                            <div style={{ textAlign: "center", padding: "20px 0", color: t.dim, fontSize: 11 }}>Aucune opération</div>
                          )}
                          {mc.map(c => {
                            const isDone = c.done;
                            return (
                              <div key={c.id} draggable
                                onDragStart={e => { e.stopPropagation(); onDS(e, c.id); }}
                                onClick={e => { e.stopPropagation(); openEdit(c); }}
                                style={{
                                  display: "flex", alignItems: "center", gap: 4,
                                  padding: "5px 6px", borderRadius: 6, cursor: "pointer", flexShrink: 0,
                                  background: c.type === "income" ? (isDone ? t.cardIncBgDone : t.cardIncBg) : (isDone ? t.cardExpBgDone : t.cardExpBg),
                                  borderLeft: `3px solid ${c.type === "income" ? G : R}`,
                                  opacity: isDone ? 1 : 0.7,
                                }}>
                                <span style={{ fontSize: 9, color: t.dim, minWidth: 16, textAlign: "right", fontWeight: 500 }}>{c.day}</span>
                                <button onClick={e => { e.stopPropagation(); toggleDone(c.id); }}
                                  style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${c.type === "income" ? G : R}`, background: isDone ? (c.type === "income" ? G : R) : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0, fontSize: 8, color: "#fff", lineHeight: 1 }}>
                                  {isDone && "✓"}
                                </button>
                                <span style={{ fontSize: 11, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{c.label}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: c.type === "income" ? G : R, flexShrink: 0 }}>
                                  {c.type === "income" ? "+" : "-"}{fmt(c.amount)}
                                </span>
                              </div>
                            );
                          })}
                          {/* Month summary */}
                          <div style={{ marginTop: "auto", padding: "6px 4px 2px", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                            <span style={{ color: G }}>+{fmt(incTotal)}</span>
                            <span style={{ color: R }}>-{fmt(expTotal)}</span>
                          </div>
                          {/* Add button */}
                          <button onClick={() => openAdd(mi, 1)} style={{ width: "100%", padding: "5px 0", background: t.togBg, border: `1px dashed ${t.border}`, borderRadius: 6, color: t.dim, cursor: "pointer", fontSize: 11, marginTop: 2 }}>
                            + Ajouter
                          </button>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  Array.from({ length: 31 }, (_, i) => {
                    const d = i + 1;
                    if (d > days) return <div key={d} style={{ height: ROW_H, borderBottom: `1px solid ${t.border}`, opacity: 0.1, background: t.surface }} />;
                    const dw = dow(year, mi, d); const isWe = dw >= 5;
                    const dc = cards.filter(c => c.year === year && c.month === mi && c.day === d);
                    const isDrop = dropTarget === `${mi}-${d}`;
                    const visibleMax = 2; const hidden = dc.length - visibleMax;
                    const isHovered = hoveredCell === `${mi}-${d}`;
                    const showAll = isHovered && dc.length > 1;
                    const displayCards = showAll ? dc : dc.slice(0, visibleMax);

                    return (
                      <div key={d} onClick={() => openDay(mi, d)}
                        onDragOver={e => onDO(e, mi, d)} onDragLeave={onDL} onDrop={e => onDr(e, mi, d)}
                        onMouseEnter={(e) => onCellEnter(e, mi, d, dc)} onMouseLeave={onCellLeave}
                        style={{
                          height: ROW_H, padding: "3px 6px", borderBottom: `1px solid ${t.border}`,
                          cursor: "pointer", boxSizing: "border-box", position: "relative",
                          background: isDrop ? t.dropBg : isWe ? t.weBg : "transparent",
                          display: "flex", flexDirection: "column", overflow: "hidden",
                        }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, marginBottom: 1 }}>
                          <span style={{ fontSize: 9, color: isWe ? t.weText : t.muted, fontWeight: 500, minWidth: 20 }}>{DAYS_L[dw]}</span>
                          <span style={{ fontSize: 11, fontWeight: dc.length > 0 ? 600 : 400, color: dc.length > 0 ? t.white : t.muted }}>{d}</span>
                          {hidden > 0 && !showAll && <span style={{ fontSize: 8, color: t.dim, marginLeft: "auto", background: t.togBg, borderRadius: 3, padding: "0 3px" }}>+{hidden}</span>}
                        </div>
                        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 1 }}>
                          {displayCards.slice(0, visibleMax).map(c => {
                            const isDone = c.done;
                            const isEditing = editingCard === c.id;

                            if (isEditing) return (
                              <div key={c.id} onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 2, alignItems: "center", padding: "1px 3px", borderRadius: 4, background: c.type === "income" ? (isDone ? t.cardIncBgDone : t.cardIncBg) : (isDone ? t.cardExpBgDone : t.cardExpBg), borderLeft: `2px solid ${c.type === "income" ? G : R}` }}>
                                <input autoFocus value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                                  onKeyDown={e => { if (e.key === "Enter") saveInlineEdit(c.id); if (e.key === "Escape") setEditingCard(null); }}
                                  style={{ flex: 1, fontSize: 10, padding: "1px 3px", background: "transparent", border: "none", color: t.white, outline: "none", minWidth: 0 }} />
                                <input value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                                  onKeyDown={e => { if (e.key === "Enter") saveInlineEdit(c.id); if (e.key === "Escape") setEditingCard(null); }}
                                  style={{ width: 45, fontSize: 10, padding: "1px 3px", background: "transparent", border: "none", color: c.type === "income" ? G : R, outline: "none", textAlign: "right", fontWeight: 700 }} />
                              </div>
                            );

                            return (
                              <div key={c.id} draggable
                                onDragStart={e => { e.stopPropagation(); onDS(e, c.id); }}
                                onClick={e => e.stopPropagation()}
                                onDoubleClick={e => startInlineEdit(e, c)}
                                style={{
                                  display: "flex", alignItems: "center", gap: 3,
                                  padding: "2px 4px", borderRadius: 4, cursor: "grab", flexShrink: 0,
                                  background: c.type === "income" ? (isDone ? t.cardIncBgDone : t.cardIncBg) : (isDone ? t.cardExpBgDone : t.cardExpBg),
                                  borderLeft: `2px solid ${c.type === "income" ? G : R}`,
                                  opacity: isDone ? 1 : 0.7,
                                }}>
                                <button onClick={e => { e.stopPropagation(); toggleDone(c.id); }}
                                  style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${c.type === "income" ? G : R}`, background: isDone ? (c.type === "income" ? G : R) : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0, fontSize: 8, color: "#fff", lineHeight: 1 }}>
                                  {isDone && "✓"}
                                </button>
                                <span style={{ fontSize: 10, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{c.label}</span>
                                <span style={{ fontSize: 9, fontWeight: 700, color: c.type === "income" ? G : R, flexShrink: 0 }}>
                                  {c.type === "income" ? "+" : "-"}{fmt(c.amount)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: t.overlay, backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.modalBg, border: `1px solid ${t.borderS}`, borderRadius: 14, width: 420, maxHeight: "80vh", overflow: "auto", boxShadow: "0 25px 50px rgba(0,0,0,0.3)" }}>
            {modal.mode === "day" ? (
              <>
                <div style={{ padding: "14px 18px 10px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, color: t.white, fontSize: 14 }}>{modal.day} {MONTHS_FULL[modal.month]} {year}</span>
                  <button onClick={() => openAdd(modal.month, modal.day)} style={{ background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>+ Ajouter</button>
                </div>
                <div style={{ padding: "8px 12px 14px" }}>
                  {cards.filter(c => c.year === year && c.month === modal.month && c.day === modal.day).length === 0 ? (
                    <div style={{ textAlign: "center", padding: 24, color: t.dim, fontSize: 12 }}>Aucune opération</div>
                  ) : (
                    cards.filter(c => c.year === year && c.month === modal.month && c.day === modal.day).map(c => (
                      <div key={c.id} draggable onDragStart={e => { onDS(e, c.id); setModal(null); }}
                        onDoubleClick={e => { e.stopPropagation(); openEdit(c); }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", marginBottom: 4,
                          background: c.done ? (c.type === "income" ? t.cardIncBgDone : t.cardExpBgDone) : t.surface,
                          borderRadius: 8, borderLeft: `3px solid ${c.type === "income" ? G : R}`, cursor: "grab",
                          border: `1px solid ${t.border}`, opacity: c.done ? 1 : 0.7,
                        }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                          <button onClick={e => { e.stopPropagation(); toggleDone(c.id); }}
                            style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${c.type === "income" ? G : R}`, background: c.done ? (c.type === "income" ? G : R) : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0, fontSize: 10, color: "#fff" }}>
                            {c.done && "✓"}
                          </button>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: t.white, fontSize: 12 }}>{c.label}</div>
                            <div style={{ fontSize: 10, color: t.dim, marginTop: 1, display: "flex", gap: 6, alignItems: "center" }}>
                              <span>{c.category}</span>
                              <span style={{ fontSize: 9, padding: "0 4px", borderRadius: 3, background: c.done ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.06)", color: c.done ? G : t.dim }}>
                                {c.done ? (c.type === "income" ? "Reçu" : "Payée") : "Prévu"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 700, color: c.type === "income" ? G : R, fontSize: 13 }}>
                            {c.type === "income" ? "+" : "-"}{fmtF(c.amount)} €
                          </span>
                          <button onClick={e => { e.stopPropagation(); openEdit(c); }} style={{ background: t.togBg, border: "none", color: t.dim, borderRadius: 6, padding: "4px 7px", cursor: "pointer", fontSize: 10 }}>✎</button>
                          <button onClick={e => { e.stopPropagation(); removeCard(c.id); }} style={{ background: "rgba(248,113,113,0.1)", border: "none", color: R, borderRadius: 6, padding: "4px 7px", cursor: "pointer", fontSize: 10 }}>✕</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: "14px 18px 10px", borderBottom: `1px solid ${t.border}` }}>
                  <span style={{ fontWeight: 700, color: t.white, fontSize: 14 }}>{modal.mode === "add" ? "Nouvelle opération" : "Modifier"}</span>
                  {modal.mode === "add" && <span style={{ color: t.dim, fontSize: 11, marginLeft: 8 }}>{modal.day} {MONTHS_FULL[modal.month]}</span>}
                </div>
                <div style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 12, background: t.togBg, borderRadius: 8, padding: 3 }}>
                    {([{ k: "expense" as const, l: "Dépense", c: R }, { k: "income" as const, l: "Recette", c: G }]).map(tp => (
                      <button key={tp.k} onClick={() => setForm(f => ({ ...f, type: tp.k }))}
                        style={{ flex: 1, padding: "7px 0", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
                          background: form.type === tp.k ? (tp.k === "income" ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)") : "transparent",
                          color: form.type === tp.k ? tp.c : t.dim }}>{tp.l}</button>
                    ))}
                  </div>
                  <input placeholder="Libellé" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") saveForm(); }}
                    style={{ width: "100%", padding: "9px 12px", background: t.inputBg, border: `1px solid ${t.inputBd}`, borderRadius: 8, color: t.white, fontSize: 13, marginBottom: 10, outline: "none", boxSizing: "border-box" }} />
                  <input placeholder="Montant (€)" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") saveForm(); }}
                    style={{ width: "100%", padding: "9px 12px", background: t.inputBg, border: `1px solid ${t.inputBd}`, borderRadius: 8, color: t.white, fontSize: 13, marginBottom: 10, outline: "none", boxSizing: "border-box" }} />
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    style={{ width: "100%", padding: "9px 12px", background: t.inputBg, border: `1px solid ${t.inputBd}`, borderRadius: 8, color: t.white, fontSize: 12, marginBottom: 10, outline: "none", boxSizing: "border-box" }}>
                    {categories.map(c => <option key={c} value={c} style={{ background: t.optBg }}>{c}</option>)}
                  </select>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, color: t.dim, marginBottom: 4, display: "block" }}>Date</label>
                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      style={{ width: "100%", padding: "9px 12px", background: t.inputBg, border: `1px solid ${t.inputBd}`, borderRadius: 8, color: t.white, fontSize: 12, outline: "none", boxSizing: "border-box", colorScheme: dark ? "dark" : "light" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setModal(null)} style={{ padding: "8px 16px", background: t.secBg, border: "none", borderRadius: 8, color: t.secCol, cursor: "pointer", fontSize: 12 }}>Annuler</button>
                    <button onClick={saveForm} style={{ padding: "8px 20px", background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      {modal.mode === "add" ? "Ajouter" : "Enregistrer"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Popout overlay for cells with many cards */}
      {hoveredCell && popPos && (() => {
        const [pmi, pd] = hoveredCell.split("-").map(Number);
        const dc = cards.filter(c => c.year === year && c.month === pmi && c.day === pd);
        if (dc.length <= 1) return null;
        const dw2 = dow(year, pmi, pd); const isWe2 = dw2 >= 5;
        return (
          <div onMouseEnter={() => clearTimeout(hoverTimeout.current)} onMouseLeave={onCellLeave}
            style={{
              position: "fixed", left: popPos.left - 2, top: popPos.top - 2, width: popPos.width + 4, zIndex: 80,
              padding: "5px 8px 8px", borderRadius: 8,
              background: dark ? "#141b2d" : "#ffffff",
              border: `1px solid ${dark ? "rgba(99,102,241,0.35)" : "rgba(99,102,241,0.25)"}`,
              boxShadow: dark ? "0 12px 40px rgba(0,0,0,0.7)" : "0 12px 40px rgba(0,0,0,0.15)",
              display: "flex", flexDirection: "column",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: isWe2 ? t.weText : t.muted, fontWeight: 500, minWidth: 20 }}>{DAYS_L[dw2]}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: t.white }}>{pd}</span>
              <span style={{ fontSize: 8, color: t.dim, marginLeft: "auto" }}>{dc.length} ops</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {dc.map(c => {
                const isDone = c.done;
                return (
                  <div key={c.id} draggable onDragStart={e => { e.stopPropagation(); onDS(e, c.id); setHoveredCell(null); setPopPos(null); }}
                    onClick={e => e.stopPropagation()} onDoubleClick={e => { e.stopPropagation(); startInlineEdit(e, c); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 3,
                      padding: "3px 5px", borderRadius: 4, cursor: "grab", flexShrink: 0,
                      background: c.type === "income" ? (isDone ? t.cardIncBgDone : t.cardIncBg) : (isDone ? t.cardExpBgDone : t.cardExpBg),
                      borderLeft: `2px solid ${c.type === "income" ? G : R}`, opacity: isDone ? 1 : 0.7,
                    }}>
                    <button onClick={e => { e.stopPropagation(); toggleDone(c.id); }}
                      style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${c.type === "income" ? G : R}`, background: isDone ? (c.type === "income" ? G : R) : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0, fontSize: 8, color: "#fff", lineHeight: 1 }}>
                      {isDone && "✓"}
                    </button>
                    <span style={{ fontSize: 10, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{c.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: c.type === "income" ? G : R, flexShrink: 0 }}>{c.type === "income" ? "+" : "-"}{fmt(c.amount)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
