import { NextResponse } from "next/server";
import { fetchUnseenUpiEmails, getImapConfigFromEnv } from "@/lib/email/imapPoller";

/**
 * POST /api/v1/admin/email/test
 * Tests the IMAP configuration and returns connection status + sample emails parsed.
 */
export async function POST() {
  try {
    const imapConfig = getImapConfigFromEnv();
    const emails = await fetchUnseenUpiEmails(imapConfig, 5);

    return NextResponse.json({
      success: true,
      message: `Successfully connected to ${imapConfig.host}:${imapConfig.port}!`,
      mailbox: imapConfig.mailbox,
      unseenCount: emails.length,
      sampleResults: emails.map(e => ({
        subject: e.subject,
        from: e.from,
        amount: e.amount,
        utr: e.utr,
        isUpiNotification: e.isUpiNotification,
        date: e.date,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 400 }
    );
  }
}
