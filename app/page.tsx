import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "OpenPayUPI- Self-Hosted UPI Payment Gateway",
  description:
    "A production-grade, self-hosted UPI payment gateway with dynamic QR generation, dual-channel SMS/Email verification, and real-time admin dashboard.",
};

const features = [
  {
    icon: "⚡",
    title: "Dynamic QR Allocation",
    description:
      "Each order gets a unique decimal suffix (₹100.07) that maps to exactly one payment- no ambiguity, no collisions.",
    accent: "#FFD60A",
  },
  {
    icon: "📱",
    title: "Dual-Channel Verification",
    description:
      "Intercepts UPI payment confirmations via SMS (Termux) and Email IMAP in real time- fully automated.",
    accent: "#00C851",
  },
  {
    icon: "🔐",
    title: "HMAC-SHA256 Webhooks",
    description:
      "Signed callbacks delivered to your app the instant a payment is confirmed. Timing-safe signature verification included.",
    accent: "#0066FF",
  },
  {
    icon: "🔁",
    title: "VPA Load Balancer",
    description:
      "Round-robin across multiple UPI IDs with configurable daily limits. Automatically rotates when a VPA hits its cap.",
    accent: "#FF5733",
  },
  {
    icon: "🧠",
    title: "OCR Screenshot Fallback",
    description:
      "Customer uploads a UPI payment screenshot- Tesseract.js extracts the UTR and amount automatically.",
    accent: "#7B2FFF",
  },
  {
    icon: "📊",
    title: "Realtime Admin Dashboard",
    description:
      "Supabase Realtime streams live order status, device health, VPA capacity, and manual review queue.",
    accent: "#FF8C00",
  },
];

const endpoints = [
  { method: "POST", path: "/api/v1/payment/create", auth: "CLIENT", desc: "Create order + QR" },
  { method: "POST", path: "/api/v1/webhook/sms", auth: "DEVICE", desc: "SMS payment interception" },
  { method: "POST", path: "/api/v1/webhook/email", auth: "DEVICE", desc: "Email IMAP interception" },
  { method: "POST", path: "/api/v1/payment/submit-utr", auth: "CLIENT", desc: "Manual UTR submission" },
  { method: "POST", path: "/api/v1/payment/ocr-upload", auth: "CLIENT", desc: "Screenshot OCR parsing" },
  { method: "POST", path: "/api/v1/device/heartbeat", auth: "DEVICE", desc: "Device keepalive ping" },
  { method: "POST", path: "/api/v1/cron/cleanup", auth: "CRON", desc: "Expire orders + reset VPAs" },
];

