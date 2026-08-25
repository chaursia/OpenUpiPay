"use client";

import { useEffect, useState } from "react";
import { Plus, Eye, EyeOff, Trash2, Copy, Check, Key } from "lucide-react";
import type { KeyType } from "@/types/database";

interface ApiKeyRecord {
  id: string;
  key_name: string;
  key_type: KeyType;
  is_active: boolean;
  created_at: string;
  key_value?: string; // Only present on creation
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState({ keyName: "", keyType: "CLIENT" as KeyType });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [revealIds, setRevealIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchKeys = async () => {
    const res = await fetch("/api/v1/admin/keys");
    const json = await res.json();
    setKeys(json.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    if (!newKeyData.keyName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/v1/admin/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newKeyData),
    });
    const json = await res.json();
    if (res.ok) {
      setCreatedKey(json.data.key_value);
      setKeys((prev) => [json.data, ...prev]);
    }
    setCreating(false);
  };

  const handleRevoke = async (id: string) => {
    await fetch(`/api/v1/admin/keys?id=${id}`, { method: "DELETE" });
    setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, is_active: false } : k)));
    setDeleteConfirm(null);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleReveal = (id: string) => {
    setRevealIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="brut-card" style={{ gridColumn: "span 4" }}>
      {/* Header */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "2px solid var(--color-border)",
          background: "var(--color-surface-2)",
          borderRadius: "var(--radius-md) var(--radius-md) 0 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Key size={15} strokeWidth={2.5} />
          <h2 style={{ fontFamily: "var(--font-space)", fontWeight: 700, fontSize: "0.9rem" }}>
            API Key Management
          </h2>
        </div>
        <button
          className="brut-btn brut-btn-yellow brut-btn-sm"
          onClick={() => { setShowModal(true); setCreatedKey(null); }}
        >
          <Plus size={13} />
          New Key
        </button>
      </div>

      {/* Key list */}
      <div style={{ overflowY: "auto", maxHeight: "380px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
            <div className="spinner" />
          </div>
        ) : keys.length === 0 ? (
          <p style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
            No API keys yet.
          </p>
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              style={{
                padding: "0.875rem 1.25rem",
                borderBottom: "1.5px solid var(--color-surface-2)",
                opacity: key.is_active ? 1 : 0.5,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>{key.key_name}</span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "3px",
                        border: "1.5px solid",
                        background: key.key_type === "CLIENT" ? "#CCE5FF" : "#E9D8FF",
                        color: key.key_type === "CLIENT" ? "var(--color-blue)" : "var(--color-purple)",
                        borderColor: key.key_type === "CLIENT" ? "var(--color-blue)" : "var(--color-purple)",
                      }}
                    >
                      {key.key_type}
                    </span>
                    {!key.is_active && (
                      <span className="badge badge-expired" style={{ fontSize: "0.6rem" }}>Revoked</span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                    Created {timeAgo(key.created_at)}
                  </p>
                  {/* Masked key display */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      marginTop: "0.375rem",
                    }}
                  >
                    <span
                      className="font-mono"
                      style={{
                        fontSize: "0.7rem",
                        background: "var(--color-surface-2)",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        border: "1.5px solid var(--color-border)",
                        letterSpacing: "0.1em",
                      }}
                    >
                      {revealIds.has(key.id) && key.key_value
                        ? key.key_value
                        : "••••••••••••••••••••"}
                    </span>
                    {key.key_value && (
                      <>
                        <button
                          onClick={() => toggleReveal(key.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}
                          title={revealIds.has(key.id) ? "Hide" : "Reveal"}
                        >
                          {revealIds.has(key.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        <button
                          onClick={() => handleCopy(key.key_value!, key.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}
                          title="Copy"
                        >
                          {copiedId === key.id ? <Check size={13} color="var(--color-green)" /> : <Copy size={13} />}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Revoke */}
                {key.is_active && (
                  deleteConfirm === key.id ? (
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <button
                        className="brut-btn brut-btn-coral brut-btn-sm"
                        onClick={() => handleRevoke(key.id)}
                        style={{ fontSize: "0.65rem" }}
                      >
                        Confirm
                      </button>
                      <button
                        className="brut-btn brut-btn-ghost brut-btn-sm"
                        onClick={() => setDeleteConfirm(null)}
                        style={{ fontSize: "0.65rem" }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="brut-btn brut-btn-ghost brut-btn-sm"
                      onClick={() => setDeleteConfirm(key.id)}
                      title="Revoke key"
                    >
                      <Trash2 size={13} color="var(--color-coral)" />
                    </button>
                  )
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Key Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: "var(--font-space)", fontWeight: 700, fontSize: "1.1rem", marginBottom: "1.25rem" }}>
              {createdKey ? "Key Created!" : "Create New API Key"}
            </h3>

            {createdKey ? (
              <div>
                <div
                  style={{
                    padding: "1rem",
                    background: "#D4EDDA",
                    border: "2px solid var(--color-green)",
                    borderRadius: "var(--radius-sm)",
                    marginBottom: "1rem",
                  }}
                >
                  <p style={{ fontWeight: 700, fontSize: "0.8rem", color: "#155724", marginBottom: "0.5rem" }}>
                    ⚠️ Copy this key now- it will not be shown again.
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      className="font-mono"
                      style={{ fontSize: "0.75rem", wordBreak: "break-all", flex: 1 }}
                    >
                      {createdKey}
                    </span>
                    <button
                      className="brut-btn brut-btn-green brut-btn-sm"
                      onClick={() => handleCopy(createdKey, "new")}
                    >
                      {copiedId === "new" ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
                <button className="brut-btn brut-btn-yellow" style={{ width: "100%" }} onClick={() => { setShowModal(false); setCreatedKey(null); }}>
                  Done
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 700, fontSize: "0.8rem", marginBottom: "0.375rem" }}>
                    Key Name
                  </label>
                  <input
                    className="brut-input"
                    placeholder="e.g. My Shop App"
                    value={newKeyData.keyName}
                    onChange={(e) => setNewKeyData((p) => ({ ...p, keyName: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 700, fontSize: "0.8rem", marginBottom: "0.375rem" }}>
                    Key Type
                  </label>
                  <div style={{ display: "flex", gap: "0.625rem" }}>
                    {(["CLIENT", "DEVICE"] as KeyType[]).map((type) => (
                      <button
                        key={type}
                        className={`brut-btn ${newKeyData.keyType === type ? "brut-btn-blue" : "brut-btn-ghost"}`}
                        style={{ flex: 1 }}
                        onClick={() => setNewKeyData((p) => ({ ...p, keyType: type }))}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.625rem", marginTop: "0.5rem" }}>
                  <button className="brut-btn brut-btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button
                    className="brut-btn brut-btn-yellow"
                    style={{ flex: 1 }}
                    onClick={handleCreate}
                    disabled={creating || !newKeyData.keyName.trim()}
                  >
                    {creating ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : "Generate Key"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
