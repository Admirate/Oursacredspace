import { Resend } from "resend";
import { sanitizeTemplateParam } from "./security";
import { logger } from "./logger";
import { prisma } from "./prisma";

const resend = new Resend(process.env.RESEND_API_KEY);

const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";
const FROM_EMAIL = process.env.EMAIL_FROM || "Our Sacred Space <noreply@oursacredspace.in>";

/**
 * SECURITY (SEC-009): Escape HTML special characters to prevent XSS/injection
 * in email templates. All user-supplied values MUST pass through this before
 * interpolation into HTML strings.
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface BookingWithRelations {
  id: string;
  type: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amountPaise: number;
  currency: string;
  classSession?: { title: string; startsAt: Date; location: string | null; duration: number } | null;
  event?: { title: string; startsAt: Date; venue: string; endsAt?: Date | null } | null;
}

function formatPrice(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Email ──────────────────────────────────────────────

async function sendConfirmationEmail(booking: BookingWithRelations): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY not set, skipping email", { bookingId: booking.id });
    return false;
  }

  const isClass = booking.type === "CLASS";
  const resource = isClass ? booking.classSession : booking.event;
  if (!resource) return false;

  const title = resource.title;
  const date = formatDate(resource.startsAt);
  const time = formatTime(resource.startsAt);
  const venue = isClass
    ? (booking.classSession?.location ?? "TBA")
    : (booking.event?.venue ?? "TBA");

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: booking.customerEmail,
      subject: `Booking Confirmed — ${escapeHtml(title)}`,
      html: buildConfirmationHtml({
        customerName: escapeHtml(booking.customerName),
        bookingId: escapeHtml(booking.id),
        type: isClass ? "Class" : "Event",
        title: escapeHtml(title),
        date: escapeHtml(date),
        time: escapeHtml(time),
        venue: escapeHtml(venue),
        amount: escapeHtml(formatPrice(booking.amountPaise)),
      }),
    });

    if (error) {
      logger.error("Resend email failed", new Error(error.message), { bookingId: booking.id });
      return false;
    }

    return true;
  } catch (err) {
    logger.error("Email send exception", err, { bookingId: booking.id });
    return false;
  }
}

function buildConfirmationHtml(data: {
  customerName: string;
  bookingId: string;
  type: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  amount: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#faf9f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <!-- Header -->
    <tr>
      <td style="background:#2d5016;padding:28px 32px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:600;">Our Sacred Space</h1>
      </td>
    </tr>
    <!-- Body -->
    <tr>
      <td style="padding:32px;">
        <h2 style="color:#2d5016;margin:0 0 8px;font-size:20px;">Booking Confirmed ✓</h2>
        <p style="color:#555;margin:0 0 24px;font-size:15px;line-height:1.5;">
          Hi ${data.customerName}, your ${data.type.toLowerCase()} booking has been confirmed.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7f4;border-radius:8px;padding:20px;">
          <tr><td style="padding:8px 20px;">
            <p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Booking ID</p>
            <p style="margin:4px 0 0;color:#333;font-size:14px;font-family:monospace;">${data.bookingId}</p>
          </td></tr>
          <tr><td style="padding:8px 20px;">
            <p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">${data.type}</p>
            <p style="margin:4px 0 0;color:#333;font-size:15px;font-weight:600;">${data.title}</p>
          </td></tr>
          <tr><td style="padding:8px 20px;">
            <p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Date &amp; Time</p>
            <p style="margin:4px 0 0;color:#333;font-size:14px;">${data.date} at ${data.time}</p>
          </td></tr>
          <tr><td style="padding:8px 20px;">
            <p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Venue</p>
            <p style="margin:4px 0 0;color:#333;font-size:14px;">${data.venue}</p>
          </td></tr>
          <tr><td style="padding:8px 20px;">
            <p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Amount Paid</p>
            <p style="margin:4px 0 0;color:#2d5016;font-size:16px;font-weight:600;">${data.amount}</p>
          </td></tr>
        </table>

        <p style="color:#555;margin:24px 0 0;font-size:13px;line-height:1.6;">
          Please arrive 10 minutes before the scheduled time. If you have any questions, reply to this email or reach us on WhatsApp.
        </p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding:20px 32px;border-top:1px solid #eee;text-align:center;">
        <p style="margin:0;color:#999;font-size:12px;">
          Our Sacred Space · Secunderabad · <a href="https://www.oursacredspace.in" style="color:#2d5016;">oursacredspace.in</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── WhatsApp ───────────────────────────────────────────

async function sendWhatsAppConfirmation(booking: BookingWithRelations): Promise<boolean> {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    logger.warn("WhatsApp credentials not set, skipping", { bookingId: booking.id });
    return false;
  }

  const isClass = booking.type === "CLASS";
  const resource = isClass ? booking.classSession : booking.event;
  if (!resource) return false;

  const templateName = isClass ? "booking_class_confirmed" : "booking_event_confirmed";
  const venue = isClass
    ? (booking.classSession?.location ?? "TBA")
    : (booking.event?.venue ?? "TBA");

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: booking.customerPhone.replace(/\D/g, ""),
          type: "template",
          template: {
            name: templateName,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: sanitizeTemplateParam(booking.customerName) },
                  { type: "text", text: sanitizeTemplateParam(resource.title) },
                  { type: "text", text: sanitizeTemplateParam(formatDate(resource.startsAt), 50) },
                  { type: "text", text: sanitizeTemplateParam(formatTime(resource.startsAt), 20) },
                  { type: "text", text: sanitizeTemplateParam(venue) },
                ],
              },
            ],
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      logger.error("WhatsApp API error", new Error(data.error?.message || "Unknown"), {
        bookingId: booking.id,
        status: response.status,
      });
      return false;
    }

    return true;
  } catch (err) {
    logger.error("WhatsApp send exception", err, { bookingId: booking.id });
    return false;
  }
}

// ─── Combined ───────────────────────────────────────────

export async function sendBookingConfirmation(booking: BookingWithRelations): Promise<void> {
  const [emailSent, whatsappSent] = await Promise.allSettled([
    sendConfirmationEmail(booking),
    sendWhatsAppConfirmation(booking),
  ]);

  const emailOk = emailSent.status === "fulfilled" && emailSent.value;
  const waOk = whatsappSent.status === "fulfilled" && whatsappSent.value;

  const channel = emailOk && waOk ? "BOTH" : emailOk ? "EMAIL" : waOk ? "WHATSAPP" : "NONE";

  try {
    await prisma.notificationLog.create({
      data: {
        bookingId: booking.id,
        channel: emailOk ? "EMAIL" : "WHATSAPP",
        templateName: `booking_${booking.type.toLowerCase()}_confirmed`,
        to: booking.customerEmail,
        status: channel === "NONE" ? "FAILED" : "SENT",
      },
    });
  } catch (logErr) {
    logger.error("Notification log creation failed", logErr, { bookingId: booking.id });
  }

  if (!emailOk && !waOk) {
    logger.error("CRITICAL: All notifications failed for confirmed booking", new Error("No notification delivered"), {
      bookingId: booking.id,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
    });
  }
}
