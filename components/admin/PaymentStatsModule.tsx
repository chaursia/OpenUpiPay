"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Wallet,
  Hourglass,
  XCircle,
  FileSearch,
  RefreshCw,
} from "lucide-react";

type Stats = {
  total: number;
  pending: number;
  paid: number;
  expired: number;
  manual: number;
  partial: number;
  paidAmount: number;
};

const POLL_INTERVAL_MS = 15_000;

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

export default function PaymentStatsModule() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/stats");
      if (!res.ok) return;
      const json = await res.json();
      if (json?.data) setStats(json.data);
    } catch {
      // keep previous snapshot on network errors
    }
  }, []);

  const refreshNow = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, [fetchStats]);

  useEffect(() => {
    fetchStats();
    const poller = setInterval(fetchStats, POLL_INTERVAL_MS);
    return () => clearInterval(poller);
  }, [fetchStats]);

  const cards = [
    {
      label: "Total Payments",
      value: stats ? String(stats.total) : "—",
      sub:
        stats && stats.paidAmount > 0
          ? `${formatINR(stats.paidAmount)} collected`
          : "all orders",
      icon: Wallet,
      color: "#111111",
      bg: "#FFD60A",
    },
    {
      label: "Pending",
      value: stats ? String(stats.pending + stats.partial) : "—",
      sub: stats ? `${stats.partial} partially paid` : "awaiting payment",
      icon: Hourglass,
      color: "#7A4500",
      bg: "#FFF3CD",
    },
    {
      label: "Failed / Expired",
      value: stats ? String(stats.expired) : "—",
      sub: "not completed in time",
      icon: XCircle,
      color: "#721C24",
      bg: "#F8D7DA",
    },
    {
      label: "Manual Review",
      value: stats ? String(stats.manual) : "—",
      sub: "UTRs awaiting admin action",
      icon: FileSearch,
      color: "#4B0082",
      bg: "#E9D8FF",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "1.25rem",
      }}
    >
      {cards.map(({ label, value, sub, icon: Icon, color, bg }) => (
        <div key={label} className="brut-card" style={{ padding: "1.1rem 1.25rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.6rem",
            }}
          >
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
              }}
            >
              {label}
            </span>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: "var(--radius-sm)",
                border: "2px solid var(--color-border)",
                background: bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon size={15} color={color} />
            </span>
          </div>

          <p
            style={{
              fontFamily: "var(--font-space)",
              fontWeight: 800,
              fontSize: "1.9rem",
              lineHeight: 1.1,
            }}
          >
            {value}
          </p>
          <p
            style={{
              fontSize: "0.68rem",
              color: "var(--color-text-muted)",
              fontWeight: 600,
              marginTop: "0.2rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sub}
          </p>
        </div>
      ))}

      {/* Refresh control spans under the cards, right-aligned */}
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={refreshNow}
          disabled={refreshing}
          title="Refresh payment stats"
          className="brut-card-flat"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.45rem 0.9rem",
            background: refreshing ? "var(--color-surface-2)" : "#fff",
            cursor: refreshing ? "wait" : "pointer",
            fontSize: "0.72rem",
            fontWeight: 700,
          }}
        >
          <RefreshCw
            size={13}
            style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }}
          />
          {refreshing ? "Refreshing…" : "Refresh"}
          <span
            style={{
              fontSize: "0.62rem",
              color: "var(--color-text-muted)",
              fontWeight: 600,
            }}
          >
            (auto every 15s)
          </span>
        </button>
      </div>
    </div>
  );
}
