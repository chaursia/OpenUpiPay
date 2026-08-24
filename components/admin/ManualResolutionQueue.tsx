"use client";

import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { CheckCircle, XCircle, Clock, RefreshCw, AlertTriangle } from "lucide-react";

type Order = Database["public"]["Tables"]["orders"]["Row"];

function formatAmount(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(n);
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function ManualResolutionQueue() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fetchOrders = useCallback(async () => {
    const res = await fetch("/api/v1/admin/orders?status=MANUAL_VERIFICATION&limit=50");
    if (!res.ok) return;
    const json = await res.json();
    setOrders(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();

    // Realtime subscription for MANUAL_VERIFICATION orders
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("manual-queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          const updated = payload.new as Order;
          if (updated.status === "MANUAL_VERIFICATION") {
            setOrders((prev) => {
              const idx = prev.findIndex((o) => o.id === updated.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = updated;
                return next;
              }
              return [updated, ...prev];
            });
          } else {
            // Remove from queue if no longer MANUAL_VERIFICATION
            setOrders((prev) => prev.filter((o) => o.id !== updated.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders]);

  const handleResolve = async (
    orderId: string,
    action: "APPROVE" | "REJECT"
  ) => {
    setProcessing(orderId);
    setNotification(null);

    try {
      const res = await fetch("/api/v1/admin/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action }),
      });
      const json = await res.json();

      if (res.ok) {
        setNotification({
          type: "success",
          message: `Order ${action === "APPROVE" ? "approved" : "rejected"} successfully.`,
        });
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      } else {
        setNotification({ type: "error", message: json.error ?? "Action failed" });
      }
    } catch {
      setNotification({ type: "error", message: "Network error. Please try again." });
    } finally {
      setProcessing(null);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  return (
    <div className="brut-card" style={{ gridColumn: "span 8" }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <AlertTriangle size={16} color="var(--color-purple)" strokeWidth={2.5} />
          <h2 style={{ fontFamily: "var(--font-space)", fontWeight: 700, fontSize: "0.9rem" }}>
            Manual Resolution Queue
          </h2>
          {orders.length > 0 && (
            <span
              style={{
                background: "var(--color-purple)",
                color: "#fff",
                borderRadius: "999px",
                padding: "0 0.5rem",
                fontSize: "0.7rem",
                fontWeight: 700,
              }}
            >
              {orders.length}
            </span>
          )}
        </div>
        <button className="brut-btn brut-btn-ghost brut-btn-sm" onClick={fetchOrders}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className="animate-slide-in"
          style={{
            margin: "0.75rem 1.25rem 0",
            padding: "0.625rem 1rem",
            borderRadius: "var(--radius-sm)",
            border: "2px solid",
            fontSize: "0.82rem",
            fontWeight: 600,
            background: notification.type === "success" ? "#D4EDDA" : "#F8D7DA",
            borderColor: notification.type === "success" ? "var(--color-green)" : "var(--color-coral)",
            color: notification.type === "success" ? "#155724" : "#721C24",
          }}
        >
          {notification.message}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: "auto", maxHeight: "400px", overflowY: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100px", gap: "0.75rem" }}>
            <div className="spinner" />
            <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>Loading…</span>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: "2.5rem", textAlign: "center" }}>
            <CheckCircle size={32} color="var(--color-green)" style={{ margin: "0 auto 0.75rem" }} />
            <p style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Queue is empty</p>
            <p style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
              All orders have been resolved.
            </p>
          </div>
        ) : (
          <table className="brut-table">
            <thead>
              <tr>
                <th>Order (Ext ID)</th>
                <th>Amount</th>
                <th>UTR</th>
                <th>Via</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isProcessing = processing === order.id;
                return (
                  <tr key={order.id}>
                    <td>
                      <div>
                        <span className="font-mono" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                          {order.order_id_ext}
                        </span>
                        <br />
                        <span style={{ fontSize: "0.65rem", color: "var(--color-text-muted)" }}>
                          {order.id.slice(0, 8)}…
                        </span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{formatAmount(order.dynamic_amount)}</td>
                    <td>
                      <span className="font-mono" style={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                        {order.upi_utr ?? (
                          <span style={{ color: "var(--color-text-muted)" }}>—</span>
                        )}
                      </span>
                    </td>
                    <td>
                      {order.verified_via ? (
                        <span style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          background: "var(--color-surface-2)",
                          padding: "2px 6px",
                          borderRadius: "3px",
                          border: "1.5px solid var(--color-border)",
                        }}>
                          {order.verified_via}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <Clock size={11} />
                        {timeAgo(order.updated_at)}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          className="brut-btn brut-btn-green brut-btn-sm"
                          disabled={isProcessing}
                          onClick={() => handleResolve(order.id, "APPROVE")}
                          style={{ opacity: isProcessing ? 0.6 : 1 }}
                        >
                          {isProcessing ? (
                            <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                          ) : (
                            <CheckCircle size={12} />
                          )}
                          Approve
                        </button>
                        <button
                          className="brut-btn brut-btn-coral brut-btn-sm"
                          disabled={isProcessing}
                          onClick={() => handleResolve(order.id, "REJECT")}
                          style={{ opacity: isProcessing ? 0.6 : 1 }}
                        >
                          <XCircle size={12} />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
