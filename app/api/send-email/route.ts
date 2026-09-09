import { NextResponse } from "next/server";
import { transporter } from "@/lib/mailer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      to,
      subject,
      message,
      name,
      replyTo,
    } = body;

    if (!to || !subject || !message) {
      return NextResponse.json(
        {
          success: false,
          message: "to, subject and message are required",
        },
        { status: 400 }
      );
    }

    const mail = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      text: message,

      // Optional
      replyTo: replyTo || undefined,

      // Optional HTML version
      html: `
        <div style="font-family: Arial, sans-serif;">
          ${name ? `<h3>Message from ${name}</h3>` : ""}

          <p>${message.replace(/\n/g, "<br />")}</p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      messageId: mail.messageId,
    });
  } catch (error) {
    console.error("SMTP email error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to send email",
      },
      { status: 500 }
    );
  }
}