"use client";

import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database, OrderStatus } from "@/types/database";
import { RefreshCw, ArrowUpRight } from "lucide-react";

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  vpas?: { vpa_address: string; payee_name: string } | null;
};

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; cls: string; dot: string }
> = {
  PENDING:             { label: "Pending",     cls: "badge-pending",  dot: "#FF8C00" },
  PAID:                { label: "Paid",        cls: "badge-paid",     dot: "#00C851" },
  EXPIRED:             { label: "Expired",     cls: "badge-expired",  dot: "#999"    },
  MANUAL_VERIFICATION: { label: "Manual",      cls: "badge-manual",   dot: "#7B2FFF" },
  PARTIAL_PAID:        { label: "Partial",     cls: "badge-partial",  dot: "#0066FF" },
};

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  return (
    <span className={`badge ${cfg.cls}`}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: cfg.dot,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}

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
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function LiveOrdersModule() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());

  const fetchOrders = useCallback(async () => {
    const res = await fetch("/api/v1/admin/orders?limit=30");
    if (!res.ok) return;
    const json = await res.json();
    setOrders(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();

    // ── Realtime subscription ──────────────────────────────
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("live-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          const newOrder = payload.new as Order;
          setOrders((prev) => {
            const idx = prev.findIndex((o) => o.id === newOrder.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = newOrder;
              return updated;
            }
            // New order — prepend
            setNewOrderIds((s) => new Set([...s, newOrder.id]));
            setTimeout(
              () =>
                setNewOrderIds((s) => {
                  const n = new Set(s);
                  n.delete(newOrder.id);
                  return n;
                }),
              3000
            );
            return [newOrder, ...prev].slice(0, 30);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  return (
    <div className="brut-card" style={{ gridColumn: "span 7" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.25rem",
          borderBottom: "2px solid var(--color-border)",
          background: "var(--color-surface-2)",
          borderRadius: "var(--radius-md) var(--radius-md) 0 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <span className="rt-pulse" />
          <h2 style={{ fontFamily: "var(--font-space)", fontWeight: 700, fontSize: "0.9rem" }}>
            Live Orders
          </h2>
          {orders.length > 0 && (
            <span
              style={{
                background: "var(--color-yellow)",
                border: "1.5px solid var(--color-border)",
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
        <button
          className="brut-btn brut-btn-ghost brut-btn-sm"
          onClick={fetchOrders}
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", maxHeight: "420px", overflowY: "auto" }}>
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "120px",
              gap: "0.75rem",
            }}
          >
            <div className="spinner" />
            <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
              Loading orders…
            </span>
          </div>
        ) : orders.length === 0 ? (
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: "0.875rem",
            }}
          >
            No orders yet. Create one via the API.
          </div>
        ) : (
          <table className="brut-table">
            <thead>
              <tr>
                <th>Ext ID</th>
                <th>Amount</th>
                <th>VPA</th>
                <th>Status</th>
                <th>Via</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className={newOrderIds.has(order.id) ? "animate-slide-in" : ""}
                  style={
                    newOrderIds.has(order.id)
                      ? { background: "#FFFDE7" }
                      : {}
                  }
                >
                  <td>
                    <span className="font-mono" style={{ fontSize: "0.75rem" }}>
                      {order.order_id_ext}
                    </span>
                  </td>
                  <td>
                    <div>
                      <span style={{ fontWeight: 700 }}>
                        {formatAmount(order.dynamic_amount)}
                      </span>
                      {order.base_amount !== order.dynamic_amount && (
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.65rem",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          base: {formatAmount(order.base_amount)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      className="font-mono"
                      style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}
                    >
                      {(order as Order & { vpas?: { vpa_address: string } }).vpas?.vpa_address ?? "—"}
                    </span>
                  </td>
                  <td>
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td>
                    {order.verified_via ? (
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          background: "var(--color-surface-2)",
                          padding: "2px 6px",
                          borderRadius: "3px",
                          border: "1.5px solid var(--color-border)",
                        }}
                      >
                        {order.verified_via}
                      </span>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem" }}>
                        —
                      </span>
                    )}
                  </td>
                  <td style={{ color: "var(--color-text-muted)", fontSize: "0.72rem" }}>
                    {timeAgo(order.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
