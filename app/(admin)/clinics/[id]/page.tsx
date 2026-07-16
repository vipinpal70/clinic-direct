import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Globe,
  Percent,
  ShoppingBag,
  FileText,
  Key,
  Edit,
  ExternalLink,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { clinics, orders } from "@/lib/mock";
import { currency, dateFmt, relativeTime } from "@/lib/utils";
import type { ClinicStatus } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

const statusTone: Record<ClinicStatus, "success" | "warning" | "destructive" | "muted"> = {
  active: "success",
  pending: "warning",
  suspended: "destructive",
  inactive: "muted",
};

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const clinic = clinics.find((c) => c.id === id);
  return { title: clinic?.name ?? "Clinic" };
}

export default async function ClinicProfilePage({ params }: Props) {
  const { id } = await params;
  const clinic = clinics.find((c) => c.id === id);
  if (!clinic) notFound();

  const clinicOrders = orders.filter((o) => o.clinicId === clinic.id);
  const clinicCodeOrders = orders.filter((o) => o.clinicCode === clinic.code);
  const totalCommission = Math.round(
    (clinic.monthSales * clinic.commissionPct) / 100,
  );

  return (
    <>
      <PageHeader
        title={clinic.name}
        description={`${clinic.code} · Joined ${dateFmt(clinic.joined)}`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/clinics">
                <ArrowLeft className="h-4 w-4" />
                All clinics
              </Link>
            </Button>
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4" />
              Portal link
            </Button>
            <Button size="sm">
              <Edit className="h-4 w-4" />
              Edit clinic
            </Button>
          </>
        }
      />
      <PageBody>
        {/* Status + KPIs */}
        <div className="flex items-center gap-3 flex-wrap">
          <StatusPill tone={statusTone[clinic.status]} className="text-sm px-3 py-1">
            {clinic.status}
          </StatusPill>
          <StatusPill
            tone={
              clinic.agreement === "accepted"
                ? "success"
                : clinic.agreement === "viewed"
                  ? "info"
                  : clinic.agreement === "sent"
                    ? "warning"
                    : "muted"
            }
          >
            Agreement {clinic.agreement.replace("_", " ")}
          </StatusPill>
          <span className="text-xs text-muted-foreground ml-1">
            Commission: <strong>{clinic.commissionPct}%</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Orders MTD"
            value={clinic.ordersMtd}
            hint="This month"
            icon={<ShoppingBag className="h-4 w-4" />}
          />
          <StatCard
            label="Sales MTD"
            value={currency(clinic.monthSales)}
            hint="Gross revenue"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            label="Commission MTD"
            value={currency(totalCommission)}
            hint={`${clinic.commissionPct}% rate`}
            icon={<Percent className="h-4 w-4" />}
          />
          <StatCard
            label="Total commission"
            value={currency(clinic.totalCommission)}
            hint="All time"
            icon={<FileText className="h-4 w-4" />}
          />
        </div>

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="orders">Orders ({clinicOrders.length})</TabsTrigger>
            <TabsTrigger value="clinic-code">Clinic code orders</TabsTrigger>
            <TabsTrigger value="credentials">Login credentials</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title="Contact information">
                <div className="p-5 space-y-4">
                  <Field
                    icon={<Mail className="h-4 w-4" />}
                    label="Email"
                    value={clinic.email}
                  />
                  {clinic.phone && (
                    <Field
                      icon={<Phone className="h-4 w-4" />}
                      label="Phone"
                      value={clinic.phone}
                    />
                  )}
                  {clinic.address && (
                    <Field
                      icon={<MapPin className="h-4 w-4" />}
                      label="Address"
                      value={clinic.address}
                    />
                  )}
                  {clinic.website && (
                    <Field
                      icon={<Globe className="h-4 w-4" />}
                      label="Website"
                      value={clinic.website}
                      link
                    />
                  )}
                  <Field
                    icon={<Calendar className="h-4 w-4" />}
                    label="Joined"
                    value={dateFmt(clinic.joined)}
                  />
                </div>
              </SectionCard>

              <SectionCard title="Commission settings">
                <div className="p-5 space-y-4">
                  <Field
                    icon={<Percent className="h-4 w-4" />}
                    label="Commission rate"
                    value={`${clinic.commissionPct}%`}
                  />
                  <Field
                    label="Basis"
                    value="Percentage of gross order value"
                  />
                  <Field label="VAT" value="20% on commission" />
                  <Field label="Payment terms" value="30 days" />
                  <Field label="Invoice prefix" value="SBI-2026-" />
                </div>
              </SectionCard>
            </div>

            {clinic.notes && (
              <SectionCard title="Notes">
                <div className="p-5">
                  <p className="text-sm text-muted-foreground">{clinic.notes}</p>
                </div>
              </SectionCard>
            )}
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <SectionCard title="Clinic orders" description={`${clinicOrders.length} orders from this clinic`}>
              {clinicOrders.length === 0 ? (
                <EmptyState message="No orders yet for this clinic." />
              ) : (
                <OrderTable orders={clinicOrders} />
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="clinic-code" className="mt-4">
            <SectionCard
              title="Clinic-code orders"
              description={`Orders placed using code ${clinic.code}`}
            >
              {clinicCodeOrders.length === 0 ? (
                <EmptyState message="No orders placed using this clinic code yet." />
              ) : (
                <OrderTable orders={clinicCodeOrders} />
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="credentials" className="mt-4">
            <SectionCard
              title="Login credentials"
              description="Portal access for this clinic"
              actions={<Button size="sm"><Key className="h-4 w-4" />Update credentials</Button>}
            >
              <div className="p-5 space-y-4">
                <label className="block">
                  <div className="text-xs text-muted-foreground mb-1.5">
                    Portal email
                  </div>
                  <input
                    defaultValue={clinic.loginEmail ?? ""}
                    placeholder="portal@clinic.co.uk"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 max-w-md"
                  />
                </label>
                <label className="block">
                  <div className="text-xs text-muted-foreground mb-1.5">
                    New password
                  </div>
                  <input
                    type="password"
                    placeholder="Leave blank to keep current"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 max-w-md"
                  />
                </label>
                <div className="pt-1">
                  <Button size="sm">Save credentials</Button>
                </div>
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}

function Field({
  icon,
  label,
  value,
  link,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  link?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      {icon && (
        <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        {link ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            {value}
          </a>
        ) : (
          <div className="text-sm font-medium">{value}</div>
        )}
      </div>
    </div>
  );
}

function OrderTable({ orders: os }: { orders: typeof orders }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b border-border">
            <th className="font-medium px-5 py-2.5">Order</th>
            <th className="font-medium py-2.5">Customer</th>
            <th className="font-medium py-2.5 text-right">Total</th>
            <th className="font-medium py-2.5 text-right">Commission</th>
            <th className="font-medium py-2.5">Status</th>
            <th className="font-medium py-2.5 pr-5">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {os.slice(0, 10).map((o) => (
            <tr key={o.id} className="hover:bg-muted/40">
              <td className="px-5 py-2.5 font-mono text-xs font-medium">
                {o.number}
              </td>
              <td className="py-2.5">{o.customer}</td>
              <td className="py-2.5 text-right tabular-nums">{currency(o.total)}</td>
              <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                {currency(o.commission)}
              </td>
              <td className="py-2.5">
                <OrderStatusPill status={o.status} />
              </td>
              <td className="py-2.5 pr-5 text-muted-foreground text-xs">
                {relativeTime(o.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderStatusPill({ status }: { status: string }) {
  const toneMap: Record<string, "success" | "warning" | "destructive" | "info" | "muted"> = {
    fulfilled: "success",
    processing: "info",
    pending: "warning",
    refunded: "destructive",
    cancelled: "muted",
  };
  return <StatusPill tone={toneMap[status] ?? "muted"}>{status}</StatusPill>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
