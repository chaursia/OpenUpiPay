"use client";

import { useState } from "react";
import { Settings, Info, ExternalLink, Mail, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

type SettingItem = {
  label:   string;
  envKey:  string;
  hint:    string;
  type?:   "secret" | "url" | "text";
  required?: boolean;
};

const ENV_SETTINGS: { section: string; icon?: React.ReactNode; items: SettingItem[] }[] = [
  {
    section: "Email IMAP Scraper (UPI Payment Interception)",
    items: [
      { label: "IMAP Host",      envKey: "IMAP_HOST",     hint: "e.g. imap.gmail.com or outlook.office365.com", type: "text",   required: true },
      { label: "IMAP Port",      envKey: "IMAP_PORT",     hint: "Default: 993 (SSL/TLS)",                        type: "text",   required: false },
      { label: "IMAP SSL/TLS",   envKey: "IMAP_SECURE",   hint: "Default: true",                                 type: "text",   required: false },
      { label: "IMAP User",      envKey: "IMAP_USER",     hint: "Your email address (e.g. alerts@yourdomain.com)", type: "text", required: true },
      { label: "IMAP Password",  envKey: "IMAP_PASSWORD", hint: "App Password for Gmail/Outlook (NOT normal password)", type: "secret", required: true },
      { label: "IMAP Mailbox",   envKey: "IMAP_MAILBOX",  hint: "Default: INBOX",                                type: "text",   required: false },
    ],
  },
  {
    section: "Supabase Database & Realtime",
    items: [
      { label: "Project URL",         envKey: "NEXT_PUBLIC_SUPABASE_URL",      hint: "Found in Supabase → Project Settings → API",                       type: "url",    required: true },
      { label: "Anon Public Key",     envKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY", hint: "Safe to expose in browser. Controls RLS-guarded reads.",            type: "secret", required: true },
      { label: "Service Role Key",    envKey: "SUPABASE_SERVICE_ROLE_KEY",      hint: "Admin-level key- NEVER expose to browser or commit to git.",       type: "secret", required: true },
    ],
  },
  {
    section: "Application & Security",
    items: [
      { label: "App URL",             envKey: "NEXT_PUBLIC_APP_URL",           hint: "Your deployed URL, e.g. http://localhost:3000 or https://pay.domain.com", type: "url",    required: true },
      { label: "Cron Secret",         envKey: "CRON_SECRET",                   hint: "Random secret for protecting /api/v1/cron/* endpoints.",           type: "secret", required: true },
      { label: "Client API Key",      envKey: "NEXT_PUBLIC_CLIENT_API_KEY",    hint: "Public CLIENT key for checkout page fallback UTR and OCR upload.", type: "secret", required: true },
    ],
  },
];

const LINKS = [
  { label: "Google App Passwords Setup",   url: "https://myaccount.google.com/apppasswords", desc: "Generate a 16-character App Password for Gmail IMAP" },
  { label: "Supabase Dashboard",          url: "https://supabase.com/dashboard",        desc: "Manage DB, Auth, and RLS policies" },
  { label: "Supabase Auth Users",         url: "https://supabase.com/dashboard",        desc: "Add or manage Admin panel users" },
  { label: "Vercel Cron Configuration",   url: "https://vercel.com/docs/cron-jobs",     desc: "Auto-call /api/v1/cron/email-poll & /cleanup every minute" },
];

export default function SettingsPage() {
  const [testingImap, setTestingImap] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const handleTestImap = async () => {
    setTestingImap(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/admin/email/test", { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success) {
        setTestResult({
          success: true,
          message: `${json.message} Found ${json.unseenCount} unseen email(s).`,
        });
      } else {
        setTestResult({
          success: false,
          error: json.error || "Failed to connect to IMAP server",
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        error: (err as Error).message,
      });
    } finally {
      setTestingImap(false);
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: "860px" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: "var(--font-space)", fontSize: "1.5rem", fontWeight: 800 }}>Gateway Settings & Configuration</h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
          Configure Email IMAP scraping, Supabase integration, and system automation.
        </p>
      </div>

      {/* Email IMAP Quick Setup Banner */}
      <div className="brut-card" style={{ padding: "1.5rem", marginBottom: "2rem", background: "var(--color-surface)", border: "2.5px solid var(--color-border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div style={{ padding: "0.5rem", background: "var(--color-yellow)", border: "2px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}>
              <Mail size={20} />
            </div>
            <div>
              <h2 style={{ fontFamily: "var(--font-space)", fontWeight: 800, fontSize: "1.1rem" }}>
                Email IMAP Payment Interceptor
              </h2>
              <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                Automatically verify incoming payments via bank and UPI email alerts
              </p>
            </div>
          </div>

          <button
            className="brut-btn brut-btn-yellow brut-btn-sm"
            onClick={handleTestImap}
            disabled={testingImap}
          >
            {testingImap ? (
              <>
                <RefreshCw size={14} className="animate-spin-slow" /> Connecting...
              </>
            ) : (
              <>
                <Mail size={14} /> Test IMAP Connection
              </>
            )}
          </button>
        </div>

        {testResult && (
          <div
            className="animate-slide-in"
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "var(--radius-sm)",
              border: "2px solid",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: testResult.success ? "#D4EDDA" : "#F8D7DA",
              borderColor: testResult.success ? "var(--color-green)" : "var(--color-coral)",
              color: testResult.success ? "#155724" : "#721C24",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{testResult.success ? testResult.message : testResult.error}</span>
          </div>
        )}

        <div style={{ background: "var(--color-surface-2)", padding: "1rem", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--color-border)", fontSize: "0.82rem" }}>
          <p style={{ fontWeight: 700, marginBottom: "0.5rem", fontFamily: "var(--font-space)" }}>
            ⚡ How to set up Gmail / Bank Email Interception:
          </p>
          <ol style={{ paddingLeft: "1.2rem", lineHeight: 1.7, color: "var(--color-text)" }}>
            <li>Open Google Account → <strong>Security</strong> → Enable <strong>2-Step Verification</strong>.</li>
            <li>Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, textDecoration: "underline" }}>Google App Passwords</a> and generate a password for &quot;Mail&quot;.</li>
            <li>Add <code>IMAP_HOST=imap.gmail.com</code>, <code>IMAP_USER=your-email@gmail.com</code>, and <code>IMAP_PASSWORD=your-16-char-app-password</code> into your <code>.env.local</code> file.</li>
            <li>Click <strong>Test IMAP Connection</strong> above to verify!</li>
          </ol>
        </div>
      </div>

      {/* Info banner */}
      <div className="brut-card-flat" style={{ padding: "1rem 1.25rem", marginBottom: "2rem", display: "flex", gap: "0.75rem", alignItems: "flex-start", background: "#CCE5FF", borderColor: "#003466" }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: "1px", color: "#003466" }} />
        <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#003466" }}>
          All environment settings are defined in <code>.env.local</code> (or hosting provider env vars).
          Restart the dev server after editing <code>.env.local</code>.
        </p>
      </div>

      {/* Env sections */}
      {ENV_SETTINGS.map(section => (
        <div key={section.section} style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontFamily: "var(--font-space)", fontWeight: 700, fontSize: "1rem", marginBottom: "0.875rem" }}>
            {section.section}
          </h2>
          <div className="brut-card" style={{ padding: 0, overflow: "hidden" }}>
            {section.items.map((item, i) => (
              <div
                key={item.envKey}
                style={{
                  padding: "1rem 1.25rem",
                  borderBottom: i < section.items.length - 1 ? "1.5px solid var(--color-surface-2)" : "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.375rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>{item.label}</span>
                  {item.required && (
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--color-coral)", border: "1px solid var(--color-coral)", padding: "1px 5px", borderRadius: "3px" }}>
                      REQUIRED
                    </span>
                  )}
                </div>
                <code
                  style={{
                    fontSize: "0.78rem",
                    fontFamily: "monospace",
                    background: "var(--color-surface-2)",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1.5px solid var(--color-border)",
                    display: "inline-block",
                  }}
                >
                  {item.envKey}
                </code>
                <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>{item.hint}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* .env.local template */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontFamily: "var(--font-space)", fontWeight: 700, fontSize: "1rem", marginBottom: "0.875rem" }}>
          Full .env.local Configuration Template
        </h2>
        <div className="brut-card-flat" style={{ padding: 0, overflow: "hidden" }}>
          <pre
            style={{
              margin: 0,
              padding: "1.25rem",
              fontFamily: "monospace",
              fontSize: "0.78rem",
              lineHeight: 1.7,
              overflowX: "auto",
              background: "#1a1a1a",
              color: "#e8e8e8",
            }}
          >
{`# ── Supabase ────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ── App & Security ──────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=your-random-cron-secret-here
NEXT_PUBLIC_CLIENT_API_KEY=client_k_your_key_here

# ── Email IMAP Scraper (UPI Receipt Interception) ───────
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=your-upi-alerts-email@gmail.com
IMAP_PASSWORD=your-google-app-password
IMAP_MAILBOX=INBOX`}
          </pre>
        </div>
      </div>

      {/* Quick links */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontFamily: "var(--font-space)", fontWeight: 700, fontSize: "1rem", marginBottom: "0.875rem" }}>
          Quick Links
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {LINKS.map(link => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="brut-card-flat"
              style={{
                padding: "0.875rem 1.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                textDecoration: "none",
                color: "inherit",
                transition: "box-shadow 0.1s",
              }}
            >
              <div>
                <p style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.15rem" }}>{link.label}</p>
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{link.desc}</p>
              </div>
              <ExternalLink size={14} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
            </a>
          ))}
        </div>
      </div>

      {/* Automated Cron Endpoints */}
      <div>
        <h2 style={{ fontFamily: "var(--font-space)", fontWeight: 700, fontSize: "1rem", marginBottom: "0.875rem" }}>
          Automated Cron Endpoints
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="brut-card-flat" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.625rem" }}>
              <Mail size={16} />
              <span style={{ fontWeight: 700, fontSize: "0.875rem", fontFamily: "var(--font-space)" }}>Poll Emails for Payments</span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginBottom: "0.75rem" }}>
              Checks IMAP inbox for unread payment emails, extracts UTR & amounts, and marks matching orders as PAID.
            </p>
            <code style={{ fontSize: "0.72rem", display: "block", background: "var(--color-surface-2)", padding: "0.375rem 0.5rem", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--color-border)" }}>
              POST /api/v1/cron/email-poll
            </code>
          </div>
          <div className="brut-card-flat" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.625rem" }}>
              <Settings size={16} />
              <span style={{ fontWeight: 700, fontSize: "0.875rem", fontFamily: "var(--font-space)" }}>Cleanup Stale Orders</span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginBottom: "0.75rem" }}>
              Marks expired orders as EXPIRED and resets daily VPA transaction counters.
            </p>
            <code style={{ fontSize: "0.72rem", display: "block", background: "var(--color-surface-2)", padding: "0.375rem 0.5rem", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--color-border)" }}>
              POST /api/v1/cron/cleanup
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
