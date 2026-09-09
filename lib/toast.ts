import toast from "react-hot-toast";

// Centralised toast copy for admin-triggered emails so every send —
// Profile completion, Agreement, Invoice, Payment reminder — reads the same.
export type EmailKind =
  | "Profile completion"
  | "Agreement"
  | "Invoice"
  | "Payment reminder";

export function notifyEmailSent(kind: EmailKind, recipient?: string | null) {
  return toast.success(
    `${kind} email sent${recipient ? ` to ${recipient}` : ""}`,
  );
}

export function notifyEmailFailed(kind: EmailKind, error?: string | null) {
  return toast.error(
    `Failed to send ${kind.toLowerCase()} email${error ? `: ${error}` : ""}`,
  );
}

export { toast };
