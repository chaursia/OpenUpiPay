import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";
import { validateClientKey } from "@/lib/auth/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  allocateDynamicAmount,
  selectVpa,
  buildUpiUri,
  generateExpiresAt,
} from "@/lib/payment/allocator";
import type { OrderRow } from "@/types/database";

const CreatePaymentSchema = z.object({
  baseAmount: z.number().positive().max(100000),
  orderIdExt: z.string().min(1).max(100),
  callbackUrl: z.string().url().optional(),
  expiresInMinutes: z.number().int().min(5).max(60).optional().default(15),
});

export async function POST(req: NextRequest) {
  let apiKey;
  try {
    apiKey = await validateClientKey(req);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }

  let body;
  try {
    body = CreatePaymentSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: err }, { status: 400 });
  }

  const { baseAmount, orderIdExt, callbackUrl, expiresInMinutes } = body;

  try {
    const supabase = createSupabaseAdminClient();
    const dynamicAmount = await allocateDynamicAmount(baseAmount);
    const vpa = await selectVpa();
    const expiresAt = generateExpiresAt(expiresInMinutes);

    const { data: orderRaw, error: insertError } = await supabase
      .from("orders")
      .insert({
        order_id_ext: orderIdExt,
        base_amount: baseAmount,
        dynamic_amount: dynamicAmount,
        vpa_id: vpa.id,
        status: "PENDING",
        client_callback_url: callbackUrl ?? null,
        api_key_id: apiKey.id,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError || !orderRaw) {
      throw new Error(`Failed to create order: ${insertError?.message}`);
    }

    const order = orderRaw as OrderRow;

    await supabase
      .from("vpas")
      .update({ daily_tx_count: vpa.daily_tx_count + 1 })
      .eq("id", vpa.id);

    const upiUri = buildUpiUri(vpa.vpa_address, vpa.payee_name, dynamicAmount, order.id);
    const qrCodeDataUrl = await QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: "M",
      width: 300,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          orderId: order.id,
          orderIdExt: order.order_id_ext,
          baseAmount,
          dynamicAmount,
          upiUri,
          qrCodeDataUrl,
          vpa: vpa.vpa_address,
          payeeName: vpa.payee_name,
          expiresAt,
          paymentPageUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pay/${order.id}`,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[create-payment]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
