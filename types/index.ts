/* ─── Enums ─────────────────────────────────────────────────── */

export type ClinicStatus = "active" | "pending" | "suspended" | "inactive";
export type AgreementStatus = "not_sent" | "sent" | "viewed" | "accepted";
export type ApprovalStage =
  | "created"
  | "sent"
  | "viewed"
  | "accepted"
  | "approved";

export type OrderStatus =
  | "pending"
  | "processing"
  | "fulfilled"
  | "refunded"
  | "cancelled";

export type CommissionStatus = "payable" | "approved" | "paid" | "cancelled";
export type InvoiceStatus = "draft" | "issued" | "pushed" | "paid" | "voided";

export type UserRole =
  | "super_admin"
  | "admin"
  | "finance"
  | "support"
  | "read_only";
export type UserStatus = "active" | "invited" | "suspended";

/* ─── Domain Models ─────────────────────────────────────────── */

export interface Clinic {
  id: string;
  name: string;
  code: string;
  email: string;
  phone?: string;
  status: ClinicStatus;
  agreement: AgreementStatus;
  commissionPct: number;
  joined: string;
  address?: string;
  website?: string;
  notes?: string;
  ordersMtd: number;
  monthSales: number;
  totalCommission: number;
  loginEmail?: string;
}

export interface Order {
  id: string;
  shopifyId: string;
  number: string;
  clinicId: string;
  clinicName: string;
  clinicCode: string;
  status: OrderStatus;
  total: number;
  commission: number;
  items: number;
  customer: string;
  createdAt: string;
}

export interface CommissionRecord {
  id: string;
  clinicId: string;
  clinicName: string;
  clinicCode: string;
  period: string;
  gross: number;
  commission: number;
  rate: number;
  status: CommissionStatus;
}

export interface Invoice {
  id: string;
  number: string;
  clinicId: string;
  clinic: string;
  commission: number;
  vat: number;
  total: number;
  status: InvoiceStatus;
  date: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  twoFa: boolean;
  status: UserStatus;
  lastActive: string;
}

export interface AuditEntry {
  id: string;
  time: string;
  userEmail: string;
  action: string;
  target: string;
  prev: string;
  next: string;
  ip: string;
}

/* ─── Dashboard ─────────────────────────────────────────────── */

export interface DashboardKpi {
  label: string;
  value: string | number;
  hint?: string;
  delta?: { value: string; positive: boolean };
}

export interface MonthlyDataPoint {
  m: string;
  revenue: number;
  commission: number;
  orders: number;
}

export interface ProductOrderPoint {
  name: string;
  orders: number;
}

/* ─── Filters / Pagination ──────────────────────────────────── */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface TableMeta {
  pagination: PaginationMeta;
}
