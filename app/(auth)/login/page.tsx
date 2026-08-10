import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getDashboardStats } from "@/lib/stats";
import { currency } from "@/lib/utils";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [activeClinics, stats] = await Promise.all([
    prisma.clinic.count({ where: { status: "active" } }),
    getDashboardStats(),
  ]);
  const currentMonth = stats.monthlyRevenue[stats.monthlyRevenue.length - 1];

  const heroStats = [
    { label: "Active clinics", value: String(activeClinics) },
    { label: "Orders this month", value: String(stats.ordersMtd) },
    { label: "Commission payable", value: currency(stats.totalCommissionPayable) },
    { label: "Monthly revenue", value: currency(currentMonth?.revenue ?? 0) },
  ];

  return (
    <div className="min-h-screen bg-primary flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background gradient orbs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-info/20 blur-3xl" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="h-10 w-10 rounded-xl bg-white/15 text-white flex items-center justify-center font-bold text-lg font-display">
            CD
          </div>
          <div>
            <div className="text-white font-semibold font-display">
              Clinic Direct
            </div>
            <div className="text-white/60 text-xs">Admin platform</div>
          </div>
        </div>

        {/* Tagline */}
        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white font-display leading-tight mb-4">
            Manage your clinic network with precision
          </h1>
          <p className="text-white/70 text-base">
            Track commissions, process orders, manage approvals, and stay in
            control of every clinic in your network — from one unified platform.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4">
            {heroStats.map((s) => (
              <div
                key={s.label}
                className="bg-white/10 rounded-xl p-4 border border-white/15"
              >
                <div className="text-2xl font-bold text-white font-display">
                  {s.value}
                </div>
                <div className="text-xs text-white/60 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold font-display">
              CD
            </div>
            <span className="font-semibold font-display">Clinic Direct Admin</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold font-display">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to your admin account
            </p>
          </div>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>

          <p className="text-xs text-center text-muted-foreground mt-6">
            Need access?{" "}
            <a
              href="mailto:admin@clinicdirect.co.uk"
              className="text-primary hover:underline"
            >
              Contact the admin team
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
