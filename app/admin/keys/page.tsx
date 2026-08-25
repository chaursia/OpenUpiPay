"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, RefreshCw, Copy, Eye, EyeOff, Key } from "lucide-react";

type ApiKey = {
  id: string;
  key_name: string;
  key_type: "CLIENT" | "DEVICE";
  is_active: boolean;
  created_at: string;
  key_value?: string; // only present right after creation
};

const TYPE_COLOR = {
  CLIENT: { bg: "#CCE5FF", color: "#003466", border: "#003466" },
  DEVICE: { bg: "#D4EDDA", color: "#155724", border: "#155724" },
};

export default function KeysPage() {
  const [keys, setKeys]             = useState<ApiKey[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showAdd, setShowAdd]       = useState(false);
  const [revokeId, setRevokeId]     = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyType, setNewKeyType] = useState<"CLIENT" | "DEVICE">("CLIENT");
  const [saving, setSaving]         = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealVisible, setRevealVisible] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const notify = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(null), 4000); };

  const fetchKeys = useCallback(async () => {
    const res  = await fetch("/api/v1/admin/keys");
    const json = await res.json();
    setKeys(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setSaving(true);
    const res  = await fetch("/api/v1/admin/keys", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ keyName: newKeyName.trim(), keyType: newKeyType }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) {
      setRevealedKey(json.data.key_value);
      setRevealVisible(true);
      setShowAdd(false);
      setNewKeyName("");
      await fetchKeys();
    } else {
      notify(json.error ?? "Failed to create key");
    }
  };

  const handleRevoke = async (id: string) => {
    const res = await fetch(`/api/v1/admin/keys?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: false } : k));
      setRevokeId(null);
      notify("Key revoked.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify("Copied to clipboard!");
  };

  return (
    <div style={{ padding: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-space)", fontSize: "1.5rem", fontWeight: 800 }}>API Keys</h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
            Manage CLIENT keys (for your app) and DEVICE keys (for Termux / SMS forwarder).
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="brut-btn brut-btn-ghost brut-btn-sm" onClick={fetchKeys}><RefreshCw size={14} /></button>
          <button className="brut-btn brut-btn-yellow" onClick={() => setShowAdd(true)}>
            <Plus size={15} /> Generate Key
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="animate-slide-in" style={{
          marginBottom: "1rem", padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)",
          border: "2px solid var(--color-green)", background: "#D4EDDA",
          fontSize: "0.82rem", fontWeight: 600, color: "#155724",
        }}>
          {notification}
        </div>
      )}

      {/* Revealed key banner */}
      {revealedKey && (
        <div className="animate-slide-in brut-card" style={{ marginBottom: "1.5rem", padding: "1.25rem", border: "2.5px solid var(--color-green)" }}>
          <p style={{ fontWeight: 700, marginBottom: "0.75rem", color: "var(--color-green)" }}>
            ✓ New API key generated- copy it now, it will not be shown again.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <code style={{
              flex: 1, padding: "0.625rem", background: "var(--color-surface-2)",
              border: "2px solid var(--color-border)", borderRadius: "var(--radius-sm)",
              fontSize: "0.8rem", wordBreak: "break-all", fontFamily: "monospace",
            }}>
              {revealVisible ? revealedKey : "•".repeat(48)}
            </code>
            <button className="brut-btn brut-btn-ghost brut-btn-sm" onClick={() => setRevealVisible(p => !p)}>
              {revealVisible ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button className="brut-btn brut-btn-green brut-btn-sm" onClick={() => copyToClipboard(revealedKey)}>
              <Copy size={14} />
            </button>
          </div>
          <button style={{ marginTop: "0.75rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: 600 }}
            onClick={() => setRevealedKey(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-space)", fontWeight: 800, fontSize: "1.1rem", marginBottom: "1.5rem" }}>Generate API Key</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: "0.8rem", marginBottom: "0.375rem" }}>Key Name</label>
                <input className="brut-input" placeholder="e.g. My E-commerce App" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} autoFocus />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: "0.8rem", marginBottom: "0.5rem" }}>Key Type</label>
                <div style={{ display: "flex", gap: "0.625rem" }}>
                  {(["CLIENT", "DEVICE"] as const).map(type => (
                    <button key={type} onClick={() => setNewKeyType(type)}
                      style={{
                        flex: 1, padding: "0.625rem", border: "2px solid",
                        borderColor: newKeyType === type ? "var(--color-border)" : "var(--color-surface-2)",
                        borderRadius: "var(--radius-sm)", cursor: "pointer", fontWeight: 700, fontSize: "0.82rem",
                        background: newKeyType === type ? TYPE_COLOR[type].bg : "var(--color-surface)",
                        color: newKeyType === type ? TYPE_COLOR[type].color : "var(--color-text-muted)",
                        boxShadow: newKeyType === type ? "var(--shadow)" : "none",
                      }}>
                      {type}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: "0.375rem" }}>
                  {newKeyType === "CLIENT" ? "For your application servers (X-Client-Api-Key header)" : "For Termux / Android SMS forwarder (X-Device-Secret header)"}
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button className="brut-btn brut-btn-ghost" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="brut-btn brut-btn-yellow" style={{ flex: 1 }} onClick={handleCreate} disabled={saving || !newKeyName.trim()}>
                  {saving ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : "Generate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keys table */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : keys.length === 0 ? (
        <div className="brut-card" style={{ padding: "4rem", textAlign: "center" }}>
          <Key size={40} style={{ margin: "0 auto 1rem", color: "var(--color-text-muted)" }} />
          <h2 style={{ fontFamily: "var(--font-space)", fontWeight: 700, marginBottom: "0.5rem" }}>No API keys yet</h2>
          <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>Generate your first key to start integrating.</p>
          <button className="brut-btn brut-btn-yellow" onClick={() => setShowAdd(true)}><Plus size={15} /> Generate Key</button>
        </div>
      ) : (
        <div className="brut-card" style={{ overflow: "hidden", padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--color-surface-2)", borderBottom: "2px solid var(--color-border)" }}>
                {["Name", "Type", "Status", "Created", "Actions"].map(h => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontFamily: "var(--font-space)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((key, i) => (
                <tr key={key.id} style={{ borderBottom: i < keys.length - 1 ? "1.5px solid var(--color-surface-2)" : "none" }}>
                  <td style={{ padding: "0.875rem 1rem", fontWeight: 600, fontSize: "0.875rem" }}>{key.key_name}</td>
                  <td style={{ padding: "0.875rem 1rem" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: "3px", border: "1.5px solid", background: TYPE_COLOR[key.key_type].bg, color: TYPE_COLOR[key.key_type].color, borderColor: TYPE_COLOR[key.key_type].color }}>
                      {key.key_type}
                    </span>
                  </td>
                  <td style={{ padding: "0.875rem 1rem" }}>
                    <span className={`badge ${key.is_active ? "badge-online" : "badge-offline"}`}>
                      {key.is_active ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td style={{ padding: "0.875rem 1rem", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                    {new Date(key.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td style={{ padding: "0.875rem 1rem" }}>
                    {key.is_active && (
                      revokeId === key.id ? (
                        <div style={{ display: "flex", gap: "0.375rem" }}>
                          <button className="brut-btn brut-btn-coral brut-btn-sm" onClick={() => handleRevoke(key.id)}>Revoke</button>
                          <button className="brut-btn brut-btn-ghost brut-btn-sm" onClick={() => setRevokeId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button className="brut-btn brut-btn-ghost brut-btn-sm" onClick={() => setRevokeId(key.id)}>
                          <Trash2 size={13} color="var(--color-coral)" /> Revoke
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Usage guide */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1.5rem" }}>
        {[
          { type: "CLIENT", header: "X-Client-Api-Key", use: "payment/create, submit-utr, ocr-upload", color: "#003466", bg: "#CCE5FF" },
          { type: "DEVICE", header: "X-Device-Secret",  use: "webhook/sms, webhook/email, device/heartbeat", color: "#155724", bg: "#D4EDDA" },
        ].map(item => (
          <div key={item.type} className="brut-card-flat" style={{ padding: "1rem", background: item.bg }}>
            <p style={{ fontWeight: 800, fontSize: "0.82rem", color: item.color, marginBottom: "0.375rem", fontFamily: "var(--font-space)" }}>
              {item.type} KEY
            </p>
            <code style={{ fontSize: "0.72rem", display: "block", marginBottom: "0.375rem" }}>{item.header}</code>
            <p style={{ fontSize: "0.72rem", color: item.color }}>{item.use}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
