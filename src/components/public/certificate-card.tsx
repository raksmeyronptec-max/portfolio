import Image from "next/image";
import Link from "next/link";

import { Badge, Card, StatusDot } from "@/components/ui/primitives";
import { Icon, toIconName } from "@/components/ui/icon";
import { formatDate, type Dictionary } from "@/i18n/dictionary";
import { localePath, type Locale } from "@/i18n/config";
import { resolveImage } from "@/lib/content/media";
import { langAttribute } from "@/lib/content/translation";
import type { CertificateCardData } from "@/lib/data/certificates";

/**
 * Certificate card.
 *
 * Only ever renders the redacted public preview. The private original has no
 * public URL — `resolveImage` returns null for any private asset, so this
 * component physically cannot display a raw scan even if one were wired in by
 * mistake.
 */
export function CertificateCard({
  certificate,
  locale,
  t,
  headingLevel = 3,
}: {
  certificate: CertificateCardData;
  locale: Locale;
  t: Dictionary;
  headingLevel?: 2 | 3 | 4;
}) {
  const preview = resolveImage(certificate.preview, locale, "card");
  const href = localePath(locale, `certificates/${certificate.slug}`);
  const contentLang = langAttribute(locale, certificate.contentLocale);
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";

  const statusTone =
    certificate.credentialStatus === "active"
      ? "success"
      : certificate.credentialStatus === "unverified"
        ? "warning"
        : certificate.credentialStatus === "expired"
          ? "neutral"
          : "danger";

  return (
    <Card
      as="article"
      interactive
      className="group relative isolate flex flex-1 flex-col overflow-hidden"
    >
      {/*
        4:3 preview box. The ratio is fixed so a mix of portrait scans and
        landscape certificates never reflows the grid.
      */}
      <div className="relative aspect-[4/3] overflow-hidden border-b border-border bg-surface-muted">
        {preview ? (
          <Image
            src={preview.src}
            alt={preview.alt || certificate.title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            loading="lazy"
            placeholder={preview.blurDataURL ? "blur" : undefined}
            blurDataURL={preview.blurDataURL ?? undefined}
            className="object-contain p-3"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center text-foreground-subtle"
            aria-hidden="true"
          >
            <Icon name={toIconName(certificate.category?.icon, "award")} size={30} />
          </div>
        )}

        {certificate.featured ? (
          <span className="absolute left-2.5 top-2.5">
            <Badge tone="accent" icon="star">
              {t.common.featured}
            </Badge>
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {certificate.category ? (
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-accent-subtle-foreground">
            {certificate.category.name}
          </p>
        ) : null}

        <Heading className="text-[1.0625rem] font-semibold leading-snug">
          <Link
            href={href}
            lang={contentLang}
            className="after:absolute after:inset-0 after:content-[''] hover:text-primary"
          >
            {certificate.title}
          </Link>
        </Heading>

        <p className="text-small text-foreground-muted">{certificate.issuer}</p>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2 text-[0.8125rem] text-foreground-muted">
          {certificate.issuedOn ? (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="clock" size={14} />
              {formatDate(certificate.issuedOn, locale, {
                year: "numeric",
                month: "short",
              })}
            </span>
          ) : null}

          {/* Status is text + a dot, never colour alone. */}
          <span className="inline-flex items-center gap-1.5">
            <StatusDot tone={statusTone} />
            {t.certificates.status[certificate.credentialStatus]}
          </span>
        </div>
      </div>
    </Card>
  );
}
