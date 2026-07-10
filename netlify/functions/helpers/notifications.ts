import { Resend } from "resend";
import { logger } from "./logger";
import { prisma } from "./prisma";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || "Our Sacred Space <noreply@oursacredspace.in>";

// Publicly-hosted brand logo (Supabase Storage CDN). Email clients require an
// absolute URL to a hosted image — base64/CID data is stripped by Gmail et al.
// Same asset the site header uses (Assets/brand/logo.png).
const EMAIL_LOGO_URL = `${(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://umxpjtfekclktbtomiaz.supabase.co"
).replace(/\/$/, "")}/storage/v1/object/public/Assets/brand/logo.png`;

// Shared branded header: the watercolor logo on a white band with a thin green
// accent. Reused by every transactional template so branding stays consistent.
const emailHeader = (): string => `
    <tr>
      <td style="background:#ffffff;padding:24px 32px;text-align:center;border-bottom:3px solid #2d5016;">
        <img src="${EMAIL_LOGO_URL}" width="200" alt="Our Sacred Space" style="display:block;margin:0 auto;width:200px;max-width:80%;height:auto;border:0;" />
      </td>
    </tr>`;

// Cap how long the email provider call may block the (user-facing) confirmation
// path. verifyPayment awaits notifications before returning, so a slow/hung
// provider would otherwise stall the success redirect.
const EMAIL_TIMEOUT_MS = 4000;

// A credential that is missing or still a placeholder ("re_placeholder",
// "placeholder_token", etc.) must NOT trigger a real HTTP call — those calls
// fail slowly and add seconds of latency for nothing.
const isPlaceholder = (v?: string): boolean => !v || v.toLowerCase().includes("placeholder");

const withTimeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);

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

/**
 * Outcome of a single notification channel. `reason` carries the concrete
 * failure cause (Resend error, timeout, missing credential, …) so it can be
 * persisted to NotificationLog.error and surfaced in logs — a silent `false`
 * is what made a missing RESEND_API_KEY take an hour to diagnose.
 */
interface ChannelResult {
  ok: boolean;
  reason?: string;
}

// Truncate a failure reason before persisting so a huge provider error body
// can't bloat the NotificationLog row.
const truncateReason = (reason: string): string =>
  reason.length > 500 ? `${reason.slice(0, 497)}...` : reason;

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

