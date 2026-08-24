"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Trash2, ToggleLeft, ToggleRight,
  RefreshCw, Edit2, Check, X, RotateCcw, CreditCard
} from "lucide-react";
import type { VpaRow } from "@/types/database";

type EditState = { payeeName: string; maxDailyLimit: number };

function CapacityBar({ used, max }: { used: number; max: number }) {
  const pct = Math.min(Math.round((used / max) * 100), 100);
  const cls = pct < 60 ? "progress-fill-green" : pct < 85 ? "progress-fill-yellow" : "progress-fill-red";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>{used}/{max} today</span>
        <span style={{ fontSize: "0.7rem", fontWeight: 700 }}>{pct}%</span>
      </div>
      <div className="progress-track"><div className={`progress-fill ${cls}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function VpasPage() {
  const [vpas, setVpas]           = useState<VpaRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ payeeName: "", maxDailyLimit: 15 });
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [notification, setNotification] = useState<{ type: "success"|"error"; message: string } | null>(null);

  // Add form state
  const [form, setForm] = useState({ vpaAddress: "", payeeName: "", maxDailyLimit: 15 });

  const notify = (type: "success"|"error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchVpas = useCallback(async () => {
    const res = await fetch("/api/v1/admin/vpas");
    const json = await res.json();
    setVpas(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchVpas(); }, [fetchVpas]);

  const handleAdd = async () => {
    if (!form.vpaAddress.trim() || !form.payeeName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/v1/admin/vpas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vpaAddress: form.vpaAddress.trim(), payeeName: form.payeeName.trim(), maxDailyLimit: form.maxDailyLimit }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) {
      setVpas(prev => [json.data, ...prev]);
      setForm({ vpaAddress: "", payeeName: "", maxDailyLimit: 15 });
      setShowAdd(false);
      notify("success", `VPA "${json.data.vpa_address}" added successfully.`);
    } else {
      notify("error", json.error ?? "Failed to add VPA");
    }
  };

  const handlePatch = async (id: string, patch: Record<string, unknown>) => {
    const res = await fetch("/api/v1/admin/vpas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const json = await res.json();
    if (res.ok) {
      setVpas(prev => prev.map(v => v.id === id ? json.data : v));
      return true;
    }
    notify("error", json.error ?? "Update failed");
    return false;
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    const ok = await handlePatch(editId, { payeeName: editState.payeeName, maxDailyLimit: editState.maxDailyLimit });
    setSaving(false);
    if (ok) { setEditId(null); notify("success", "VPA updated."); }
  };

  const handleToggle = async (vpa: VpaRow) => {
    await handlePatch(vpa.id, { isActive: !vpa.is_active });
    notify("success", `VPA ${vpa.is_active ? "deactivated" : "activated"}.`);
  };

  const handleResetCount = async (vpa: VpaRow) => {
    await handlePatch(vpa.id, { resetCount: true });
    notify("success", `Daily count reset for ${vpa.vpa_address}.`);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/v1/admin/vpas?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setVpas(prev => prev.filter(v => v.id !== id));
      setDeleteId(null);
      notify("success", "VPA deleted.");
    } else {
      const json = await res.json();
      notify("error", json.error ?? "Delete failed");
    }
  };

  return (
    <div style={{ padding: "1.5rem" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-space)", fontSize: "1.5rem", fontWeight: 800 }}>UPI VPAs</h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
            Manage your UPI IDs (Virtual Payment Addresses) and their daily limits.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="brut-btn brut-btn-ghost brut-btn-sm" onClick={fetchVpas}><RefreshCw size={14} /></button>
          <button className="brut-btn brut-btn-yellow" onClick={() => setShowAdd(true)}>
            <Plus size={15} /> Add VPA
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="animate-slide-in" style={{
          marginBottom: "1rem", padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)", border: "2px solid",
          fontSize: "0.82rem", fontWeight: 600,
          background: notification.type === "success" ? "#D4EDDA" : "#F8D7DA",
          borderColor: notification.type === "success" ? "var(--color-green)" : "var(--color-coral)",
          color: notification.type === "success" ? "#155724" : "#721C24",
        }}>
          {notification.message}
        </div>
      )}

      {/* Add VPA modal */}
      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-space)", fontWeight: 800, fontSize: "1.1rem", marginBottom: "1.5rem" }}>
              Add New VPA
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: "0.8rem", marginBottom: "0.375rem" }}>
                  UPI VPA Address *
                </label>
                <input
                  className="brut-input"
                  placeholder="merchant@ybl"
                  value={form.vpaAddress}
                  onChange={e => setForm(p => ({ ...p, vpaAddress: e.target.value }))}
                />
                <p style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                  Format: handle@bank (e.g. shop@okaxis, payments@ybl)
                </p>
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: "0.8rem", marginBottom: "0.375rem" }}>
                  Payee Display Name *
                </label>
                <input
                  className="brut-input"
                  placeholder="My Shop"
                  value={form.payeeName}
                  onChange={e => setForm(p => ({ ...p, payeeName: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: "0.8rem", marginBottom: "0.375rem" }}>
                  Max Daily Transactions
                </label>
                <input
                  className="brut-input"
                  type="number"
                  min={1}
                  max={100}
                  value={form.maxDailyLimit}
                  onChange={e => setForm(p => ({ ...p, maxDailyLimit: parseInt(e.target.value) || 15 }))}
                />
                <p style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                  Recommended: 15 (UPI apps typically flag VPAs with excessive daily transactions)
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button className="brut-btn brut-btn-ghost" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
                <button
                  className="brut-btn brut-btn-yellow"
                  style={{ flex: 1 }}
                  onClick={handleAdd}
                  disabled={saving || !form.vpaAddress.trim() || !form.payeeName.trim()}
                >
                  {saving ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : "Add VPA"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VPA list */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : vpas.length === 0 ? (
        <div className="brut-card" style={{ padding: "4rem", textAlign: "center" }}>
          <CreditCard size={40} style={{ margin: "0 auto 1rem", color: "var(--color-text-muted)" }} />
          <h2 style={{ fontFamily: "var(--font-space)", fontWeight: 700, marginBottom: "0.5rem" }}>No VPAs yet</h2>
          <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
            Add your first UPI VPA to start accepting payments.
          </p>
          <button className="brut-btn brut-btn-yellow" onClick={() => setShowAdd(true)}>
            <Plus size={15} /> Add First VPA
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {vpas.map(vpa => (
            <div
              key={vpa.id}
              className="brut-card"
              style={{ padding: "1.5rem", opacity: vpa.is_active ? 1 : 0.6 }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                {/* Icon */}
                <div style={{
                  width: 48, height: 48, flexShrink: 0,
                  background: vpa.is_active ? "var(--color-yellow)" : "var(--color-surface-2)",
                  border: "2.5px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "var(--shadow-hover)",
                }}>
                  <CreditCard size={20} strokeWidth={2} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editId === vpa.id ? (
                    /* Edit mode */
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                      <input
                        className="brut-input"
                        value={editState.payeeName}
                        onChange={e => setEditState(p => ({ ...p, payeeName: e.target.value }))}
                        placeholder="Payee name"
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <label style={{ fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                          Max daily:
                        </label>
                        <input
                          className="brut-input"
                          type="number"
                          min={1}
                          max={100}
                          value={editState.maxDailyLimit}
                          onChange={e => setEditState(p => ({ ...p, maxDailyLimit: parseInt(e.target.value) || 15 }))}
                          style={{ width: "80px" }}
                        />
                        <button className="brut-btn brut-btn-green brut-btn-sm" onClick={handleSaveEdit} disabled={saving}>
                          <Check size={13} />
                        </button>
                        <button className="brut-btn brut-btn-ghost brut-btn-sm" onClick={() => setEditId(null)}>
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap", marginBottom: "0.375rem" }}>
                        <span style={{ fontFamily: "var(--font-space)", fontWeight: 700, fontSize: "1rem" }}>
                          {vpa.vpa_address}
                        </span>
                        <span className={`badge ${vpa.is_active ? "badge-online" : "badge-offline"}`}>
                          {vpa.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.82rem", color: "var(--color-text-muted)", marginBottom: "0.75rem" }}>
                        {vpa.payee_name}
                      </p>
                      <CapacityBar used={vpa.daily_tx_count} max={vpa.max_daily_limit} />
                    </div>
                  )}
                </div>

                {/* Actions */}
                {editId !== vpa.id && (
                  <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0, flexWrap: "wrap" }}>
                    <button
                      className="brut-btn brut-btn-ghost brut-btn-sm"
                      onClick={() => { setEditId(vpa.id); setEditState({ payeeName: vpa.payee_name, maxDailyLimit: vpa.max_daily_limit }); }}
                      title="Edit"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="brut-btn brut-btn-ghost brut-btn-sm"
                      onClick={() => handleResetCount(vpa)}
                      title="Reset daily count"
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      className="brut-btn brut-btn-ghost brut-btn-sm"
                      onClick={() => handleToggle(vpa)}
                      title={vpa.is_active ? "Deactivate" : "Activate"}
                    >
                      {vpa.is_active
                        ? <ToggleRight size={15} color="var(--color-green)" />
                        : <ToggleLeft size={15} color="var(--color-text-muted)" />}
                    </button>
                    {deleteId === vpa.id ? (
                      <>
                        <button className="brut-btn brut-btn-coral brut-btn-sm" onClick={() => handleDelete(vpa.id)}>
                          Confirm
                        </button>
                        <button className="brut-btn brut-btn-ghost brut-btn-sm" onClick={() => setDeleteId(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="brut-btn brut-btn-ghost brut-btn-sm"
                        onClick={() => setDeleteId(vpa.id)}
                        title="Delete"
                      >
                        <Trash2 size={13} color="var(--color-coral)" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="brut-card-flat" style={{ padding: "1rem 1.25rem", marginTop: "1.5rem", background: "#FFF3CD", borderColor: "var(--color-orange)" }}>
        <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#7A4500" }}>
          💡 <strong>UPI limits:</strong> Most banks cap UPI VPAs at 20 transactions/day for new accounts and up to 100 for established ones.
          Keep <em>Max Daily</em> conservative (10–15) to avoid flags. The system auto-rotates to the next available VPA when one hits its limit.
        </p>
      </div>
    </div>
  );
}
