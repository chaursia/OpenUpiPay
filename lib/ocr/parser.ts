/**
 * OCR Parser — Extracts UTR and amount from UPI payment screenshots.
 *
 * Uses Tesseract.js for in-process OCR on base64-encoded images.
 * Optimized for common Indian UPI app UI patterns (GPay, PhonePe, BHIM, Paytm).
 */

// UTR pattern: exactly 12 digits (sometimes prefixed with "UTR:", "Ref:", "UPI Ref" etc.)
const UTR_PATTERNS = [
  /\bUTR[:\s#]*([0-9]{12})\b/i,
  /\bRef(?:erence)?[:\s#]*([0-9]{12})\b/i,
  /\bUPI\s*Ref[:\s#]*([0-9]{12})\b/i,
  /\bTransaction\s*ID[:\s#]*([0-9]{12})\b/i,
  /\bTxn\s*(?:ID|Ref)?[:\s#]*([0-9]{12})\b/i,
  /\b([0-9]{12})\b/, // fallback: bare 12-digit number
];

// Amount patterns: ₹1,234.56 | Rs. 100.00 | INR 500 | ₹100
const AMOUNT_PATTERNS = [
  /[₹Rs\.INR\s]+([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /(?:paid|sent|amount)[:\s]*[₹Rs\.INR\s]*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /([0-9,]+\.[0-9]{2})\s*(?:INR|₹)/i,
];

export interface OcrResult {
  utr: string | null;
  amount: number | null;
  rawText: string;
  confidence: number;
}

/**
 * Extracts UTR and amount from OCR text using regex patterns.
 * This is the pure extraction logic, decoupled from the OCR engine.
 */
export function extractPaymentData(rawText: string): Omit<OcrResult, "confidence"> {
  let utr: string | null = null;
  let amount: number | null = null;

  // Extract UTR
  for (const pattern of UTR_PATTERNS) {
    const match = rawText.match(pattern);
    if (match?.[1]) {
      utr = match[1].trim();
      break;
    }
  }

  // Extract amount
  for (const pattern of AMOUNT_PATTERNS) {
    const match = rawText.match(pattern);
    if (match?.[1]) {
      const cleaned = match[1].replace(/,/g, "");
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
        break;
      }
    }
  }

  return { utr, amount, rawText };
}

/**
 * Runs Tesseract OCR on a base64-encoded image and extracts payment data.
 * Falls back gracefully if Tesseract is unavailable.
 *
 * @param imageBase64 - Base64 encoded image (JPEG, PNG, WebP)
 */
export async function parsePaymentScreenshot(
  imageBase64: string
): Promise<OcrResult> {
  try {
    // Dynamic import to avoid issues in environments without canvas support
    const Tesseract = await import("tesseract.js");

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64, "base64");

    const { data } = await Tesseract.recognize(imageBuffer, "eng", {
      logger: () => {}, // Suppress progress logs
    });

    const result = extractPaymentData(data.text);
    return {
      ...result,
      confidence: data.confidence,
    };
  } catch (err) {
    console.error("[OCR] Tesseract failed:", err);
    return {
      utr: null,
      amount: null,
      rawText: "",
      confidence: 0,
    };
  }
}
