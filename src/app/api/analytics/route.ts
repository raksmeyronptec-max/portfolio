import { NextResponse, type NextRequest } from "next/server";

import {
  analyticsEventSchema,
  classifyBrowser,
  classifyDevice,
  classifyOs,
  destinationHost,
  outboundEvents,
  pageViewEvents,
  referrerHost,
} from "@/lib/analytics/events";
import { countryCode, visitorHash } from "@/lib/analytics/visitor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSiteSettings } from "@/lib/data/site";
import { defaultLocale } from "@/i18n/config";

/**
 * Analytics ingestion.
 *
 * Design decisions:
 *
 *  - Always answers 204, even on a validation failure. An analytics endpoint that
 *    returns errors to the page is an analytics endpoint that can break the page,
 *    and its status codes are also a free oracle for probing. Invalid events are
 *    dropped silently.
 *
 *  - Derived server-side, never accepted from the client: visitor hash, device,
 *    browser, OS, referrer host and country. A client that could set its own
 *    device type could also set its own visitor id.
 *
 *  - Bots are discarded rather than counted. A "views" figure inflated by
 *    crawlers is worse than no figure, because it looks real.
 *
 *  - Writes use the service-role client. `anon` has INSERT but no SELECT on these
 *    tables; using service-role here also lets us write the projection tables in
 *    one round trip without granting the browser anything extra.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CONTENT = new NextResponse(null, {
  status: 204,
  headers: { "Cache-Control": "no-store" },
});

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) return NO_CONTENT;

  // Honour the browser-level opt-out signals server-side too, in case the
  // request came from something other than our own client helper.
  const dnt = request.headers.get("dnt");
  const gpc = request.headers.get("sec-gpc");
  if (dnt === "1" || gpc === "1") return NO_CONTENT;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NO_CONTENT;
  }

  const parsed = analyticsEventSchema.safeParse(payload);
  if (!parsed.success) return NO_CONTENT;

  const event = parsed.data;

  const userAgent = request.headers.get("user-agent");
  const deviceType = classifyDevice(userAgent);

  // Crawlers are not visitors.
  if (deviceType === "bot") return NO_CONTENT;

  try {
    const settings = await getSiteSettings(defaultLocale);
    if (!settings.analyticsEnabled) return NO_CONTENT;

    const supabase = createSupabaseAdminClient();

    const locale = event.locale ?? null;
    const hash = visitorHash(request.headers);
    const ownHost = request.headers.get("host");
    const referrer = referrerHost(request.headers.get("referer"), ownHost);
    const country = countryCode(request.headers);

    // PostgREST query builders are thenables rather than real Promises, hence
    // PromiseLike. Promise.allSettled accepts them.
    const writes: Array<PromiseLike<unknown>> = [];

    writes.push(
      supabase.from("analytics_events").insert({
        event_name: event.name,
        locale,
        path: event.path ?? null,
        entity_type: event.entityType ?? null,
        entity_id: event.entityId ?? null,
        entity_slug: event.entitySlug ?? null,
        device_type: deviceType,
        browser_name: classifyBrowser(userAgent),
        os_name: classifyOs(userAgent),
        referrer_host: referrer,
        country_code: country,
        visitor_hash: hash,
        properties: event.properties ?? {},
      }),
    );

    if (pageViewEvents.has(event.name) && event.path) {
      writes.push(
        supabase.from("page_views").insert({
          path: event.path,
          locale: locale ?? defaultLocale,
          entity_type: event.entityType ?? null,
          entity_id: event.entityId ?? null,
          device_type: deviceType,
          referrer_host: referrer,
          visitor_hash: hash,
        }),
      );
    }

    const outboundContext = outboundEvents[event.name];
    if (outboundContext) {
      // The destination is the only property an outbound event needs, and it is
      // reduced to a host before storage.
      const rawUrl =
        typeof event.properties?.url === "string" ? event.properties.url : null;

      if (rawUrl) {
        writes.push(
          supabase.from("outbound_clicks").insert({
            destination_url: rawUrl.slice(0, 500),
            destination_host: destinationHost(rawUrl),
            context: outboundContext,
            entity_type: event.entityType ?? null,
            entity_id: event.entityId ?? null,
            locale,
            visitor_hash: hash,
          }),
        );
      }
    }

    await Promise.allSettled(writes);
  } catch {
    // Never surface an analytics failure to the page.
  }

  return NO_CONTENT;
}

/** Reject anything that is not a POST, without leaking why. */
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
