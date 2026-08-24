import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { buildUpiUri } from "@/lib/payment/allocator";
import type { OrderRow, VpaRow } from "@/types/database";

type OrderWithVpa = OrderRow & { vpas: VpaRow | null };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: orderRaw } = await supabase
    .from("orders")
    .select("*, vpas(*)")
    .eq("id", orderId)
    .maybeSingle();

  if (!orderRaw) {
    return new NextResponse("Order not found", { status: 404 });
  }

  const order = orderRaw as OrderWithVpa;

  if (!order.vpas) {
    return new NextResponse("VPA not found", { status: 404 });
  }

  const upiUri = buildUpiUri(
    order.vpas.vpa_address,
    order.vpas.payee_name,
    order.dynamic_amount,
    order.id
  );

  // Use toDataURL and convert to Buffer via Uint8Array to satisfy BodyInit
  const svgString = await QRCode.toString(upiUri, { type: "svg" });

  return new NextResponse(svgString, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=60",
    },
  });
}