async function sendConfirmationEmail(booking: BookingWithRelations): Promise<ChannelResult> {
  if (isPlaceholder(process.env.RESEND_API_KEY)) {
    // LOUD, actionable, and distinctive: the #1 cause of "customer didn't get
    // a confirmation email" is this env var being missing in the runtime
    // (production Netlify env, or a `netlify dev` server started before the
    // key was added — env is read once at startup).
    const reason =
      "RESEND_API_KEY is missing or a placeholder — confirmation email NOT sent. " +
      "Set RESEND_API_KEY in this environment (Netlify dashboard for prod; .env + RESTART `netlify dev` for local).";
    logger.error("EMAIL MISCONFIGURED: RESEND_API_KEY not set", new Error(reason), {
      bookingId: booking.id,
      customerEmail: booking.customerEmail,
    });
    return { ok: false, reason };
  }

  const isClass = booking.type === "CLASS";
  const resource = isClass ? booking.classSession : booking.event;
  if (!resource) {
    const reason = `Booking has no ${isClass ? "classSession" : "event"} relation loaded — cannot build email`;
    logger.error("Email skipped: missing booking relation", new Error(reason), {
      bookingId: booking.id,
      type: booking.type,
    });
    return { ok: false, reason };
  }

  const title = resource.title;
  const date = formatDate(resource.startsAt);
  const time = formatTime(resource.startsAt);
  const venue = isClass
    ? (booking.classSession?.location ?? "TBA")
    : (booking.event?.venue ?? "TBA");

  try {
    const { error } = await withTimeout(
      resend.emails.send({
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
      }),
      EMAIL_TIMEOUT_MS,
      "resend email"
    );

    if (error) {
      // Resend resolves (not rejects) on API errors — e.g. unverified sending
      // domain, invalid `from`, restricted key. Capture the full message.
      const reason = `Resend API error: ${error.name ? `${error.name}: ` : ""}${error.message}`;
      logger.error("Resend email failed", new Error(reason), {
        bookingId: booking.id,
        from: FROM_EMAIL,
        to: booking.customerEmail,
      });
      return { ok: false, reason };
    }

    return { ok: true };
  } catch (err) {
    // Thrown here means the withTimeout race fired or fetch threw (network /
    // TLS). Distinguish the timeout so a too-aggressive EMAIL_TIMEOUT_MS is
    // obvious rather than looking like a generic failure.
    const reason = err instanceof Error ? err.message : String(err);
    logger.error("Email send exception", err, { bookingId: booking.id, timeoutMs: EMAIL_TIMEOUT_MS });
    return { ok: false, reason: `Email send exception: ${reason}` };
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
    ${emailHeader()}
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

// ─── Resume-payment link ────────────────────────────────

interface ResumeLinkRecipient {
  id: string;
  customerName: string;
  customerEmail: string;
  amountPaise: number;
}

/**
 * SECURITY (SEC-004): Deliver the resume-payment link to the booking's OWN
 * email address rather than returning the access token in the HTTP response.
 *
 * The resume flow is reachable by anyone who knows a booking's email + phone.
 * If the fresh access token were returned in the response body, that pair —
 * neither of which is a secret — would yield the token, and through it the
 * victim's full PII (getBooking) and payment surface. Routing the token
 * through email means only the party who controls the inbox can act on it.
 *
 * Returns whether the mail was accepted for delivery. The caller must NOT
 * persist the rotated token hash unless this succeeds, otherwise it would
 * invalidate the customer's existing link without delivering a new one.
 */
export async function sendResumePaymentLink(
  booking: ResumeLinkRecipient,
  resumeUrl: string
): Promise<ChannelResult> {
  if (isPlaceholder(process.env.RESEND_API_KEY)) {
    const reason =
      "RESEND_API_KEY is missing or a placeholder — resume-payment link NOT sent.";
    logger.error("EMAIL MISCONFIGURED: cannot send resume link", new Error(reason), {
      bookingId: booking.id,
    });
    return { ok: false, reason };
  }

  try {
    const { error } = await withTimeout(
      resend.emails.send({
        from: FROM_EMAIL,
        to: booking.customerEmail,
        subject: "Complete your booking payment — Our Sacred Space",
        html: buildResumeLinkHtml({
          customerName: escapeHtml(booking.customerName),
          amount: escapeHtml(formatPrice(booking.amountPaise)),
          // resumeUrl is a server-built absolute URL (origin + bookingId +
          // token); it contains no user input, but escape defensively.
          resumeUrl: escapeHtml(resumeUrl),
        }),
      }),
      EMAIL_TIMEOUT_MS,
      "resend resume email"
    );

    if (error) {
      const reason = `Resend API error: ${error.name ? `${error.name}: ` : ""}${error.message}`;
      logger.error("Resume-link email failed", new Error(reason), { bookingId: booking.id });
      return { ok: false, reason };
    }

    // Record the send for audit/debugging parity with confirmation emails.
    try {
      await prisma.notificationLog.create({
        data: {
          bookingId: booking.id,
          channel: "EMAIL",
          templateName: "booking_resume_payment_link",
          to: booking.customerEmail,
          status: "SENT",
        },
      });
    } catch (logErr) {
      logger.error("Resume-link notification log failed", logErr, { bookingId: booking.id });
    }

    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error("Resume-link email exception", err, { bookingId: booking.id });
    return { ok: false, reason: `Resume-link email exception: ${reason}` };
  }
}

function buildResumeLinkHtml(data: {
  customerName: string;
  amount: string;
  resumeUrl: string;
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
    ${emailHeader()}
    <tr>
      <td style="padding:32px;">
        <h2 style="color:#2d5016;margin:0 0 8px;font-size:20px;">Finish your booking</h2>
        <p style="color:#555;margin:0 0 16px;font-size:15px;line-height:1.5;">
          Hi ${data.customerName}, you have a booking waiting for payment of
          <strong>${data.amount}</strong>. Use the button below to complete it securely.
        </p>
        <p style="margin:24px 0;text-align:center;">
          <a href="${data.resumeUrl}" style="display:inline-block;background:#2d5016;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
            Complete Payment
          </a>
        </p>
        <p style="color:#888;margin:16px 0 0;font-size:13px;line-height:1.6;">
          This link is unique to your booking — please don't forward it. If you
          didn't request this, you can safely ignore this email; no payment will
          be taken.
        </p>
      </td>
    </tr>
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

// ─── Space-request admin notification ───────────────────

interface SpaceRequestNotification {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  preferredSlots: string[];
  purpose?: string | null;
  notes?: string | null;
}

/**
 * Recipient(s) for space-rental request notifications. Prefers the dedicated
 * SPACE_REQUEST_NOTIFY_EMAIL (comma-separated for multiple), and falls back to
 * the first ADMIN_ALLOWED_EMAILS entry so notifications still land somewhere
 * sensible before the dedicated var is configured. Returns undefined when no
 * recipient is configured at all.
 */
function spaceRequestRecipients(): string[] | undefined {
  const explicit = process.env.SPACE_REQUEST_NOTIFY_EMAIL
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (explicit && explicit.length > 0) return explicit;

  const admins = process.env.ADMIN_ALLOWED_EMAILS
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return admins && admins.length > 0 ? [admins[0]] : undefined;
}

/**
 * Notify the venue team that a new space-rental request came in. Sent to
 * spaceRequestRecipients() with the customer set as reply-to, so the team can
 * reply straight to the requester. Fire-and-forget from createBooking — a
 * failure here must never block the customer's submission.
 */
export async function sendSpaceRequestNotification(
  req: SpaceRequestNotification
): Promise<ChannelResult> {
  const to = spaceRequestRecipients();
  if (!to) {
    const reason =
      "No SPACE_REQUEST_NOTIFY_EMAIL or ADMIN_ALLOWED_EMAILS configured — space-request notification NOT sent. " +
      "Set SPACE_REQUEST_NOTIFY_EMAIL in this environment (Netlify dashboard for prod; .env + RESTART `netlify dev` for local).";
    logger.error("Space-request notify skipped: no recipient", new Error(reason), {
      bookingId: req.bookingId,
    });
    return { ok: false, reason };
  }

  if (isPlaceholder(process.env.RESEND_API_KEY)) {
    const reason =
      "RESEND_API_KEY is missing or a placeholder — space-request notification NOT sent.";
    logger.error("EMAIL MISCONFIGURED: cannot send space-request notification", new Error(reason), {
      bookingId: req.bookingId,
    });
    return { ok: false, reason };
  }

  try {
    const { error } = await withTimeout(
      resend.emails.send({
        from: FROM_EMAIL,
        to,
        // Let the team hit "Reply" and reach the requester directly.
        replyTo: req.customerEmail,
        subject: `New space request — ${escapeHtml(req.customerName)}`,
        html: buildSpaceRequestHtml({
          bookingId: escapeHtml(req.bookingId),
          customerName: escapeHtml(req.customerName),
          customerEmail: escapeHtml(req.customerEmail),
          customerPhone: escapeHtml(req.customerPhone),
          preferredSlots: req.preferredSlots.map((s) => escapeHtml(s)),
          purpose: req.purpose ? escapeHtml(req.purpose) : null,
          notes: req.notes ? escapeHtml(req.notes) : null,
        }),
      }),
      EMAIL_TIMEOUT_MS,
      "resend space-request email"
    );

    if (error) {
      const reason = `Resend API error: ${error.name ? `${error.name}: ` : ""}${error.message}`;
      logger.error("Space-request email failed", new Error(reason), {
        bookingId: req.bookingId,
        to: to.join(","),
      });
      return { ok: false, reason };
    }

    try {
      await prisma.notificationLog.create({
        data: {
          bookingId: req.bookingId,
          channel: "EMAIL",
          templateName: "space_request_admin_notification",
          to: to.join(","),
          status: "SENT",
        },
      });
    } catch (logErr) {
      logger.error("Space-request notification log failed", logErr, { bookingId: req.bookingId });
    }

    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error("Space-request email exception", err, { bookingId: req.bookingId });
    return { ok: false, reason: `Space-request email exception: ${reason}` };
  }
}

function buildSpaceRequestHtml(data: {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  preferredSlots: string[];
  purpose: string | null;
  notes: string | null;
}): string {
  const row = (label: string, value: string) => `
          <tr><td style="padding:8px 20px;">
            <p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">${label}</p>
            <p style="margin:4px 0 0;color:#333;font-size:14px;">${value}</p>
          </td></tr>`;
  const slots =
    data.preferredSlots.length > 0
      ? data.preferredSlots.join("<br>")
      : "—";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#faf9f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    ${emailHeader()}
    <tr>
      <td style="padding:32px;">
        <h2 style="color:#2d5016;margin:0 0 8px;font-size:20px;">New Space Request</h2>
        <p style="color:#555;margin:0 0 24px;font-size:15px;line-height:1.5;">
          A new space-rental request has been submitted. Details below — reply to this email to reach ${data.customerName} directly.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7f4;border-radius:8px;padding:20px;">
          ${row("Name", data.customerName)}
          ${row("Email", data.customerEmail)}
          ${row("Phone", data.customerPhone)}
          ${row("Preferred date / time", slots)}
          ${row("Purpose", data.purpose ?? "—")}
          ${data.notes ? row("Notes", data.notes) : ""}
          ${row("Request ID", data.bookingId)}
        </table>
        <p style="color:#555;margin:24px 0 0;font-size:13px;line-height:1.6;">
          Manage this request in the admin dashboard under Space Requests.
        </p>
      </td>
    </tr>
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

// ─── Combined ───────────────────────────────────────────

export async function sendBookingConfirmation(booking: BookingWithRelations): Promise<void> {
  // Email is currently the only confirmation channel. (WhatsApp notifications
  // were removed; re-add a channel here and OR its result into `sent` if one
  // is reintroduced.)
  const emailRes: ChannelResult = await sendConfirmationEmail(booking);
  const sent = emailRes.ok;

  const errorText = !sent && emailRes.reason ? truncateReason(emailRes.reason) : null;

  try {
    await prisma.notificationLog.create({
      data: {
        bookingId: booking.id,
        channel: "EMAIL",
        templateName: `booking_${booking.type.toLowerCase()}_confirmed`,
        to: booking.customerEmail,
        status: sent ? "SENT" : "FAILED",
        error: errorText,
      },
    });
  } catch (logErr) {
    logger.error("Notification log creation failed", logErr, { bookingId: booking.id });
  }

  if (!sent) {
    logger.error(
      "CRITICAL: Confirmation email failed for confirmed booking",
      new Error(errorText ?? "Email not delivered"),
      {
        bookingId: booking.id,
        customerEmail: booking.customerEmail,
        emailReason: emailRes.reason,
      }
    );
  }
}
