import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { OrderRow } from "@/types/database";

interface Props {
  params: Promise<{ orderId: string }>;
}

export default async function PaymentSuccessPage({ params }: Props) {
  const { orderId } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: orderRaw, error } = await supabase
    .from("orders")
    .select("*, vpas(vpa_address, payee_name)")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !orderRaw) {
    notFound();
  }

  const order = orderRaw as OrderRow & {
    vpas?: { vpa_address: string; payee_name: string } | null;
  };

  const formattedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(order.dynamic_amount);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        background: "var(--color-bg)",
      }}
    >
      <div
        className="brut-card"
        style={{
          width: "100%",
          maxWidth: "440px",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "#D4EDDA",
            border: "2.5px solid var(--color-green)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem",
          }}
        >
          <CheckCircle2 size={36} color="var(--color-green)" />
        </div>

        <h1
          style={{
            fontFamily: "var(--font-space)",
            fontSize: "1.6rem",
            fontWeight: 900,
            marginBottom: "0.5rem",
          }}
        >
          Payment Successful!
        </h1>

        <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
          Your payment of <strong>{formattedAmount}</strong> has been verified.
        </p>

        <div
          className="brut-card-flat"
          style={{
            background: "var(--color-surface-2)",
            padding: "1.25rem",
            textAlign: "left",
            marginBottom: "1.5rem",
            fontSize: "0.85rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--color-text-muted)" }}>Order ID:</span>
            <span className="font-mono" style={{ fontWeight: 700 }}>{order.order_id_ext}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--color-text-muted)" }}>Amount Paid:</span>
            <span style={{ fontWeight: 700 }}>{formattedAmount}</span>
          </div>
          {order.upi_utr && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--color-text-muted)" }}>UTR Ref:</span>
              <span className="font-mono" style={{ fontWeight: 700 }}>{order.upi_utr}</span>
            </div>
          )}
          {order.vpas && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--color-text-muted)" }}>Paid To:</span>
              <span style={{ fontWeight: 600 }}>{order.vpas.payee_name}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--color-text-muted)" }}>Status:</span>
            <span className="badge badge-paid">PAID</span>
          </div>
        </div>

        <Link
          href="/"
          className="brut-btn brut-btn-yellow"
          style={{ width: "100%", justifyContent: "center", textDecoration: "none" }}
        >
          <ArrowLeft size={16} /> Return to Home
        </Link>
      </div>
    </div>
  );
}
