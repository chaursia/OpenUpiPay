"use client";

import { useEffect, useState, useCallback } from "react";
import type { Database } from "@/types/database";
import { Smartphone, Wifi, WifiOff, Clock, RefreshCw } from "lucide-react";

type DeviceTelemetry = Database["public"]["Tables"]["device_telemetry"]["Row"];

const OFFLINE_THRESHOLD_MS = 90_000; // 90 seconds
const POLL_INTERVAL_MS = 10_000; // Re-fetch device list every 10s

function getDeviceStatus(device: DeviceTelemetry): "ONLINE" | "OFFLINE" {
  const lastPing = new Date(device.last_ping_at).getTime();
  return Date.now() - lastPing < OFFLINE_THRESHOLD_MS ? "ONLINE" : "OFFLINE";
}

function formatLastSeen(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

/** Chip showing which agent software reports this device. */
function DeviceTypeTag({ type }: { type: string | null }) {
  const label = type ?? "LEGACY";
  const style: React.CSSProperties =
    type === "APP"
      ? { background: "#D6ECFF", color: "#0066FF", borderColor: "#0066FF" }
      : type === "TERMUX"
        ? { background: "#E9D8FF", color: "#7B2FFF", borderColor: "#7B2FFF" }
        : { background: "#EEEEEE", color: "#777777", borderColor: "#999999" };

  return (
    <span
      style={{
        fontSize: "0.55rem",
        fontWeight: 800,
        letterSpacing: "0.06em",
        border: `1.5px solid ${style.borderColor}`,
        background: style.background,
        color: style.color,
        borderRadius: 999,
        padding: "1px 7px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export default function InfraHealthModule() {
  const [devices, setDevices] = useState<DeviceTelemetry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0); // Force re-render every second

  const fetchDevices = useCallback(async () => {
    // RLS grants browser sessions no direct access to device_telemetry,
    // so the list is fetched through the service-role admin API.
    try {
      const res = await fetch("/api/v1/admin/devices");
      if (!res.ok) return;
      const json = await res.json();
      setDevices(json.data ?? []);
    } catch {
      // Network error — keep showing the previous snapshot
    }
  }, []);

  /** Manual refresh triggered by the button. */
  const refreshNow = useCallback(async () => {
    setRefreshing(true);
    await fetchDevices();
    setRefreshing(false);
  }, [fetchDevices]);

  useEffect(() => {
    fetchDevices();

    const poller = setInterval(fetchDevices, POLL_INTERVAL_MS);

    // Tick every second to update "last seen" counters
    const ticker = setInterval(() => setTick((t) => t + 1), 1000);

    return () => {
      clearInterval(poller);
      clearInterval(ticker);
    };
  }, [fetchDevices]);

  const onlineCount = devices.filter(
    (d) => getDeviceStatus(d) === "ONLINE"
  ).length;

  return (
    <div className="brut-card" style={{ gridColumn: "span 5" }}>
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
          Infrastructure Health
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              color: onlineCount > 0 ? "var(--color-green)" : "var(--color-coral)",
            }}
          >
            {onlineCount}/{devices.length} Online
          </span>
          <button
            onClick={refreshNow}
            disabled={refreshing}
            title="Refresh device pings"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              border: "2px solid var(--color-border)",
              borderRadius: 999,
              background: refreshing ? "var(--color-surface-2)" : "#fff",
              cursor: refreshing ? "wait" : "pointer",
            }}
          >
            <RefreshCw
              size={13}
              color="var(--color-text)"
              style={{
                animation: refreshing ? "spin 0.8s linear infinite" : "none",
              }}
            />
          </button>
        </div>
      </div>

      {/* Device list */}
      <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {devices.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", textAlign: "center", padding: "1rem 0" }}>
            No devices registered yet.
          </p>
        ) : (
          devices.map((device) => {
            const status = getDeviceStatus(device);
            const isOnline = status === "ONLINE";
            const diff = Math.floor(
              (Date.now() - new Date(device.last_ping_at).getTime()) / 1000
            );
            const pct = Math.min((diff / 90) * 100, 100);

            return (
              <div
                key={device.id}
                className="brut-card-flat"
                style={{ padding: "0.875rem 1rem" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {/* Icon */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "var(--radius-sm)",
                      border: "2px solid var(--color-border)",
                      background: isOnline ? "#D4EDDA" : "#F8D7DA",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Smartphone size={18} color={isOnline ? "var(--color-green)" : "var(--color-coral)"} />
                  </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            minWidth: 0,
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                            {device.device_name}
                          </span>
                          <DeviceTypeTag type={(device as DeviceTelemetry & { device_type?: string | null }).device_type ?? null} />
                        </span>
                        <span className={`badge ${isOnline ? "badge-online" : "badge-offline"}`}>
                          {isOnline ? (
                            <Wifi size={10} style={{ marginRight: 3 }} />
                          ) : (
                            <WifiOff size={10} style={{ marginRight: 3 }} />
                          )}
                          {status}
                        </span>
                      </div>

                    {/* Last ping countdown bar */}
                    <div style={{ marginTop: "0.5rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                        <span style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <Clock size={10} />
                          Last ping: {formatLastSeen(device.last_ping_at)}
                        </span>
                        <span style={{ fontSize: "0.65rem", color: "var(--color-text-muted)" }}>
                          {Math.max(0, 90 - diff)}s until offline
                        </span>
                      </div>
                      <div className="progress-track">
                        <div
                          className={`progress-fill ${
                            pct < 50
                              ? "progress-fill-green"
                              : pct < 80
                              ? "progress-fill-yellow"
                              : "progress-fill-red"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