const AUTH_COLOR: Record<string, { bg: string; color: string }> = {
  CLIENT: { bg: "#CCE5FF", color: "#003466" },
  DEVICE: { bg: "#D4EDDA", color: "#155724" },
  CRON:   { bg: "#E9ECEF", color: "#495057" },
};

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 2rem",
          height: "60px",
          background: "var(--color-surface)",
          borderBottom: "2.5px solid var(--color-border)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <span style={{ fontSize: "1.25rem" }}>⚡</span>
          <span
            style={{
              fontFamily: "var(--font-space)",
              fontWeight: 800,
              fontSize: "1.1rem",
              letterSpacing: "-0.02em",
            }}
          >
            OpenPayUPI
          </span>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <Link
            href="/admin"
            className="brut-btn brut-btn-ghost brut-btn-sm"
            style={{ textDecoration: "none" }}
          >
            Admin Dashboard
          </Link>
          <Link
            href="/admin"
            className="brut-btn brut-btn-yellow brut-btn-sm"
            style={{ textDecoration: "none" }}
          >
            Get Started →
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "6rem 2rem 4rem",
          textAlign: "center",
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.375rem 1rem",
            background: "var(--color-yellow)",
            border: "2px solid var(--color-border)",
            borderRadius: "999px",
            fontSize: "0.78rem",
            fontWeight: 700,
            boxShadow: "2px 2px 0px var(--color-border)",
            marginBottom: "2rem",
          }}
        >
          <span>🇮🇳</span>
          <span>Self-Hosted · Production-Grade · Open Source</span>
        </div>

        <h1
          style={{
            fontFamily: "var(--font-space)",
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            marginBottom: "1.5rem",
          }}
        >
          Your own UPI
          <br />
          <span
            style={{
              background: "var(--color-yellow)",
              borderBottom: "4px solid var(--color-border)",
              paddingLeft: "0.25rem",
              paddingRight: "0.25rem",
            }}
          >
            Payment Gateway
          </span>
          <br />
          in minutes.
        </h1>

        <p
          style={{
            fontSize: "1.15rem",
            color: "var(--color-text-muted)",
            lineHeight: 1.7,
            maxWidth: "600px",
            margin: "0 auto 2.5rem",
          }}
        >
          Generate dynamic UPI QR codes, verify payments automatically via SMS
          and Email interception, and manage everything from a real-time admin
          dashboard- all self-hosted on your own infrastructure.
        </p>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/admin"
            className="brut-btn brut-btn-yellow"
            style={{ textDecoration: "none", fontSize: "1rem", padding: "0.75rem 2rem" }}
          >
            Open Admin Dashboard →
          </Link>
          <a
            href="https://github.com/chaursia"
            className="brut-btn brut-btn-ghost"
            style={{ fontSize: "1rem", padding: "0.75rem 2rem" }}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </div>

        {/* Tech stack badges */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: "3rem",
          }}
        >
          {["Next.js 16", "Supabase", "Tailwind CSS", "TypeScript", "Tesseract.js", "HMAC-SHA256"].map(
            (tech) => (
              <span
                key={tech}
                style={{
                  padding: "0.25rem 0.75rem",
                  background: "var(--color-surface)",
                  border: "1.5px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  fontFamily: "var(--font-space)",
                }}
              >
                {tech}
              </span>
            )
          )}
        </div>
      </section>

      {/* ── Flow diagram strip ───────────────────────────────── */}
      <section
        style={{
          background: "var(--color-border)",
          padding: "0.2rem 0",
          margin: "0 0 5rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "var(--color-surface-2)",
            padding: "1.25rem 2rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            justifyContent: "center",
            flexWrap: "wrap",
            fontSize: "0.82rem",
            fontWeight: 700,
            fontFamily: "var(--font-space)",
          }}
        >
          {[
            "Client App",
            "→",
            "Create Order API",
            "→",
            "Dynamic QR",
            "→",
            "Customer Pays",
            "→",
            "SMS / Email Interceptor",
            "→",
            "UTR Verified",
            "→",
            "HMAC Webhook",
          ].map((step, i) => (
            <span
              key={i}
              style={{
                color: step === "→" ? "var(--color-text-muted)" : "var(--color-text)",
                background:
                  step === "→"
                    ? "transparent"
                    : "var(--color-surface)",
                padding: step === "→" ? "0" : "0.3rem 0.75rem",
                border: step === "→" ? "none" : "2px solid var(--color-border)",
                borderRadius: step === "→" ? "0" : "var(--radius-sm)",
              }}
            >
              {step}
            </span>
          ))}
        </div>
      </section>

      {/* ── Feature Grid ─────────────────────────────────────── */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 2rem 6rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <h2
            style={{
              fontFamily: "var(--font-space)",
              fontSize: "2rem",
              fontWeight: 800,
              marginBottom: "0.75rem",
            }}
          >
            Everything you need
          </h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "1rem" }}>
            Built for developers who need reliable, auditable UPI payment processing.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {features.map((f) => (
            <div
              key={f.title}
              className="brut-card"
              style={{ padding: "1.5rem" }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "var(--radius-sm)",
                  background: f.accent,
                  border: "2.5px solid var(--color-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  marginBottom: "1rem",
                  boxShadow: "2px 2px 0px var(--color-border)",
                }}
              >
                {f.icon}
              </div>
              <h3
                style={{
                  fontFamily: "var(--font-space)",
                  fontWeight: 700,
                  fontSize: "1rem",
                  marginBottom: "0.5rem",
                }}
              >
                {f.title}
              </h3>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── API Reference ────────────────────────────────────── */}
      <section
        style={{
          background: "var(--color-surface)",
          borderTop: "2.5px solid var(--color-border)",
          borderBottom: "2.5px solid var(--color-border)",
          padding: "5rem 2rem",
        }}
      >
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2
              style={{
                fontFamily: "var(--font-space)",
                fontSize: "2rem",
                fontWeight: 800,
                marginBottom: "0.75rem",
              }}
            >
              Simple, predictable API
            </h2>
            <p style={{ color: "var(--color-text-muted)" }}>
              RESTful endpoints with two auth headers- one for your app, one for your device.
            </p>
          </div>

          <div
            className="brut-card-flat"
            style={{ overflow: "hidden" }}
          >
            {endpoints.map((ep, i) => (
              <div
                key={ep.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "0.875rem 1.25rem",
                  borderBottom:
                    i < endpoints.length - 1
                      ? "1.5px solid var(--color-surface-2)"
                      : "none",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-space)",
                    fontWeight: 800,
                    fontSize: "0.75rem",
                    color: "#0066FF",
                    minWidth: "42px",
                  }}
                >
                  {ep.method}
                </span>
                <code
                  style={{
                    fontFamily: "'Courier New', monospace",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    flex: 1,
                    minWidth: "220px",
                  }}
                >
                  {ep.path}
                </code>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "3px",
                    border: "1.5px solid",
                    background: AUTH_COLOR[ep.auth].bg,
                    color: AUTH_COLOR[ep.auth].color,
                    borderColor: AUTH_COLOR[ep.auth].color,
                  }}
                >
                  {ep.auth}
                </span>
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--color-text-muted)",
                    minWidth: "160px",
                    textAlign: "right",
                  }}
                >
                  {ep.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quick Start ──────────────────────────────────────── */}
      <section style={{ maxWidth: "800px", margin: "0 auto", padding: "5rem 2rem" }}>
        <h2
          style={{
            fontFamily: "var(--font-space)",
            fontSize: "2rem",
            fontWeight: 800,
            textAlign: "center",
            marginBottom: "3rem",
          }}
        >
          Up in 4 steps
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {[
            {
              step: "01",
              title: "Configure environment",
              code: "cp .env.local.example .env.local\n# Add your Supabase URL + keys",
              color: "#FFD60A",
            },
            {
              step: "02",
              title: "Run database migrations",
              code: "-- In Supabase SQL Editor:\n-- 001_initial_schema.sql\n-- 002_rls_policies.sql",
              color: "#00C851",
            },
            {
              step: "03",
              title: "Start the dev server",
              code: "npm run dev\n# → http://localhost:3000/admin",
              color: "#0066FF",
            },
            {
              step: "04",
              title: "Create your first order",
              code: 'curl -X POST /api/v1/payment/create \\\n  -H "X-Client-Api-Key: ..." \\\n  -d \'{"baseAmount":100,"orderIdExt":"ORD-1"}\'',
              color: "#FF5733",
            },
          ].map((s) => (
            <div
              key={s.step}
              className="brut-card-flat"
              style={{ display: "flex", gap: "1.25rem", padding: "1.25rem" }}
            >
              <div
                style={{
                  minWidth: 48,
                  height: 48,
                  background: s.color,
                  border: "2.5px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-space)",
                  fontWeight: 900,
                  fontSize: "0.85rem",
                  boxShadow: "2px 2px 0px var(--color-border)",
                  flexShrink: 0,
                }}
              >
                {s.step}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, marginBottom: "0.5rem", fontFamily: "var(--font-space)" }}>
                  {s.title}
                </p>
                <pre
                  style={{
                    fontFamily: "'Courier New', monospace",
                    fontSize: "0.78rem",
                    background: "var(--color-surface-2)",
                    border: "1.5px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "0.625rem 0.875rem",
                    overflowX: "auto",
                    color: "var(--color-text)",
                    lineHeight: 1.6,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {s.code}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section
        style={{
          background: "var(--color-border)",
          padding: "4rem 2rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            background: "var(--color-yellow)",
            maxWidth: "600px",
            margin: "0 auto",
            padding: "3rem 2rem",
            border: "2.5px solid var(--color-bg)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "6px 6px 0px rgba(0,0,0,0.3)",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-space)",
              fontSize: "1.75rem",
              fontWeight: 900,
              marginBottom: "0.75rem",
            }}
          >
            Ready to accept payments?
          </h2>
          <p style={{ marginBottom: "2rem", color: "#333" }}>
            Open the admin dashboard to add your VPAs, generate API keys, and
            start processing orders.
          </p>
          <Link
            href="/admin"
            className="brut-btn"
            style={{
              textDecoration: "none",
              background: "var(--color-border)",
              color: "#fff",
              fontSize: "1rem",
              padding: "0.75rem 2.5rem",
              boxShadow: "4px 4px 0px rgba(255,255,255,0.3)",
            }}
          >
            Open Admin Dashboard →
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer
        style={{
          background: "var(--color-surface)",
          borderTop: "2.5px solid var(--color-border)",
          padding: "1.5rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <span style={{ fontWeight: 700, fontFamily: "var(--font-space)", fontSize: "0.9rem" }}>
          ⚡ OpenPayUPI
        </span>
        <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
          Built with Next.js 16 · Supabase · Tailwind CSS · TypeScript
        </span>
      </footer>
    </div>
  );
}
