import { NextRequest } from "next/server";
import { handlePaymentWebhook } from "@/lib/payment/webhookHandler";

/**
 * POST /api/v1/webhook/email
 * Header: X-Device-Secret
 *
 * Called by the Email IMAP scraper when it detects a payment notification.
 * Body: { amount, rawText, utr, deviceName? }
 */
export async function POST(req: NextRequest) {
  return handlePaymentWebhook(req, "EMAIL");
}
