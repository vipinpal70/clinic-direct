// Dependency-free constants for webhook capture/audit — safe to import from
// client components (lib/webhook-capture.ts pulls in Prisma and crypto).

export type WebhookEndpoint = "shopify" | "clinic-data" | "clinic-order-data";

export const WEBHOOK_ENDPOINTS: WebhookEndpoint[] = [
  "shopify",
  "clinic-data",
  "clinic-order-data",
];

export type WebhookEventStatus =
  | "received"
  | "processed"
  | "failed"
  | "rejected"
  | "error";
