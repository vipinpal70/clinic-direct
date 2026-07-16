import { Eye, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
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
            {[
              { label: "Active clinics", value: "7" },
              { label: "Orders this month", value: "415" },
              { label: "Commission payable", value: "£48,920" },
              { label: "Platform uptime", value: "99.98%" },
            ].map((s) => (
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

          <form className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-xs">
                Email address
              </Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@clinicdirect.co.uk"
                  className="pl-9"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="password" className="text-xs">
                  Password
                </Label>
                <a
                  href="#"
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9 pr-9"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full mt-2">
              Sign in
            </Button>
          </form>

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
