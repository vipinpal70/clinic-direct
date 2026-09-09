import nodemailer from "nodemailer";

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