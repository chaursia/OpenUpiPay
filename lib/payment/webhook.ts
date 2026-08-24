import { createHmac } from "crypto";
import type { Database } from "@/types/database";

type Order = Database["public"]["Tables"]["orders"]["Row"];

interface WebhookPayload {
  event: "payment.success";
  orderId: string;
  orderIdExt: string;
  amount: number;
  dynamicAmount: number;
  upiUtr: string | null;
  verifiedVia: string | null;
  timestamp: string;
}

/**
 * Fires an HMAC-SHA256 signed webhook to the client_callback_url.
 *
 * Signature header: X-Webhook-Signature: sha256=<hex>
 * Signature is computed over the raw JSON body using the client's key_value as secret.
 *
 * @param order - The paid order record
 * @param apiKeySecret - The client's key_value used as HMAC secret
 */
export async function fireHmacCallback(
  order: Order,
  apiKeySecret: string
): Promise<void> {
  if (!order.client_callback_url) return;

  const payload: WebhookPayload = {
    event: "payment.success",
    orderId: order.id,
    orderIdExt: order.order_id_ext,
    amount: order.base_amount,
    dynamicAmount: order.dynamic_amount,
    upiUtr: order.upi_utr,
    verifiedVia: order.verified_via,
    timestamp: new Date().toISOString(),
  };

  const body = JSON.stringify(payload);

  // Generate HMAC-SHA256 signature
  const signature = createHmac("sha256", apiKeySecret)
    .update(body)
    .digest("hex");

  try {
    const response = await fetch(order.client_callback_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": `sha256=${signature}`,
        "User-Agent": "OpenPayUPI-Webhook/1.0",
      },
      body,
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    if (!response.ok) {
      console.warn(
        `[Webhook] Callback failed for order ${order.id}: HTTP ${response.status}`
      );
    } else {
      console.log(
        `[Webhook] Callback delivered for order ${order.id} → ${order.client_callback_url}`
      );
    }
  } catch (err) {
    // Log but don't throw — webhook delivery failure should not affect payment flow
    console.error(
      `[Webhook] Failed to deliver callback for order ${order.id}:`,
      err
    );
  }
}

/**
 * Verifies an inbound webhook signature (for clients to validate callbacks).
 * Clients should use this logic in their own applications.
 *
 * @param body - Raw request body string
 * @param signature - Value of X-Webhook-Signature header
 * @param secret - The client's API key value
 */
export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expected = `sha256=${createHmac("sha256", secret)
    .update(body)
    .digest("hex")}`;
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}
