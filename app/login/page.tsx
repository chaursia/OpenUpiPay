import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign In — OpenPayUPI Admin",
  description: "Sign in to the OpenPayUPI admin dashboard",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><div className="spinner" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
