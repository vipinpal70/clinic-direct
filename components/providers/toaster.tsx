"use client";

import { Toaster as HotToaster } from "react-hot-toast";

/**
 * App-wide toast host. Mounted once in the root layout so any client component
 * can call `toast.success(...)` / `toast.error(...)` (see lib/toast.ts).
 */
export function Toaster() {
  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: "hsl(var(--card, 0 0% 100%))",
          color: "hsl(var(--foreground, 222 47% 11%))",
          border: "1px solid hsl(var(--border, 214 32% 91%))",
          fontSize: "14px",
        },
        success: { iconTheme: { primary: "#059669", secondary: "#fff" } },
        error: { iconTheme: { primary: "#dc2626", secondary: "#fff" } },
      }}
    />
  );
}
