"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Database, OrderStatus } from "@/types/database";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Hash,
  ChevronDown,
  ChevronUp,
  Smartphone,
} from "lucide-react";

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  vpas?: { vpa_address: string; payee_name: string } | null;
};

function formatAmount(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(n);
}

// ── Countdown colour helpers ─────────────────────────────────
// Smooth green → amber → red interpolation instead of hard steps.

type RGB = [number, number, number];
const GREEN: RGB = [0, 200, 81];
const AMBER: RGB = [255, 140, 0];
const RED: RGB = [255, 87, 51];

function lerpColor(a: RGB, b: RGB, t: number): string {
  const c = a.map((av, i) => Math.round(av + (b[i] - av) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** pct: fraction of time remaining (1 → full, 0 → expired). */
function progressColor(pct: number): string {
  const clamped = Math.max(0, Math.min(1, pct));
  if (clamped > 0.5) return lerpColor(AMBER, GREEN, (clamped - 0.5) / 0.5);
  return lerpColor(RED, AMBER, clamped / 0.5);
}

function CountdownTimer({
  expiresAt,
  createdAt,
}: {
  expiresAt: string;
  createdAt?: string;
}) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
      setRemaining(diff);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  // Total window of the order (creation → expiry). Falls back to the
  // remaining time captured on first render when creation is unknown,
  // so the ring always starts FULL and drains to EMPTY.
  const totalSec = (() => {
    if (createdAt) {
      const t = Math.floor(
        (new Date(expiresAt).getTime() - new Date(createdAt).getTime()) / 1000
      );
      if (t > 0) return t;
    }
    return null;
  })();
  const fallbackRef = useRef<number | null>(null);
  if (fallbackRef.current === null) {
    fallbackRef.current =
      Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) || 900;
  }
  const total = Math.max(totalSec ?? fallbackRef.current ?? 900, 1);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct = Math.max(0, Math.min(1, remaining / total));
  const color = progressColor(pct);
  const urgent = remaining > 0 && remaining <= 120;

  // SVG ring
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct);

  return (
    <div
      className={urgent ? "animate-pulse-dot" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      <svg
        width={104}
        height={104}
        style={{
          transform: "rotate(-90deg)",
          filter: `drop-shadow(0 0 5px ${color}66)`,
        }}
      >
        {/* Track */}
        <circle cx={52} cy={52} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={9} />
        {/* Progress */}
        <circle
          cx={52}
          cy={52}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={9}
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.8s ease" }}
        />
        {/* Tick at the top marking the start point */}
        <circle
          cx={52}
          cy={12}
          r={3}
          fill="#111111"
          style={{ transformOrigin: "center" }}
        />
      </svg>
      <div
        style={{
          textAlign: "center",
          marginTop: "-84px",
          zIndex: 1,
          marginBottom: "24px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-space)",
            fontWeight: 800,
            fontSize: "1.25rem",
            color,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {mins.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}
        </p>
        <p style={{ fontSize: "0.65rem", color: "var(--color-text-muted)" }}>
          {remaining === 0 ? "expired" : "remaining"}
        </p>
      </div>
    </div>
  );
}

export default function PaymentPageClient({ order }: { order: Order }) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [utrInput, setUtrInput] = useState("");
  const [utrError, setUtrError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [utrSubmitted, setUtrSubmitted] = useState(false);
  const [showUtrForm, setShowUtrForm] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_CLIENT_API_KEY;

  // ── Status polling ─────────────────────────────────────────
  // Supabase Realtime is unavailable here (RLS grants no SELECT to
  // browser roles), so poll the public status endpoint instead.
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/payment/status/${order.id}`);
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (!cancelled && json?.data?.status) {
          setStatus(json.data.status as OrderStatus);
        }
      } catch {
        // transient network error — keep polling
      }
    };

    poll();
    const t = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [order.id]);

  // ── Redirect on settlement ────────────────────────────────
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (status !== "PAID" || redirectedRef.current) return;
    redirectedRef.current = true;

    const t = setTimeout(() => {
      if (order.return_url) {
        // Send the customer back to the merchant website
        try {
          const target = new URL(order.return_url);
          target.searchParams.set("orderId", order.id);
          target.searchParams.set("orderIdExt", order.order_id_ext);
          target.searchParams.set("status", "PAID");
          window.location.href = target.toString();
        } catch {
          window.location.href = order.return_url as string;
        }
      } else {
        // No merchant URL configured — show the built-in receipt page
        router.push(`/pay/${order.id}/success`);
      }
    }, 2000);

    return () => clearTimeout(t);
  }, [status, order.id, order.return_url, order.order_id_ext, router]);

  const handleUtrSubmit = useCallback(async () => {
    const trimmed = utrInput.trim();
    if (!/^\d{12}$/.test(trimmed)) {
      setUtrError("UTR must be exactly 12 numeric digits.");
      return;
    }
    setUtrError("");
    setSubmitting(true);

    const res = await fetch("/api/v1/payment/submit-utr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Api-Key": apiKey ?? "",
      },
      body: JSON.stringify({ orderId: order.id, utr: trimmed }),
    });

    setSubmitting(false);
    if (res.ok) {
      setUtrSubmitted(true);
      setStatus("MANUAL_VERIFICATION");
    } else {
      const json = await res.json();
      setUtrError(json.error ?? "Submission failed");
    }
  }, [utrInput, order.id, apiKey]);

  // ── Paid state ─────────────────────────────────────────────
  if (status === "PAID") {
    return (
      <div style={centeredStyle}>
        <div className="brut-card" style={cardStyle}>
          <CheckCircle size={48} color="var(--color-green)" style={{ margin: "0 auto 1rem" }} />
          <h1 style={{ fontFamily: "var(--font-space)", fontSize: "1.5rem", fontWeight: 800, textAlign: "center" }}>
            Payment Confirmed!
          </h1>
          <p style={{ textAlign: "center", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
            Your payment of {formatAmount(order.dynamic_amount)} has been verified.
          </p>
          <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
            Redirecting you now…
          </p>
        </div>
      </div>
    );
  }

  // ── Expired state ──────────────────────────────────────────
  if (status === "EXPIRED") {
    return (
      <div style={centeredStyle}>
        <div className="brut-card" style={cardStyle}>
          <Clock size={48} color="var(--color-orange)" style={{ margin: "0 auto 1rem" }} />
          <h1 style={{ fontFamily: "var(--font-space)", fontSize: "1.5rem", fontWeight: 800, textAlign: "center" }}>
            Payment Expired
          </h1>
          <p style={{ textAlign: "center", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
            This payment link has expired. Please request a new one.
          </p>
        </div>
      </div>
    );
  }

  // ── Manual Verification state ──────────────────────────────
  if (status === "MANUAL_VERIFICATION") {
    return (
      <div style={centeredStyle}>
        <div className="brut-card" style={cardStyle}>
          <AlertTriangle size={48} color="var(--color-purple)" style={{ margin: "0 auto 1rem" }} />
          <h1 style={{ fontFamily: "var(--font-space)", fontSize: "1.5rem", fontWeight: 800, textAlign: "center" }}>
            Under Review
          </h1>
          <p style={{ textAlign: "center", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
            Your payment is being manually verified by our team. This usually takes a few minutes.
          </p>
        </div>
      </div>
    );
  }

  const vpa = (order as Order & { vpas?: { vpa_address: string; payee_name: string } }).vpas;

  return (
    <div style={centeredStyle}>
      <div className="brut-card" style={cardStyle}>
        {/* Header */}
        <div
          style={{
            background: "var(--color-yellow)",
            border: "2.5px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
          }}
        >
          <Smartphone size={20} strokeWidth={2.5} />
          <div>
            <p style={{ fontFamily: "var(--font-space)", fontWeight: 800, fontSize: "1rem" }}>
              OpenPayUPI
            </p>
            <p style={{ fontSize: "0.7rem", fontWeight: 600 }}>Scan & Pay with any UPI app</p>
          </div>
        </div>

        {/* Amount */}
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.375rem" }}>
            Pay Exactly
          </p>
          <p
            style={{
              fontFamily: "var(--font-space)",
              fontSize: "2.5rem",
              fontWeight: 900,
              letterSpacing: "-0.02em",
            }}
          >
            {formatAmount(order.dynamic_amount)}
          </p>
          {order.base_amount !== order.dynamic_amount && (
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              (includes ₹0.{Math.round((order.dynamic_amount - order.base_amount) * 100).toString().padStart(2, "0")} service fee)
            </p>
          )}
          <p style={{ fontSize: "0.82rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
            to <strong>{vpa?.payee_name ?? "Merchant"}</strong> ({vpa?.vpa_address})
          </p>
        </div>

        {/* QR Code */}
        {order.dynamic_amount && (
          <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
            {/* QR is served server-side — use img tag pointing to a data URL */}
            <div
              style={{
                display: "inline-block",
                padding: "1rem",
                border: "2.5px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow)",
                background: "#fff",
              }}
            >
              <img
                src={`/api/v1/payment/qr/${order.id}`}
                alt="UPI QR Code"
                width={200}
                height={200}
                style={{ display: "block" }}
                onError={(e) => {
                  // Fallback: show VPA text if QR fails
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <p style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
              Open any UPI app → Scan QR
            </p>
          </div>
        )}

        {/* Timer + Order ID */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <CountdownTimer expiresAt={order.expires_at} createdAt={order.created_at} />
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
              Order ID
            </p>
            <p className="font-mono" style={{ fontSize: "0.72rem", fontWeight: 700 }}>
              {order.order_id_ext}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "2px dashed var(--color-surface-2)", margin: "0 -1.5rem 1.25rem", padding: "0 1.5rem" }} />

        {/* Submit UTR section */}
        <div>
          <button
            className="brut-btn brut-btn-ghost"
            style={{ width: "100%", justifyContent: "space-between" }}
            onClick={() => setShowUtrForm((p) => !p)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Hash size={15} />
              <span>Already paid? Enter UTR manually</span>
            </div>
            {showUtrForm ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {showUtrForm && !utrSubmitted && (
            <div className="animate-slide-in" style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              <input
                className="brut-input"
                placeholder="12-digit UTR number"
                value={utrInput}
                onChange={(e) => {
                  setUtrInput(e.target.value.replace(/\D/g, "").slice(0, 12));
                  setUtrError("");
                }}
                maxLength={12}
                inputMode="numeric"
              />
              {utrError && (
                <p style={{ fontSize: "0.75rem", color: "var(--color-coral)", fontWeight: 600 }}>
                  {utrError}
                </p>
              )}
              <button
                className="brut-btn brut-btn-blue"
                style={{ width: "100%" }}
                onClick={handleUtrSubmit}
                disabled={submitting || utrInput.length !== 12}
              >
                {submitting ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : "Submit UTR"}
              </button>
            </div>
          )}

          {utrSubmitted && (
            <div
              className="animate-slide-in"
              style={{
                marginTop: "0.75rem",
                padding: "0.75rem",
                background: "#E9D8FF",
                border: "2px solid var(--color-purple)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "var(--color-purple)",
              }}
            >
              ✓ UTR submitted — awaiting admin verification
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const centeredStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  background: "var(--color-bg)",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "420px",
  padding: "1.5rem",
};
