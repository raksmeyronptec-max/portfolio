import { Icon } from "@/components/ui/icon";
import type { Dictionary } from "@/i18n/messages/en";
import type { CertificateOverview } from "@/lib/data/certificates";

/**
 * What this collection is, in three numbers and three promises.
 *
 * ── The numbers ────────────────────────────────────────────────────────────
 * Deliberately not "10 verified credentials". None of the published credentials
 * has a working issuer verification route, so that figure would be zero — and
 * under the old conflated status field it would have read ten, which is how the
 * page came to imply verification it could not support.
 *
 * Instead: how many are published, how many have been established as genuine by
 * some route, and how many have not. The third number is not a failure count.
 * Most of these are Cambodian school and university documents whose issuers run
 * no online verification service, and saying that plainly is more credible than
 * a badge that means nothing.
 *
 * Every figure comes from the same RLS-constrained query the listing uses, so it
 * cannot drift from what a visitor can browse to, and it updates itself when a
 * credential is published.
 *
 * ── No animated counter ────────────────────────────────────────────────────
 * The brief rules it out and it would be wrong here anyway: a number that counts
 * up draws attention to the size of the collection, which is not the claim this
 * page is making.
 */
export function CredentialOverview({
  overview,
  t,
}: {
  overview: CertificateOverview;
  t: Dictionary;
}) {
  // Nothing published yet: the empty state below the filters already says so,
  // and three zeros would be a worse way to say it.
  if (overview.published === 0) return null;

  const figures = [
    { value: overview.published, label: t.certificates.overviewPublished },
    { value: overview.established, label: t.certificates.overviewEstablished },
    { value: overview.notEstablished, label: t.certificates.overviewNotEstablished },
  ];

  const promises = [
    {
      icon: "shield" as const,
      title: t.certificates.trust.privacyTitle,
      body: t.certificates.trust.privacyBody,
    },
    {
      icon: "checkCircle" as const,
      title: t.certificates.trust.verificationTitle,
      body: t.certificates.trust.verificationBody,
    },
    {
      icon: "lock" as const,
      title: t.certificates.trust.accessTitle,
      body: t.certificates.trust.accessBody,
    },
  ];

  return (
    <section
      aria-labelledby="credential-overview-heading"
      className="flex flex-col gap-6 rounded-(--radius-lg) border border-border bg-surface-muted/50 p-6 sm:p-8"
    >
      <h2 id="credential-overview-heading" className="sr-only">
        {t.certificates.overviewHeading}
      </h2>

      {/*
        A description list, not three divs: the number is the term and the
        sentence is its definition, which is exactly what a screen reader should
        hear as a pair rather than as six unrelated fragments.
      */}
      <dl className="grid gap-5 sm:grid-cols-3">
        {figures.map((figure) => (
          <div key={figure.label} className="flex flex-col gap-1">
            <dt className="text-h2 font-semibold tabular-nums leading-none">
              {figure.value}
            </dt>
            <dd className="max-w-[28ch] text-[0.8125rem] leading-relaxed text-foreground-muted">
              {figure.label}
            </dd>
          </div>
        ))}
      </dl>

      <hr className="border-t border-border" />

      <ul className="grid gap-5 sm:grid-cols-3">
        {promises.map((promise) => (
          <li key={promise.title} className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2 text-small font-semibold">
              <Icon
                name={promise.icon}
                size={15}
                aria-hidden="true"
                className="text-secondary"
              />
              {promise.title}
            </span>
            <span className="max-w-[34ch] text-[0.8125rem] leading-relaxed text-foreground-muted">
              {promise.body}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
