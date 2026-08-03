import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Breadcrumbs } from "@/components/ui/navigation";
import { PrintButton } from "@/components/public/print-button";
import { ResumeDownloadButton } from "@/components/public/resume-download";
import { StatusDot } from "@/components/ui/primitives";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";

/**
 * The résumé's identity header.
 *
 * ── The name is the H1 ─────────────────────────────────────────────────────
 * The old page's H1 was the word "Resume" and the person's name sat below it
 * as an H2. On a document whose entire purpose is to introduce someone, the
 * name is the heading — "Resume" is the document type, and it belongs in the
 * eyebrow, the breadcrumb and the `<title>`, all of which still carry it.
 *
 * ── Actions are here, not further down ─────────────────────────────────────
 * Download, print and contact sit in the first viewport on every width. A
 * recruiter who wants the PDF should never have to scroll to find it, and on
 * mobile that means the actions come before the version panel rather than
 * after it.
 *
 * The whole band is `data-scheme="ink"` and is hidden in print — on paper the
 * identity is re-rendered as plain text by the print header, which needs no
 * buttons and no dark ground.
 */
export function ResumeIdentity({
  locale,
  t,
  name,
  location,
  availability,
  resume,
}: {
  locale: Locale;
  t: Dictionary;
  name: string;
  location: string | null;
  /** Only rendered when the CMS actually flags availability. */
  availability: string | null;
  /** Null when nothing is published — the download simply does not render. */
  resume: { id: string; fileHint: string } | null;
}) {
  return (
    <section
      data-scheme="ink"
      data-print="hide"
      className="decorated bg-background text-foreground"
      style={{ marginTop: "calc(-1 * var(--header-height))" }}
    >
      <div
        aria-hidden="true"
        className="grid-lines"
        style={{ "--grid-alpha": "0.05" } as object}
      />
      <div
        aria-hidden="true"
        className="glow"
        style={
          {
            "--glow-x": "82%",
            "--glow-y": "16%",
            "--glow-size": "54%",
            "--glow-alpha": "0.2",
          } as object
        }
      />

      <div
        className="container-content flex flex-col gap-7 pb-12 sm:pb-14"
        style={{
          paddingTop: "calc(var(--header-height) + clamp(2rem, 4vw, 3rem))",
        }}
      >
        <Breadcrumbs
          items={[
            { label: t.nav.home, href: localePath(locale) },
            { label: t.nav.resume },
          ]}
          label={t.a11y.breadcrumb}
        />

        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2.5 text-eyebrow font-semibold uppercase text-accent">
            <span aria-hidden="true" className="h-px w-8 bg-accent" />
            {t.resume.eyebrow}
          </p>

          {/*
            The name, at display weight but not homepage-hero scale — a résumé
            header introduces a document, it does not compete with the landing
            page it was reached from.
          */}
          <h1 className="text-h1 max-w-[16ch]">{name}</h1>

          {/*
            The role line, and deliberately not the summary.

            The Profile section begins immediately below this band with the
            full summary paragraph; printing it here as well put the same
            sixty words on screen twice, a hand's width apart. The header
            establishes who and where, the profile says what — which is also
            the order a résumé is read in.
          */}
          <p className="text-body-lg font-medium text-foreground-muted">
            {t.resume.role}
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-small text-foreground-subtle">
            {location ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="mapPin" size={15} aria-hidden="true" />
                {location}
              </span>
            ) : null}

            {/*
              Availability renders only when the CMS flag is set *and* a status
              line exists — the page never invents one, and a closed status
              simply removes the row rather than printing "unavailable".
            */}
            {availability ? (
              <span className="inline-flex items-center gap-2 rounded-(--radius-full) bg-success-subtle px-3 py-1 text-[0.8125rem] font-medium text-success-foreground">
                <StatusDot tone="success" className="size-1.5" />
                {availability}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {resume ? (
            <ResumeDownloadButton
              locale={locale}
              resumeId={resume.id}
              label={t.resume.download}
              fileHint={resume.fileHint}
            />
          ) : null}

          <PrintButton label={t.resume.print} />

          <ButtonLink
            href={localePath(locale, "contact")}
            variant="link"
            iconEnd="arrowRight"
          >
            {t.resume.cta.contact}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
