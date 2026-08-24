"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Zap, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get("redirectTo") ?? "/admin";

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(redirectTo);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email:    email.trim(),
      password,
    });

    setLoading(false);

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Wrong email or password. Please try again."
          : authError.message
      );
    } else {
      router.push(redirectTo);
      router.refresh();
    }
  };

  return (
    <div
      style={{
        minHeight:       "100vh",
        background:      "var(--color-bg)",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        padding:         "1.5rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "400px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              display:       "inline-flex",
              alignItems:    "center",
              gap:           "0.625rem",
              padding:       "0.75rem 1.25rem",
              background:    "var(--color-yellow)",
              border:        "2.5px solid var(--color-border)",
              borderRadius:  "var(--radius-md)",
              boxShadow:     "var(--shadow)",
              marginBottom:  "1.25rem",
            }}
          >
            <Zap size={20} strokeWidth={2.5} />
            <span style={{ fontFamily: "var(--font-space)", fontWeight: 800, fontSize: "1.1rem" }}>
              OpenPayUPI
            </span>
          </div>
          <h1 style={{ fontFamily: "var(--font-space)", fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.375rem" }}>
            Admin Sign In
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
            Access your payment gateway dashboard
          </p>
        </div>

        {/* Card */}
        <div className="brut-card" style={{ padding: "2rem" }}>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                style={{ display: "block", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.375rem", fontFamily: "var(--font-space)" }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                className="brut-input"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                style={{ display: "block", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.375rem", fontFamily: "var(--font-space)" }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  className="brut-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: "2.75rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  style={{
                    position:   "absolute",
                    right:      "0.75rem",
                    top:        "50%",
                    transform:  "translateY(-50%)",
                    background: "none",
                    border:     "none",
                    cursor:     "pointer",
                    color:      "var(--color-text-muted)",
                    display:    "flex",
                    alignItems: "center",
                    padding:    0,
                  }}
                  tabIndex={-1}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="animate-slide-in"
                style={{
                  display:     "flex",
                  alignItems:  "flex-start",
                  gap:         "0.5rem",
                  padding:     "0.75rem",
                  background:  "#F8D7DA",
                  border:      "2px solid var(--color-coral)",
                  borderRadius: "var(--radius-sm)",
                  fontSize:    "0.82rem",
                  color:       "#721C24",
                  fontWeight:  600,
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: "1px" }} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="brut-btn brut-btn-yellow"
              style={{ width: "100%", justifyContent: "center", fontSize: "0.95rem", padding: "0.7rem", marginTop: "0.25rem" }}
              disabled={loading}
            >
              {loading ? (
                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              ) : (
                "Sign In →"
              )}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "1.25rem" }}>
          Admin accounts are managed in{" "}
          <strong>Supabase → Authentication → Users</strong>.
        </p>
      </div>
    </div>
  );
}
