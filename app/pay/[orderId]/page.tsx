import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import PaymentPageClient from "@/components/payment/PaymentPageClient";

interface Props {
  params: Promise<{ orderId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderId } = await params;
  return {
    title: `Pay — Order ${orderId.slice(0, 8)}… | OpenPayUPI`,
    description: "Complete your UPI payment securely",
  };
}

export default async function PaymentPage({ params }: Props) {
  const { orderId } = await params;

  const supabase = createSupabaseAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("*, vpas(vpa_address, payee_name)")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    notFound();
  }

  return <PaymentPageClient order={order as never} />;
}
