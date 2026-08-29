import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "OpenPayUPI",
  description: "Contact Developer - swikki099@gmail.com",
};

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
        color: "#F8FAFC",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "rgba(30, 41, 59, 0.8)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "24px",
          padding: "2.5rem 2rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, #38BDF8 0%, #2563EB 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.5rem",
            boxShadow: "0 10px 25px -5px rgba(37, 99, 235, 0.5)",
          }}
        >
          <Mail size={28} color="#FFFFFF" />
        </div>

        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            margin: "0 0 0.5rem 0",
            color: "#FFFFFF",
          }}
        >
          Contact Developer
        </h1>

        <p
          style={{
            fontSize: "0.9rem",
            color: "#94A3B8",
            margin: "0 0 1.75rem 0",
            lineHeight: 1.5,
          }}
        >
          For inquiries, integration support, or custom setups, get in touch below.
        </p>

        <a
          href="mailto:swikki099@gmail.com"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            width: "100%",
            padding: "0.85rem 1.25rem",
            borderRadius: "12px",
            background: "#2563EB",
            color: "#FFFFFF",
            fontWeight: 600,
            fontSize: "0.95rem",
            textDecoration: "none",
            boxShadow: "0 4px 14px 0 rgba(37, 99, 235, 0.39)",
            transition: "all 0.2s ease",
          }}
        >
          <span>swikki099@gmail.com</span>
          <ArrowRight size={16} />
        </a>

      </div>
    </main>
  );
}
