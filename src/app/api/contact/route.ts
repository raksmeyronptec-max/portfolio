import { NextResponse, type NextRequest } from "next/server";

import {
  collectFieldErrors,
  contactSubmissionSchema,
  scoreSpam,
} from "@/lib/validation/contact";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { rateLimitHash } from "@/lib/analytics/visitor";
import { defaultLocale } from "@/i18n/config";

/**
 * Contact form submission.
 *
 * How this differs from v1's Netlify function, point by point:
 *
 *  1. **No hardcoded secret.** v1 committed a live Telegram bot token in the
 *     source. Credentials here come from env vars only, and if they are unset the
 *     form still works — it just does not claim a notification was sent.
 *
 *  2. **The message is persisted first.** v1 relayed to Telegram and kept nothing,
 *     so a Telegram outage meant the enquiry was lost with no record. The database
 *     write is the source of truth; the notification is best-effort on top.
 *
 *  3. **Rate limiting actually holds.** v1 counted requests in a module-level
 *     object inside a serverless function, which reset on every cold start and was
 *     not shared between concurrent instances. The window is now evaluated in
 *     Postgres against the stored messages.
 *
 *  4. **No open CORS.** v1 sent `Access-Control-Allow-Origin: *`, so any site
 *     could drive the relay. There is no CORS header here, and same-origin is
 *     additionally asserted below.
 *
 *  5. **Honest success messaging.** The response reports whether a notification
 *     was actually delivered, and the UI wording differs accordingly.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOLDOWN_SECONDS = Number.parseInt(
  process.env.CONTACT_COOLDOWN_SECONDS ?? "120",
  10,
);
const MAX_PER_HOUR = Number.parseInt(process.env.CONTACT_MAX_PER_HOUR ?? "3", 10);

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: "unavailable" }, 503);
  }

  /*
   * Same-origin assertion. Not a substitute for anything, but it costs nothing
   * and stops the trivial case of another site posting this form directly.
   * Browsers set `origin` on cross-origin POSTs; a missing origin (curl) is
   * allowed through to the rate limiter and validation.
   */
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("host");
    try {
      if (new URL(origin).host !== host) {
        return json({ ok: false, error: "forbidden" }, 403);
      }
    } catch {
      return json({ ok: false, error: "forbidden" }, 403);
    }
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const parsed = contactSubmissionSchema.safeParse(payload);
  if (!parsed.success) {
    // Field-level error CODES, not sentences. The client localises them.
    return json(
      { ok: false, error: "validation", fields: collectFieldErrors(parsed.error) },
      400,
    );
  }

  const submission = parsed.data;
  const ipHash = rateLimitHash(request.headers);

  try {
    const supabase = await createSupabasePublicClient();

    // ── Rate limit ──────────────────────────────────────────────────────────
    if (ipHash) {
      const { data: limit } = await supabase.rpc("check_contact_rate_limit", {
        p_ip_hash: ipHash,
        p_cooldown_seconds: Number.isFinite(COOLDOWN_SECONDS) ? COOLDOWN_SECONDS : 120,
        p_max_per_hour: Number.isFinite(MAX_PER_HOUR) ? MAX_PER_HOUR : 3,
      });

      const decision = limit as
        | { blocked: boolean; reason?: string; seconds_left?: number }
        | null;

      if (decision?.blocked) {
        return json(
          {
            ok: false,
            error: "rate_limited",
            reason: decision.reason ?? "cooldown",
            secondsLeft: decision.seconds_left ?? 120,
          },
          429,
        );
      }
    }

    const honeypotFilled = Boolean(submission.website && submission.website.length > 0);

    const spamScore = scoreSpam({
      name: submission.name,
      email: submission.email,
      message: submission.message,
      subject: submission.subject || undefined,
      elapsedMs: submission.elapsedMs,
      honeypotFilled,
    });

    /*
     * The insert uses the service-role client because the anonymous insert policy
     * deliberately forbids setting `ip_hash` and `spam_score` — a submitter must
     * not be able to forge the rate-limit key or pre-clear their own spam score.
     * Those two columns are server-derived, so the write has to be privileged.
     */
    const admin = createSupabaseAdminClient();

    const { data: inserted, error: insertError } = await admin
      .from("contact_messages")
      .insert({
        name: submission.name,
        email: submission.email,
        organization: submission.organization || null,
        subject: submission.subject || null,
        message: submission.message,
        project_type: submission.projectType || null,
        preferred_contact: submission.preferredContact || null,
        locale: submission.locale ?? defaultLocale,
        // A high score lands in the spam folder, not the bin. Nothing is silently
        // discarded — a false positive must remain recoverable.
        state: spamScore >= 70 ? "spam" : "unread",
        spam_score: spamScore,
        ip_hash: ipHash,
        user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
        referer: request.headers.get("referer")?.slice(0, 500) ?? null,
        consent_given: submission.consent === true,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      // Generic message: an internal database error must not be described to the
      // caller.
      return json({ ok: false, error: "server_error" }, 500);
    }

    // ── Best-effort notification ────────────────────────────────────────────
    const notified = await notifyTelegram({
      id: inserted.id,
      name: submission.name,
      email: submission.email,
      organization: submission.organization || null,
      subject: submission.subject || null,
      message: submission.message,
      spamScore,
    });

    if (notified.attempted) {
      await admin
        .from("contact_messages")
        .update({
          notification_sent: notified.ok,
          notification_error: notified.ok ? null : notified.error,
        })
        .eq("id", inserted.id);
    }

    // `notified` is reported truthfully so the UI can choose its wording rather
    // than asserting a delivery that may not have happened.
    return json({ ok: true, notified: notified.ok }, 201);
  } catch {
    return json({ ok: false, error: "server_error" }, 500);
  }
}

/**
 * Telegram notification.
 *
 * Returns `attempted: false` when unconfigured, so the caller can distinguish
 * "not set up" from "tried and failed" — and so the success copy can avoid
 * claiming a delivery that never happened.
 */
async function notifyTelegram(message: {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  subject: string | null;
  message: string;
  spamScore: number;
}): Promise<{ attempted: boolean; ok: boolean; error: string | null }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return { attempted: false, ok: false, error: null };
  }

  // Plain text, not Markdown or HTML parse_mode: a message body containing
  // Telegram markup would otherwise break the send or be interpreted.
  const lines = [
    "New portfolio enquiry",
    "",
    `From: ${message.name} <${message.email}>`,
    message.organization ? `Organisation: ${message.organization}` : null,
    message.subject ? `Subject: ${message.subject}` : null,
    message.spamScore >= 40 ? `Spam score: ${message.spamScore}/100` : null,
    "",
    message.message.slice(0, 3000),
  ].filter((line): line is string => line !== null);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: lines.join("\n"),
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!response.ok) {
      // Store the status only. The response body can echo the bot token.
      return {
        attempted: true,
        ok: false,
        error: `telegram_http_${response.status}`,
      };
    }

    return { attempted: true, ok: true, error: null };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError"
      ? "telegram_timeout"
      : "telegram_unreachable";
    return { attempted: true, ok: false, error: reason };
  }
}

export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
