"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Key,
  CreditCard,
  Settings,
  Zap,
  Radio,
  LogOut,
  ClipboardList,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

const navLinks = [
  { href: "/admin",          label: "Dashboard",   icon: LayoutDashboard },
  { href: "/admin/vpas",     label: "UPI / VPAs",  icon: CreditCard      },
  { href: "/admin/keys",     label: "API Keys",    icon: Key             },
  { href: "/admin/orders",   label: "All Orders",  icon: ClipboardList   },
  { href: "/admin/settings", label: "Settings",    icon: Settings        },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router   = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ── Sidebar ──────────────────────────────────── */}
      <aside className="sidebar">
        {/* Logo */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.75rem",
              background: "var(--color-yellow)",
              border: "2.5px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow)",
            }}
          >
            <Zap size={20} strokeWidth={2.5} />
            <span
              style={{
                fontFamily: "var(--font-space)",
                fontWeight: 800,
                fontSize: "1rem",
              }}
            >
              OpenPayUPI
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
            flex: 1,
          }}
        >
          <p
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--color-text-muted)",
              padding: "0 0.875rem",
              marginBottom: "0.25rem",
              marginTop: "0.5rem",
            }}
          >
            Navigation
          </p>

          {navLinks.map(({ href, label, icon: Icon }) => {
            // Exact match for /admin, prefix match for sub-pages
            const isActive =
              href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                className={`sidebar-link ${isActive ? "active" : ""}`}
              >
                <Icon size={16} strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: sign-out + version */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <button
            onClick={handleSignOut}
            className="sidebar-link"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              width: "100%",
              border: "none",
              cursor: "pointer",
              background: "none",
              color: "var(--color-coral)",
              fontWeight: 600,
              fontSize: "0.875rem",
              padding: "0.6rem 0.875rem",
              borderRadius: "var(--radius-sm)",
              borderColor: "transparent",
            }}
          >
            <LogOut size={16} strokeWidth={2} />
            Sign Out
          </button>

          <div
            style={{
              padding: "0.75rem",
              background: "var(--color-surface-2)",
              border: "1.5px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.75rem",
              color: "var(--color-text-muted)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
              }}
            >
              <Radio size={12} />
              <span style={{ fontWeight: 600 }}>Admin Panel</span>
            </div>
            <p style={{ marginTop: "0.25rem", fontSize: "0.65rem" }}>
              OpenPayUPI v1.0
            </p>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────── */}
      <main
        style={{
          flex: 1,
          marginLeft: "240px",
          minHeight: "100vh",
          background: "var(--color-bg)",
        }}
      >
        {/* Top bar */}
        <header
          style={{
            height: "56px",
            background: "var(--color-surface)",
            borderBottom: "2.5px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 1.5rem",
            position: "sticky",
            top: 0,
            zIndex: 30,
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-space)",
              fontSize: "1rem",
              fontWeight: 700,
            }}
          >
            {navLinks.find((l) =>
              l.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(l.href)
            )?.label ?? "Admin"}
          </h1>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span className="rt-pulse" />
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--color-text-muted)",
              }}
            >
              Realtime Active
            </span>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
