import type { Metadata } from "next";
import LiveOrdersModule from "@/components/admin/LiveOrdersModule";
import InfraHealthModule from "@/components/admin/InfraHealthModule";
import VpaHealthModule from "@/components/admin/VpaHealthModule";
import ManualResolutionQueue from "@/components/admin/ManualResolutionQueue";
import ApiKeyManager from "@/components/admin/ApiKeyManager";
import PaymentStatsModule from "@/components/admin/PaymentStatsModule";

export const metadata: Metadata = {
  title: "Admin Dashboard- OpenPayUPI",
  description: "Real-time UPI payment gateway administration dashboard",
};

export default function AdminPage() {
  return (
    <div style={{ padding: "1.5rem" }}>
      {/* Page title */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-space)",
            fontSize: "1.5rem",
            fontWeight: 800,
            marginBottom: "0.25rem",
          }}
        >
          Control Center
        </h1>
        <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
          Real-time monitoring and management of your UPI payment gateway
        </p>
      </div>

      {/* ── Bento Grid ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: "1.25rem",
        }}
      >
        {/* Row 0: Payment summary cards (full width) */}
        <div style={{ gridColumn: "span 12" }}>
          <PaymentStatsModule />
        </div>

        {/* Row 1: Live Orders (7) + Infra Health (5) */}
        <div style={{ gridColumn: "span 7" }}>
          <LiveOrdersModule />
        </div>
        <div style={{ gridColumn: "span 5" }}>
          <InfraHealthModule />
        </div>

        {/* Row 2: Manual Resolution (8) + VPA Health (4) */}
        <div style={{ gridColumn: "span 8" }}>
          <ManualResolutionQueue />
        </div>
        <div style={{ gridColumn: "span 4" }}>
          <VpaHealthModule />
        </div>

        {/* Row 3: API Key Manager (full width in its section) */}
        <div style={{ gridColumn: "span 5" }}>
          <ApiKeyManager />
        </div>

        {/* Quick stats summary */}
        <div style={{ gridColumn: "span 7" }}>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}

function QuickActions() {
  return (
    <div
      className="brut-card"
      style={{ padding: "1.5rem", height: "100%" }}
    >
      <h2
        style={{
          fontFamily: "var(--font-space)",
          fontWeight: 700,
          fontSize: "0.9rem",
          marginBottom: "1rem",
        }}
      >
        Integration Quick Reference
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.875rem",
        }}
      >
        {[
          {
            title: "Create Payment",
            endpoint: "POST /api/v1/payment/create",
            auth: "X-Client-Api-Key",
            color: "var(--color-blue)",
            bg: "#CCE5FF",
          },
          {
            title: "SMS Webhook",
            endpoint: "POST /api/v1/webhook/sms",
            auth: "X-Device-Secret",
            color: "var(--color-green)",
            bg: "#D4EDDA",
          },
          {
            title: "Email Webhook",
            endpoint: "POST /api/v1/webhook/email",
            auth: "X-Device-Secret",
            color: "var(--color-purple)",
            bg: "#E9D8FF",
          },
          {
            title: "Device Heartbeat",
            endpoint: "POST /api/v1/device/heartbeat",
            auth: "X-Device-Secret",
            color: "var(--color-orange)",
            bg: "#FFF3CD",
          },
          {
            title: "Submit UTR",
            endpoint: "POST /api/v1/payment/submit-utr",
            auth: "X-Client-Api-Key",
            color: "var(--color-coral)",
            bg: "#F8D7DA",
          },
          {
            title: "Cron Cleanup",
            endpoint: "POST /api/v1/cron/cleanup",
            auth: "x-cron-secret",
            color: "#555",
            bg: "var(--color-surface-2)",
          },
        ].map(({ title, endpoint, auth, color, bg }) => (
          <div
            key={title}
            className="brut-card-flat"
            style={{ padding: "0.875rem" }}
          >
            <p
              style={{
                fontWeight: 700,
                fontSize: "0.82rem",
                marginBottom: "0.375rem",
                color,
              }}
            >
              {title}
            </p>
            <p
              className="font-mono"
              style={{
                fontSize: "0.68rem",
                background: bg,
                padding: "3px 6px",
                borderRadius: "3px",
                border: `1.5px solid ${color}`,
                marginBottom: "0.375rem",
                wordBreak: "break-all",
              }}
            >
              {endpoint}
            </p>
            <p
              style={{
                fontSize: "0.65rem",
                color: "var(--color-text-muted)",
                fontWeight: 600,
              }}
            >
              Auth: {auth}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
