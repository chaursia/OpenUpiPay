"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { CreditCard, RefreshCw } from "lucide-react";

type Vpa = Database["public"]["Tables"]["vpas"]["Row"];

function getCapacityColor(used: number, max: number): string {
  const pct = used / max;
  if (pct < 0.6) return "progress-fill-green";
  if (pct < 0.85) return "progress-fill-yellow";
  return "progress-fill-red";
}

function getCapacityLabel(used: number, max: number): string {
  const pct = Math.round((used / max) * 100);
  if (pct < 60) return "Healthy";
  if (pct < 85) return "Moderate";
  return "Near Limit";
}

export default function VpaHealthModule() {
  const [vpas, setVpas] = useState<Vpa[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVpas = async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("vpas")
      .select("*")
      .order("is_active", { ascending: false });
    setVpas(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchVpas();

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("vpa-health")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "vpas" },
        (payload) => {
          const updated = payload.new as Vpa;
          setVpas((prev) =>
            prev.map((v) => (v.id === updated.id ? updated : v))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalCapacity = vpas.reduce((s, v) => s + v.max_daily_limit, 0);
  const totalUsed = vpas.reduce((s, v) => s + v.daily_tx_count, 0);

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
        <h2 style={{ fontFamily: "var(--font-space)", fontWeight: 700, fontSize: "0.9rem" }}>
          VPA Rotation Pool
        </h2>
        <button className="brut-btn brut-btn-ghost brut-btn-sm" onClick={fetchVpas}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Summary */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          padding: "0.875rem 1.25rem",
          borderBottom: "1.5px solid var(--color-surface-2)",
        }}
      >
        {[
          { label: "Total Used", value: totalUsed, color: "var(--color-blue)" },
          { label: "Total Cap", value: totalCapacity, color: "var(--color-text-muted)" },
          { label: "Active VPAs", value: vpas.filter((v) => v.is_active).length, color: "var(--color-green)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex: 1, textAlign: "center" }}>
            <p style={{ fontSize: "1.2rem", fontWeight: 800, color, fontFamily: "var(--font-space)" }}>
              {value}
            </p>
            <p style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* VPA list */}
      <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "1rem" }}>
            <div className="spinner" />
          </div>
        ) : vpas.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", textAlign: "center" }}>
            No VPAs configured.
          </p>
        ) : (
          vpas.map((vpa) => {
            const pct = Math.round((vpa.daily_tx_count / vpa.max_daily_limit) * 100);
            return (
              <div key={vpa.id}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <CreditCard size={14} />
                    <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>
                      {vpa.vpa_address}
                    </span>
                    {!vpa.is_active && (
                      <span className="badge badge-expired" style={{ fontSize: "0.6rem" }}>Inactive</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)" }}>
                      {vpa.daily_tx_count}/{vpa.max_daily_limit}
                    </span>
                    <span style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      color: pct < 60 ? "var(--color-green)" : pct < 85 ? "var(--color-orange)" : "var(--color-coral)",
                    }}>
                      {pct}%
                    </span>
                  </div>
                </div>
                <div className="progress-track">
                  <div
                    className={`progress-fill ${getCapacityColor(vpa.daily_tx_count, vpa.max_daily_limit)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", marginTop: "0.2rem" }}>
                  {vpa.payee_name} · {getCapacityLabel(vpa.daily_tx_count, vpa.max_daily_limit)}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
