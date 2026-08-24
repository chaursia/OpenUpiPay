"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Search, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";

type Order = {
  id: string;
  order_id_ext: string;
  base_amount: number;
  dynamic_amount: number;
  status: string;
  verified_via: string | null;
  upi_utr: string | null;
  created_at: string;
  expires_at: string;
  vpas?: { vpa_address: string } | null;
};

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  PENDING:             { bg: "#FFF3CD", color: "#7A4500" },
  PAID:                { bg: "#D4EDDA", color: "#155724" },
  EXPIRED:             { bg: "#E9ECEF", color: "#495057" },
  MANUAL_VERIFICATION: { bg: "#E9D8FF", color: "#4B0082" },
  PARTIAL_PAID:        { bg: "#CCE5FF", color: "#003466" },
};

const PAGE_SIZE = 20;

export default function OrdersPage() {
  const [orders, setOrders]   = useState<Order[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit:  String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (search.trim())          params.set("search", search.trim());

    const res  = await fetch(`/api/v1/admin/orders?${params}`);
    const json = await res.json();
    setOrders(json.data ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }, [page, statusFilter, search]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ padding: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-space)", fontSize: "1.5rem", fontWeight: 800 }}>All Orders</h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
            {total.toLocaleString()} total orders
          </p>
        </div>
        <button className="brut-btn brut-btn-ghost brut-btn-sm" onClick={fetchOrders}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
          <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
          <input
            className="brut-input"
            placeholder="Search order ID or UTR…"
            style={{ paddingLeft: "2.25rem" }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <select
          className="brut-input"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          style={{ minWidth: "160px", flex: "0 0 auto" }}
        >
          {["ALL", "PENDING", "PAID", "EXPIRED", "MANUAL_VERIFICATION"].map(s => (
            <option key={s} value={s}>{s === "ALL" ? "All Statuses" : s.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : orders.length === 0 ? (
        <div className="brut-card" style={{ padding: "4rem", textAlign: "center" }}>
          <ClipboardList size={40} style={{ margin: "0 auto 1rem", color: "var(--color-text-muted)" }} />
          <h2 style={{ fontFamily: "var(--font-space)", fontWeight: 700 }}>No orders found</h2>
        </div>
      ) : (
        <div className="brut-card" style={{ overflow: "auto", padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
            <thead>
              <tr style={{ background: "var(--color-surface-2)", borderBottom: "2px solid var(--color-border)" }}>
                {["Order ID", "Amount", "VPA", "Status", "Via", "UTR", "Created"].map(h => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontFamily: "var(--font-space)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => {
                const sc = STATUS_COLOR[order.status] ?? { bg: "#E9ECEF", color: "#495057" };
                return (
                  <tr key={order.id} style={{ borderBottom: i < orders.length - 1 ? "1.5px solid var(--color-surface-2)" : "none" }}>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "0.75rem", fontWeight: 600 }}>
                        {order.order_id_ext}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                      <span style={{ fontWeight: 700 }}>₹{order.dynamic_amount.toFixed(2)}</span>
                      {order.base_amount !== order.dynamic_amount && (
                        <span style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", display: "block" }}>
                          base ₹{order.base_amount.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                      {order.vpas?.vpa_address ?? "—"}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: "3px", border: "1.5px solid", background: sc.bg, color: sc.color, borderColor: sc.color, whiteSpace: "nowrap" }}>
                        {order.status.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                      {order.verified_via ?? "—"}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <code style={{ fontSize: "0.72rem" }}>{order.upi_utr ?? "—"}</code>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                      {new Date(order.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "1rem" }}>
          <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            Page {page + 1} of {totalPages} &nbsp;·&nbsp; {total} orders
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="brut-btn brut-btn-ghost brut-btn-sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
              <ChevronLeft size={14} />
            </button>
            <button className="brut-btn brut-btn-ghost brut-btn-sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
