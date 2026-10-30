import type { Metadata } from "next";
import { LoginForm } from "@/app/admin/login/login-form";

export const metadata: Metadata = { title: "Admin-Login | Lean's Crispy Chicken", robots: { index: false } };

export default function AdminLoginPage() {
  return (
    <main className="wrap status-page">
      <p className="eyebrow">Admin</p>
      <h1>
        <span className="brush">Login</span>
      </h1>
      <p className="lead">Bestellungen, Produktion und Lieferstatus für Lean&apos;s Crispy Chicken.</p>
      <LoginForm />
    </main>
  );
}
