import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { Readable } from "stream";

// ── UPI email patterns ────────────────────────────────────────────────────────
// Covers: PhonePe, GPay, Paytm, BHIM, NPCI, bank alerts
const UTR_PATTERNS = [
  /\b([A-Z]{2}\d{10,})\b/,           // Standard UTR: e.g. PYTM123456789012
  /UTR[:\s#]+([A-Z0-9]{10,20})/i,    // "UTR: 123456789012"
  /Ref(?:erence)?[:\s#]+([A-Z0-9]{10,20})/i,
  /Transaction\s*ID[:\s#]+([A-Z0-9]{10,20})/i,
  /\b(\d{12})\b/,                     // Plain 12-digit numeric UTR
];

const AMOUNT_PATTERNS = [
  /(?:Rs|INR|₹)[.\s]*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:Rs|INR|₹)/i,
  /(?:amount|paid|received|credited)[:\s]+(?:Rs|INR|₹)?[.\s]*([0-9,]+(?:\.[0-9]{1,2})?)/i,
];

// UPI payment notification senders / subject keywords
const UPI_SENDER_KEYWORDS = [
  "noreply@phonepe", "alerts@gpay", "noreply@paytm",
  "alerts@paytm", "bhimupi", "upi@", "noreply@upi",
  "payments@", "alerts@sbi", "alerts@hdfcbank",
  "alerts@icicibank", "alerts@axisbank", "alerts@kotakbank",
  "noreply@ybl", "notify@",
];

const UPI_SUBJECT_KEYWORDS = [
  "upi", "payment received", "money received", "credited",
  "received", "alert", "transaction", "bhim", "gpay",
  "phonepe", "paytm",
];

export interface ParsedEmail {
  uid: number;
  subject: string;
  from: string;
  date: Date;
  bodyText: string;
  amount: number | null;
  utr: string | null;
  isUpiNotification: boolean;
}

function extractAmount(text: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const cleaned = match[1].replace(/,/g, "");
      const num = parseFloat(cleaned);
      if (!isNaN(num) && num > 0 && num < 10_000_000) return num;
    }
  }
  return null;
}

function extractUtr(text: string): string | null {
  for (const pattern of UTR_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const utr = match[1].trim();
      if (utr.length >= 10) return utr;
    }
  }
  return null;
}

function isUpiEmail(from: string, subject: string, body: string): boolean {
  const fromLower    = from.toLowerCase();
  const subjectLower = subject.toLowerCase();
  const bodyLower    = body.toLowerCase();

  const senderMatch  = UPI_SENDER_KEYWORDS.some(k => fromLower.includes(k));
  const subjectMatch = UPI_SUBJECT_KEYWORDS.some(k => subjectLower.includes(k));
  const bodyMatch    = bodyLower.includes("upi") || bodyLower.includes("utr");

  return senderMatch || (subjectMatch && bodyMatch);
}

export interface ImapConfig {
  host:     string;
  port:     number;
  secure:   boolean;   // true = TLS (993), false = STARTTLS (143)
  user:     string;
  password: string;
  mailbox:  string;    // default: "INBOX"
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Reads unseen UPI payment notification emails via IMAP.
 * Marks them as SEEN after reading.
 * Returns parsed results with amount + UTR extracted.
 *
 * Robustness: all network waits are hard-capped so the Vercel function
 * never hangs for 300s. Late socket errors are swallowed to avoid
 * "Uncaught Exception: Socket timeout" crashes.
 */
export async function fetchUnseenUpiEmails(
  config: ImapConfig,
  maxEmails = 20
): Promise<ParsedEmail[]> {
  let client: ImapFlow | null = null;

  try {
    client = new ImapFlow({
      host:   config.host,
      port:   config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
      logger: false,
      // Fail fast — defaults are 90s/300s which hit Vercel's 300s wall.
      greetingTimeout:   10_000,
      connectionTimeout: 10_000,
      socketTimeout:     15_000,
    });

    // ImapFlow's socket can emit 'error' AFTER our await has already
    // thrown — without a listener that becomes an Uncaught Exception.
    client.on("error", () => {});

    await withTimeout(client.connect(), 12_000, "IMAP connect");

    const lock = await withTimeout(
      client.getMailboxLock(config.mailbox),
      10_000,
      "Mailbox lock"
    );

    const results: ParsedEmail[] = [];

    try {
      const searchResult = await withTimeout(
        client.search({ seen: false }) as Promise<unknown>,
        10_000,
        "IMAP search"
      );
      const uids = Array.isArray(searchResult) ? searchResult as number[] : [];
      const recentUids = uids.slice(-maxEmails);

      if (recentUids.length === 0) {
        return [];
      }

      for await (const msg of client.fetch(
        recentUids.join(","),
        { uid: true, envelope: true, source: true }
      )) {
        try {
          const sourceBuffer = (msg as { source?: Uint8Array }).source;
          if (!sourceBuffer) continue;

          const stream = Readable.from(sourceBuffer);
          const parsed = await simpleParser(stream);

          const from    = parsed.from?.text ?? "";
          const subject = parsed.subject ?? "";
          const htmlText = typeof parsed.html === "string" ? parsed.html : "";
          const body    = parsed.text || htmlText || "";
          const date    = parsed.date ?? new Date();

          const isUpi   = isUpiEmail(from, subject, body);
          const amount  = isUpi ? extractAmount(body) : null;
          const utr     = isUpi ? extractUtr(body) : null;

          results.push({
            uid:               (msg as { uid: number }).uid,
            subject,
            from,
            date,
            bodyText:          body.slice(0, 2000),
            amount,
            utr,
            isUpiNotification: isUpi,
          });

          await withTimeout(
            client.messageFlagsAdd({ uid: (msg as { uid: number }).uid }, ["\\Seen"]) as Promise<unknown>,
            5_000,
            "Flag SEEN"
          ).catch(() => {});
        } catch (parseErr) {
          console.warn("[IMAP] Failed to parse message:", parseErr);
        }
      }
    } finally {
      try { lock.release(); } catch { /* ignore */ }
    }

    // Graceful close — don't let a dead socket hang the function
    await withTimeout(client.logout(), 5_000, "IMAP logout").catch(() => {
      try { client?.close(); } catch { /* ignore */ }
    });

    return results;
  } catch (err) {
    // Ensure the socket is destroyed without awaiting a hanging LOGOUT.
    if (client) {
      try { client.close(); } catch { /* ignore */ }
    }
    throw err;
  }
}

/**
 * Build ImapConfig from environment variables.
 */
export function getImapConfigFromEnv(): ImapConfig {
  const host     = process.env.IMAP_HOST;
  const user     = process.env.IMAP_USER;
  const password = process.env.IMAP_PASSWORD;

  if (!host || !user || !password) {
    throw new Error(
      "Missing IMAP configuration. Please set IMAP_HOST, IMAP_USER, and IMAP_PASSWORD in .env.local"
    );
  }

  return {
    host,
    port:    parseInt(process.env.IMAP_PORT ?? "993"),
    secure:  (process.env.IMAP_SECURE ?? "true") === "true",
    user,
    password,
    mailbox: process.env.IMAP_MAILBOX ?? "INBOX",
  };
}
