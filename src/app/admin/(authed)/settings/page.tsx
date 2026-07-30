import type { Metadata } from "next";

import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { SettingsForm } from "@/components/admin/settings-form";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { Notice } from "@/components/ui/states";
import { requirePermission } from "@/lib/auth/guards";
import { getSiteSettingsRow } from "@/lib/data/admin-cv";
import { isSupabaseConfigured, siteUrl } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  // Owner-only: these values appear on every page and include the contact channel.
  await requirePermission("manageSettings", "/admin/settings");

  const settings = await getSiteSettingsRow();

  const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);

  return (
    <>
      <AdminPageHeader
        title="Settings"
        description="Site-wide values used across the public portfolio: identity, hero copy, availability, contact channels and feature switches."
      />

      <AdminPageBody className="flex flex-col gap-6">
        <SettingsForm initial={settings ?? {}} />

        {/* ── Environment ──────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <h2 className="text-h4 font-semibold">Environment</h2>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <p className="text-small text-foreground-muted">
              These are set as environment variables, not here — secrets do not belong
              in a database row that an editor can read. Values are never displayed;
              only whether they are present.
            </p>

            <dl className="flex flex-col gap-2.5 text-small">
              <EnvRow
                label="Public site URL"
                value={siteUrl()}
                note="Used for canonical URLs, hreflang, Open Graph and the sitemap."
              />
              <EnvRow
                label="Supabase"
                value={isSupabaseConfigured() ? "Configured" : "Not configured"}
                ok={isSupabaseConfigured()}
              />
              <EnvRow
                label="Telegram notifications"
                value={telegramConfigured ? "Configured" : "Not configured"}
                ok={telegramConfigured}
                note={
                  telegramConfigured
                    ? undefined
                    : "The contact form still works and saves messages; it simply does not claim a notification was delivered."
                }
              />
              <EnvRow
                label="Gemini API (chat widget)"
                value={geminiConfigured ? "Configured" : "Not configured"}
                ok={geminiConfigured}
                note="Only needed if the chat widget is enabled."
              />
            </dl>

            <Notice tone="warning" icon="shield" title="Outstanding security action">
              <p>
                The previous version of this site committed a live Telegram bot token to
                the repository. That token must be revoked and regenerated in
                @BotFather, and the new value set as <code>TELEGRAM_BOT_TOKEN</code> in
                the host&apos;s environment variables. See <code>docs/AUDIT.md</code>.
              </p>
            </Notice>
          </CardBody>
        </Card>
      </AdminPageBody>
    </>
  );
}

function EnvRow({
  label,
  value,
  ok,
  note,
}: {
  label: string;
  value: string;
  ok?: boolean;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border pb-2.5 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <dt className="font-medium">{label}</dt>
        <dd
          className={
            ok === undefined
              ? "font-mono text-[0.8125rem] text-foreground-muted"
              : ok
                ? "font-medium text-success-foreground"
                : "font-medium text-warning-foreground"
          }
        >
          {value}
        </dd>
      </div>
      {note ? (
        <p className="text-[0.75rem] text-foreground-subtle">{note}</p>
      ) : null}
    </div>
  );
}
