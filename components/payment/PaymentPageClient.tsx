"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Database, OrderStatus } from "@/types/database";
import {
  CheckCircle,
  AlertTriangle,
  Clock,
  Hash,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  vpas?: { vpa_address: string; payee_name: string } | null;
};

// ── Design tokens (Razorpay-inspired) ────────────────────────
const C = {
  navy: "#123262",
  blue: "#3395FF",
  blueDark: "#1E7AE0",
  ink: "#1F2937",
  muted: "#6B7280",
  line: "#E5E9F0",
  green: "#0FA44A",
  red: "#E5484D",
  purple: "#7C3AED",
  amberBg: "#FFF8E6",
};

const FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function formatAmount(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(n);
}

// ── Countdown colour helpers ─────────────────────────────────

type RGB = [number, number, number];
const GREEN_RGB: RGB = [15, 164, 74];
const AMBER_RGB: RGB = [245, 158, 11];
const RED_RGB: RGB = [229, 72, 77];

function lerpColor(a: RGB, b: RGB, t: number): string {
  const c = a.map((av, i) => Math.round(av + (b[i] - av) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** pct: fraction of time remaining (1 → full, 0 → expired). */
function progressColor(pct: number): string {
  const clamped = Math.max(0, Math.min(1, pct));
  if (clamped > 0.5) return lerpColor(AMBER_RGB, GREEN_RGB, (clamped - 0.5) / 0.5);
  return lerpColor(RED_RGB, AMBER_RGB, clamped / 0.5);
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

  // Total window of the order (creation → expiry), so the ring starts FULL.
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

  const r = 34;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct);

  return (
    <div
      className={urgent ? "animate-pulse-dot" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <svg
        width={88}
        height={88}
        style={{ transform: "rotate(-90deg)", filter: `drop-shadow(0 0 4px ${color}55)` }}
      >
        <circle cx={44} cy={44} r={r} fill="none" stroke={C.line} strokeWidth={8} />
        <circle
          cx={44}
          cy={44}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.8s ease" }}
        />
      </svg>
      <div style={{ textAlign: "center", marginTop: -66, marginBottom: 18 }}>
        <p
          style={{
            fontWeight: 800,
            fontSize: "1.05rem",
            color,
            fontVariantNumeric: "tabular-nums",
            margin: 0,
          }}
        >
          {mins.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}
        </p>
        <p style={{ fontSize: "0.58rem", color: C.muted, margin: 0 }}>
          {remaining === 0 ? "expired" : "remaining"}
        </p>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

export default function PaymentPageClient({ order }: { order: Order }) {
  const router = useRouter();

  // Two-step flow: capture payer mobile BEFORE revealing the QR.
  const [stage, setStage] = useState<"mobile" | "pay">(
    order.customer_mobile ? "pay" : "mobile"
  );
  const [mobile, setMobile] = useState<string>(order.customer_mobile ?? "");
  const [mobileError, setMobileError] = useState("");
  const [submittingMobile, setSubmittingMobile] = useState(false);

  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [utrInput, setUtrInput] = useState("");
  const [utrError, setUtrError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [utrSubmitted, setUtrSubmitted] = useState(false);
  const [showUtrForm, setShowUtrForm] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_CLIENT_API_KEY;

  // ── Status polling ─────────────────────────────────────────
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
        /* transient network error- keep polling */
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
  // PAID    → merchant returnUrl (or built-in receipt page)
  // EXPIRED → merchant returnUrl with status=EXPIRED so the customer
  //           can start a fresh checkout there; without a returnUrl the
  //           built-in expired screen is shown instead.
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current) return;
    const settled = status === "PAID" || status === "EXPIRED";
    if (!settled) return;
    redirectedRef.current = true;

    const t = setTimeout(() => {
      if (order.return_url) {
        try {
          const target = new URL(order.return_url);
          target.searchParams.set("orderId", order.id);
          target.searchParams.set("orderIdExt", order.order_id_ext);
          target.searchParams.set("status", status);
          window.location.href = target.toString();
          return;
        } catch {
          window.location.href = order.return_url as string;
          return;
        }
      }

      // No merchant URL configured- fall back to built-in screens
      if (status === "PAID") {
        router.push(`/pay/${order.id}/success`);
      }
      // EXPIRED: remain on the built-in expired screen
    }, status === "PAID" ? 2_000 : 2_500);

    return () => clearTimeout(t);
  }, [status, order.id, order.return_url, order.order_id_ext, router]);

  // ── Mobile capture ─────────────────────────────────────────
  const handleMobileSubmit = useCallback(async () => {
    const m = mobile.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(m)) {
      setMobileError("Enter a valid 10-digit mobile number");
      return;
    }
    setMobileError("");
    setSubmittingMobile(true);

    try {
      const res = await fetch("/api/v1/payment/mobile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, mobile: m }),
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok) {
        setStage("pay");
      } else {
        setMobileError(json.error ?? "Something went wrong. Try again.");
      }
    } catch {
      setMobileError("Network error. Try again.");
    } finally {
      setSubmittingMobile(false);
    }
  }, [mobile, order.id]);

  // ── Manual UTR ─────────────────────────────────────────────
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

  const payee = order.vpas?.payee_name ?? "Merchant";
  const initials = payee.slice(0, 2).toUpperCase();

  const outerStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.25rem",
    background: "linear-gradient(180deg, #EEF3FA 0%, #DFE7F1 100%)",
    fontFamily: FONT,
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 404,
    borderRadius: 20,
    overflow: "hidden",
    background: "#fff",
    boxShadow: "0 24px 70px rgba(16, 42, 83, 0.16)",
  };

  // ── Settled states ─────────────────────────────────────────
  if (status === "PAID") {
    return (
      <div style={outerStyle}>
        <div style={{ ...cardStyle, textAlign: "center", padding: "2.5rem 1.75rem" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#E8F8EF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
            }}
          >
            <CheckCircle size={32} color={C.green} />
          </div>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: C.ink, margin: 0 }}>
            Payment Successful
          </h1>
          <p style={{ color: C.muted, fontSize: "0.85rem", marginTop: "0.5rem" }}>
            {formatAmount(order.dynamic_amount)} paid to <b>{payee}</b>
          </p>
          <p style={{ color: "#9CA3AF", fontSize: "0.75rem", marginTop: "1rem" }}>
            Redirecting you back…
          </p>
        </div>
      </div>
    );
  }

  if (status === "EXPIRED") {
    return (
      <div style={outerStyle}>
        <div style={{ ...cardStyle, textAlign: "center", padding: "2.5rem 1.75rem" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#FDECEC",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
            }}
          >
            <Clock size={32} color={C.red} />
          </div>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: C.ink, margin: 0 }}>
            Payment Expired
          </h1>
          <p style={{ color: C.muted, fontSize: "0.85rem", marginTop: "0.5rem" }}>
            This payment link has expired. Please request a new one from the merchant.
          </p>
        </div>
      </div>
    );
  }

  if (status === "MANUAL_VERIFICATION") {
    return (
      <div style={outerStyle}>
        <div style={{ ...cardStyle, textAlign: "center", padding: "2.5rem 1.75rem" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#F3EDFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
            }}
          >
            <AlertTriangle size={32} color={C.purple} />
          </div>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: C.ink, margin: 0 }}>
            Verifying your payment
          </h1>
          <p style={{ color: C.muted, fontSize: "0.85rem", marginTop: "0.5rem" }}>
            We received your UTR and are verifying it with the merchant. This usually takes a few minutes.
          </p>
        </div>
      </div>
    );
  }

  // ── Active checkout ────────────────────────────────────────
  return (
    <div style={outerStyle}>
      <div>
        <div style={cardStyle}>
          {/* Merchant header */}
          <div
            style={{
              background: `linear-gradient(135deg, ${C.navy} 0%, ${C.blue} 100%)`,
              padding: "1.1rem 1.35rem",
              display: "flex",
              alignItems: "center",
              gap: "0.85rem",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: "0.95rem",
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  margin: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {payee}
              </p>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.68rem", margin: 0 }}>
                UPI Payment · {order.order_id_ext}
              </p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ color: "#fff", fontWeight: 800, fontSize: "1.15rem", margin: 0 }}>
                {formatAmount(order.dynamic_amount)}
              </p>
              {order.base_amount !== order.dynamic_amount && (
                <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.62rem", margin: 0 }}>
                  including gateway fee
                </p>
              )}
            </div>
          </div>

          {stage === "mobile" ? (
            /* ── Step 1: payer mobile ── */
            <div style={{ padding: "1.75rem 1.5rem 1.5rem" }}>
              <h2 style={{ fontSize: "1.02rem", fontWeight: 700, color: C.ink, margin: 0 }}>
                Confirm it&apos;s you
              </h2>
              <p style={{ color: C.muted, fontSize: "0.82rem", marginTop: "0.35rem" }}>
                Enter your UPI-linked mobile number to load your payment QR securely.
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  marginTop: "1.25rem",
                  border: `1.5px solid ${mobileError ? C.red : C.line}`,
                  borderRadius: 12,
                  overflow: "hidden",
                  transition: "border-color .2s",
                }}
              >
                <span
                  style={{
                    background: "#F6F8FB",
                    borderRight: `1.5px solid ${mobileError ? C.red : C.line}`,
                    padding: "0.8rem 0.9rem",
                    fontWeight: 700,
                    color: C.ink,
                    fontSize: "0.9rem",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  +91
                </span>
                <input
                  value={mobile}
                  onChange={(e) => {
                    setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
                    setMobileError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleMobileSubmit()}
                  placeholder="98765 43210"
                  inputMode="numeric"
                  autoFocus
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    padding: "0.8rem 0.9rem",
                    fontSize: "0.95rem",
                    fontFamily: FONT,
                    letterSpacing: "0.03em",
                    color: C.ink,
                  }}
                />
              </div>
              {mobileError && (
                <p style={{ color: C.red, fontSize: "0.75rem", marginTop: "0.45rem", margin: "0.45rem 0 0" }}>
                  {mobileError}
                </p>
              )}

              <button
                onClick={handleMobileSubmit}
                disabled={submittingMobile || mobile.length !== 10}
                style={{
                  width: "100%",
                  marginTop: "1.4rem",
                  height: 48,
                  border: "none",
                  borderRadius: 12,
                  background:
                    submittingMobile || mobile.length !== 10 ? "#B9D6FB" : C.blue,
                  color: "#fff",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  cursor: submittingMobile ? "wait" : "pointer",
                  fontFamily: FONT,
                  transition: "background .2s",
                }}
              >
                {submittingMobile ? "Verifying…" : "Proceed to Pay"}
              </button>

              <p
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.35rem",
                  color: "#9CA3AF",
                  fontSize: "0.68rem",
                  marginTop: "1.1rem",
                  marginBottom: 0,
                }}
              >
                <ShieldCheck size={13} /> Your number is used only for payment confirmation
              </p>
            </div>
          ) : (
            /* ── Step 2: QR + actions ── */
            <div style={{ padding: "1.4rem 1.5rem 0" }}>
              {/* Timer + order ref */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.9rem",
                }}
              >
                <CountdownTimer expiresAt={order.expires_at} createdAt={order.created_at} />
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: "0.6rem", color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0, fontWeight: 700 }}>
                    Order ID
                  </p>
                  <p className="font-mono" style={{ fontSize: "0.72rem", fontWeight: 700, color: C.ink, margin: "0.15rem 0 0" }}>
                    {order.order_id_ext}
                  </p>
                  <p style={{ fontSize: "0.62rem", color: C.muted, margin: "0.3rem 0 0" }}>
                    paying as +91 {String(order.customer_mobile ?? mobile)}
                  </p>
                </div>
              </div>

              {/* QR */}
              <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                <div
                  style={{
                    display: "inline-block",
                    padding: "0.8rem",
                    border: `1.5px solid ${C.line}`,
                    borderRadius: 16,
                    background: "#fff",
                    boxShadow: "0 6px 18px rgba(16,42,83,0.08)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/v1/payment/qr/${order.id}`}
                    alt="UPI QR Code"
                    width={196}
                    height={196}
                    style={{ display: "block" }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <p style={{ fontSize: "0.78rem", color: C.ink, fontWeight: 600, marginTop: "0.7rem", marginBottom: 0 }}>
                  Scan this QR with any UPI app
                </p>

                {/* App chips */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "0.4rem",
                    marginTop: "0.55rem",
                    flexWrap: "wrap",
                  }}
                >
                  {["GPay", "PhonePe", "Paytm", "BHIM"].map((app) => (
                    <span
                      key={app}
                      style={{
                        fontSize: "0.62rem",
                        fontWeight: 700,
                        color: C.navy,
                        background: "#EEF3FA",
                        borderRadius: 999,
                        padding: "3px 10px",
                        border: `1px solid ${C.line}`,
                      }}
                    >
                      {app}
                    </span>
                  ))}
                </div>

                <p style={{ fontSize: "0.68rem", color: C.muted, marginTop: "0.55rem", marginBottom: 0 }}>
                  Pay exactly{" "}
                  <b style={{ color: C.ink }}>{formatAmount(order.dynamic_amount)}</b> to{" "}
                  <b style={{ color: C.ink }}>{order.vpas?.vpa_address}</b>
                </p>
              </div>

              {/* Divider */}
              <div style={{ borderTop: `1px dashed ${C.line}`, margin: "0 -1.5rem 1.1rem" }} />

              {/* Manual UTR */}
              <div style={{ paddingBottom: "1.1rem" }}>
                {!utrSubmitted ? (
                  <>
                    <button
                      onClick={() => setShowUtrForm((p) => !p)}
                      style={{
                        width: "100%",
                        background: "none",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.5rem 0.1rem",
                        cursor: "pointer",
                        fontFamily: FONT,
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.45rem",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: C.blue,
                        }}
                      >
                        <Hash size={14} /> Already paid? Enter UTR manually
                      </span>
                      {showUtrForm ? (
                        <ChevronUp size={15} color={C.muted} />
                      ) : (
                        <ChevronDown size={15} color={C.muted} />
                      )}
                    </button>

                    {showUtrForm && (
                      <div className="animate-slide-in" style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        <input
                          placeholder="12-digit UTR number"
                          value={utrInput}
                          onChange={(e) => {
                            setUtrInput(e.target.value.replace(/\D/g, "").slice(0, 12));
                            setUtrError("");
                          }}
                          maxLength={12}
                          inputMode="numeric"
                          style={{
                            border: `1.5px solid ${utrError ? C.red : C.line}`,
                            borderRadius: 10,
                            padding: "0.7rem 0.85rem",
                            fontSize: "0.9rem",
                            outline: "none",
                            fontFamily: FONT,
                            letterSpacing: "0.04em",
                            color: C.ink,
                          }}
                        />
                        {utrError && (
                          <p style={{ fontSize: "0.73rem", color: C.red, margin: 0 }}>{utrError}</p>
                        )}
                        <button
                          onClick={handleUtrSubmit}
                          disabled={submitting || utrInput.length !== 12}
                          style={{
                            height: 42,
                            border: "none",
                            borderRadius: 10,
                            background:
                              submitting || utrInput.length !== 12 ? "#B9D6FB" : C.blue,
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            cursor: submitting ? "wait" : "pointer",
                            fontFamily: FONT,
                          }}
                        >
                          {submitting ? "Submitting…" : "Submit UTR"}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    className="animate-slide-in"
                    style={{
                      padding: "0.75rem 0.9rem",
                      background: "#F3EDFF",
                      border: `1.5px solid ${C.purple}`,
                      borderRadius: 12,
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: C.purple,
                    }}
                  >
                    ✓ UTR received- verification usually completes within a few minutes.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Trust footer */}
          <div
            style={{
              background: "#F6F8FB",
              borderTop: `1px solid ${C.line}`,
              padding: "0.65rem 1.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
            }}
          >
            <ShieldCheck size={13} color={C.green} />
            <span style={{ fontSize: "0.66rem", color: C.muted, fontWeight: 600 }}>
              100% secure payments · Powered by OpenPayUPI
            </span>
          </div>
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: "0.62rem",
            color: "#9CA3AF",
            marginTop: "0.9rem",
            marginBottom: 0,
          }}
        >
          By proceeding you agree to the merchant&apos;s payment terms
        </p>
      </div>
    </div>
  );
}
