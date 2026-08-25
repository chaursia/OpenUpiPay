"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Database, OrderStatus } from "@/types/database";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Upload,
  Hash,
  ChevronDown,
  ChevronUp,
  Smartphone,
} from "lucide-react";

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  vpas?: { vpa_address: string; payee_name: string } | null;
};

const COUNTDOWN_COLORS = {
  safe: "#00C851",
  warn: "#FF8C00",
  danger: "#FF5733",
};

function formatAmount(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(n);
}

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
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

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const total = Math.floor(
    (new Date(expiresAt).getTime() - Date.now() + remaining * 1000) / 1000
  );
  const pct = remaining / Math.max(total, 1);
  const color =
    pct > 0.5
      ? COUNTDOWN_COLORS.safe
      : pct > 0.2
      ? COUNTDOWN_COLORS.warn
      : COUNTDOWN_COLORS.danger;

  // SVG ring
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
      <svg width={100} height={100} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={50} cy={50} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={8} />
        <circle
          cx={50}
          cy={50}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
        />
      </svg>
      <div style={{ textAlign: "center", marginTop: "-80px", zIndex: 1 }}>
        <p
          style={{
            fontFamily: "var(--font-space)",
            fontWeight: 800,
            fontSize: "1.2rem",
            color,
          }}
        >
          {mins.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}
        </p>
        <p style={{ fontSize: "0.65rem", color: "var(--color-text-muted)" }}>remaining</p>
      </div>
      <div style={{ height: 60 }} /> {/* spacer */}
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
  const [showOcrForm, setShowOcrForm] = useState(false);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrUploading, setOcrUploading] = useState(false);
  const [ocrMessage, setOcrMessage] = useState("");

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

  const handleOcrUpload = useCallback(async () => {
    if (!ocrFile) return;
    setOcrUploading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      const res = await fetch("/api/v1/payment/ocr-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Api-Key": apiKey ?? "",
        },
        body: JSON.stringify({ orderId: order.id, imageBase64: base64 }),
      });
      const json = await res.json();
      setOcrMessage(json.message ?? (res.ok ? "Uploaded!" : json.error ?? "Failed"));
      setOcrUploading(false);
      if (res.ok) setStatus("MANUAL_VERIFICATION");
    };
    reader.readAsDataURL(ocrFile);
  }, [ocrFile, order.id, apiKey]);

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
          <CountdownTimer expiresAt={order.expires_at} />
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

        {/* OCR Upload section */}
        <div style={{ marginTop: "0.625rem" }}>
          <button
            className="brut-btn brut-btn-ghost"
            style={{ width: "100%", justifyContent: "space-between" }}
            onClick={() => setShowOcrForm((p) => !p)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Upload size={15} />
              <span>Upload payment screenshot</span>
            </div>
            {showOcrForm ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {showOcrForm && (
            <div className="animate-slide-in" style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setOcrFile(e.target.files?.[0] ?? null)}
                style={{ fontSize: "0.82rem" }}
              />
              {ocrMessage && (
                <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-muted)" }}>
                  {ocrMessage}
                </p>
              )}
              <button
                className="brut-btn brut-btn-blue"
                style={{ width: "100%" }}
                onClick={handleOcrUpload}
                disabled={!ocrFile || ocrUploading}
              >
                {ocrUploading ? (
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                ) : (
                  "Upload & Auto-verify"
                )}
              </button>
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
