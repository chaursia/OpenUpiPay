import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateClientKey } from "@/lib/auth/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { parsePaymentScreenshot } from "@/lib/ocr/parser";
import { validateUtr, hashUtr } from "@/lib/utils/utr";
import type { OrderRow } from "@/types/database";

const OcrUploadSchema = z.object({
  orderId: z.string().uuid(),
  imageBase64: z.string().min(100),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    await validateClientKey(req);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }

  let body;
  try {
    body = OcrUploadSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", details: err },
      { status: 400 }
    );
  }

  const { orderId, imageBase64 } = body;

  try {
    const supabase = createSupabaseAdminClient();

    const { data: orderRaw, error: orderError } = await supabase
      .from("orders")
      .select("id, status, dynamic_amount")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !orderRaw) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orderRaw as Pick<OrderRow, "id" | "status" | "dynamic_amount">;

    if (!["PENDING", "PARTIAL_PAID"].includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot upload OCR for order in status '${order.status}'` },
        { status: 409 }
      );
    }

    const ocrResult = await parsePaymentScreenshot(imageBase64);

    const response: Record<string, unknown> = {
      success: true,
      ocr: {
        rawText: ocrResult.rawText.slice(0, 500),
        confidence: ocrResult.confidence,
        extractedUtr: ocrResult.utr,
        extractedAmount: ocrResult.amount,
      },
    };

    if (ocrResult.utr && validateUtr(ocrResult.utr)) {
      const utrHash = hashUtr(ocrResult.utr);

      const { data: existingLedger } = await supabase
        .from("utr_ledger")
        .select("id")
        .eq("utr_hash", utrHash)
        .maybeSingle();

      if (existingLedger) {
        return NextResponse.json(
          { error: "OCR-extracted UTR already exists in the system" },
          { status: 409 }
        );
      }

      await supabase
        .from("orders")
        .update({
          status: "MANUAL_VERIFICATION" as const,
          upi_utr: ocrResult.utr,
          verified_via: "OCR" as const,
        })
        .eq("id", orderId);

      response.message = "OCR data extracted. Order queued for admin verification.";
      response.orderId = orderId;
    } else {
      await supabase
        .from("orders")
        .update({ status: "MANUAL_VERIFICATION" as const })
        .eq("id", orderId);

      response.message = "Screenshot uploaded. An admin will review manually.";
      response.orderId = orderId;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[ocr-upload]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
