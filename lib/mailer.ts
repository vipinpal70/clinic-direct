import nodemailer from "nodemailer";
import { currencyExact, dateFmt } from "@/lib/utils";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: true, // true for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

/**
 * Absolute URL for a public link embedded in an outbound email. Uses APP_URL
 * because emails are sent from the ingest path where there's no request to read
 * the host from. Falls back to the local dev origin.
 */
export function appUrl(path: string): string {
  const base = (process.env.APP_URL || "http://localhost:3009").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function brandedHtml(opts: {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}): string {
  return `
  <div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
    <h2 style="margin: 0 0 16px;">${opts.heading}</h2>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 24px;">${opts.body}</p>
    <p style="margin: 0 0 24px;">
      <a href="${opts.ctaUrl}"
         style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-size: 14px;">
        ${opts.ctaLabel}
      </a>
    </p>
    <p style="font-size: 12px; color: #6b7280; line-height: 1.6; margin: 0;">
      If the button doesn't work, copy and paste this link into your browser:<br />
      <a href="${opts.ctaUrl}" style="color: #2563eb;">${opts.ctaUrl}</a>
    </p>
  </div>`.trim();
}

interface EmailableClinic {
  name: string;
  code: string;
  email: string;
}

/**
 * Step 1 email — invites the clinic to complete its profile (bank & tax details)
 * via the public intake page. Sent automatically on first ingest and re-sent
 * manually from the admin clinic page.
 */
export async function sendProfileCompletionEmail(clinic: EmailableClinic) {
  const url = appUrl(`/clinic/details/${clinic.code}`);
  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: clinic.email,
    subject: "Complete your Clinic Direct profile",
    text: `Hi ${clinic.name},\n\nPlease complete your Clinic Direct profile by adding your bank and tax details:\n${url}\n`,
    html: brandedHtml({
      heading: `Welcome to Clinic Direct, ${clinic.name}`,
      body: "To finish setting up your account, please complete your profile by entering your bank and tax details. It only takes a couple of minutes.",
      ctaLabel: "Complete your profile",
      ctaUrl: url,
    }),
  });
}

interface InvoiceForEmail {
  number: string;
  commission: number;
  vat: number;
  total: number;
  status: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
}

/** Standalone HTML invoice document — reused for the email body and the attachment. */
function invoiceDocumentHtml(clinic: EmailableClinic, invoice: InvoiceForEmail): string {
  const period =
    invoice.periodStart && invoice.periodEnd
      ? `${dateFmt(invoice.periodStart)} – ${dateFmt(invoice.periodEnd)}`
      : "—";
  return `
  <div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 620px; margin: 0 auto;">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 24px;">
      <div>
        <h1 style="margin:0; font-size:20px;">Self-billed invoice</h1>
        <p style="margin:4px 0 0; font-size:13px; color:#6b7280;">Clinic Direct</p>
      </div>
      <div style="text-align:right;">
        <p style="margin:0; font-size:13px; color:#6b7280;">Invoice number</p>
        <p style="margin:2px 0 0; font-size:16px; font-weight:bold; font-family: monospace;">${invoice.number}</p>
      </div>
    </div>

    <table style="width:100%; font-size:13px; margin-bottom:24px; border-collapse:collapse;">
      <tr>
        <td style="padding:2px 0; color:#6b7280;">Billed to</td>
        <td style="padding:2px 0; text-align:right; font-weight:600;">${clinic.name} (${clinic.code})</td>
      </tr>
      <tr>
        <td style="padding:2px 0; color:#6b7280;">Issue date</td>
        <td style="padding:2px 0; text-align:right;">${dateFmt(invoice.createdAt)}</td>
      </tr>
      <tr>
        <td style="padding:2px 0; color:#6b7280;">Period</td>
        <td style="padding:2px 0; text-align:right;">${period}</td>
      </tr>
      <tr>
        <td style="padding:2px 0; color:#6b7280;">Status</td>
        <td style="padding:2px 0; text-align:right; text-transform:capitalize;">${invoice.status}</td>
      </tr>
    </table>

    <table style="width:100%; font-size:14px; border-collapse:collapse;">
      <tr style="border-top:1px solid #e5e7eb;">
        <td style="padding:10px 0; color:#374151;">Commission</td>
        <td style="padding:10px 0; text-align:right;">${currencyExact(invoice.commission)}</td>
      </tr>
      <tr style="border-top:1px solid #e5e7eb;">
        <td style="padding:10px 0; color:#374151;">VAT (20%)</td>
        <td style="padding:10px 0; text-align:right;">${currencyExact(invoice.vat)}</td>
      </tr>
      <tr style="border-top:2px solid #111827;">
        <td style="padding:12px 0; font-weight:bold;">Total</td>
        <td style="padding:12px 0; text-align:right; font-weight:bold; font-size:16px;">${currencyExact(invoice.total)}</td>
      </tr>
    </table>

    <p style="font-size:12px; color:#6b7280; line-height:1.6; margin:24px 0 0;">
      This self-billed invoice was generated by Clinic Direct on your behalf under your partnership agreement.
      If anything looks incorrect, please reply to this email.
    </p>
  </div>`.trim();
}

/**
 * Sends the generated invoice to the clinic's registered email address. The
 * invoice is rendered inline in the email body and also attached as a PDF.
 * Sending does NOT change the invoice's payment status.
 */
export async function sendInvoiceEmail(
  clinic: EmailableClinic,
  invoice: InvoiceForEmail,
) {
  const doc = invoiceDocumentHtml(clinic, invoice);
  const pdf = await generateInvoicePdf(
    { name: clinic.name, code: clinic.code },
    invoice,
  );
  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: clinic.email,
    subject: `Invoice ${invoice.number} from Clinic Direct`,
    text: `Hi ${clinic.name},\n\nPlease find your Clinic Direct self-billed invoice ${invoice.number} attached.\n\nCommission: ${currencyExact(invoice.commission)}\nVAT (20%): ${currencyExact(invoice.vat)}\nTotal: ${currencyExact(invoice.total)}\n`,
    html: doc,
    attachments: [
      {
        filename: `${invoice.number}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });
}

/**
 * Step 2 email — sends the partnership agreement / consent link to the clinic.
 * `consentPath` is the app-relative path returned by the agreement route.
 */
export async function sendAgreementEmail(
  clinic: EmailableClinic,
  consentPath: string,
) {
  const url = appUrl(consentPath);
  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: clinic.email,
    subject: "Your Clinic Direct partnership agreement",
    text: `Hi ${clinic.name},\n\nYour Clinic Direct partnership agreement is ready to review and sign:\n${url}\n`,
    html: brandedHtml({
      heading: `Your partnership agreement is ready, ${clinic.name}`,
      body: "Please review and sign your Clinic Direct partnership agreement using the link below.",
      ctaLabel: "Review & sign agreement",
      ctaUrl: url,
    }),
  });
}