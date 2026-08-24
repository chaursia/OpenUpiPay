import { NextRequest } from "next/server";
import { handlePaymentWebhook } from "@/lib/payment/webhookHandler";

/**
 * POST /api/v1/webhook/sms
 * Header: X-Device-Secret
 *
 * Called by the Termux SMS forwarding script on the Android device.
 * Body: { amount, rawText, utr, deviceName? }
 */
export async function POST(req: NextRequest) {
  return handlePaymentWebhook(req, "SMS");
}
