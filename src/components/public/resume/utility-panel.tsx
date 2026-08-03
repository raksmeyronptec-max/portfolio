import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";
import { interpolate } from "@/i18n/dictionary";
import { localeMeta, localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";
import { CopyButton } from "./copy-button";

/**
 * The résumé version and utility panel.
 *
 * ── What it is for ─────────────────────────────────────────────────────────
 * A reader downloading a résumé needs to know what they are getting: which
 * version, in which language, how recent, and how large. All four come from
 * the CMS row and the stored asset — nothing here is written by hand, so a new
 * upload changes the panel without anyone editing this file.
 *
 * ── The language row is load-bearing ───────────────────────────────────────
 * The page's locale and the PDF's locale are not always the same: only an
 * English résumé is published today, so the Khmer page serves it as a labelled
 * fallback. The panel therefore states the *document's* language separately
 * from the page's, and the notice explains the substitution rather than
 * letting a Khmer reader download an English file unannounced.
 *
 * Sticky on wide screens only, and `self-start` so it stops at its own height
 * rather than stretching — a sticky element as tall as the grid row can never
 * scroll, and would overlap the footer.
 */
export function ResumeUtilityPanel({
  locale,
  t,
  resume,
  pageUrl,
  alternateLocale,
  children,
}: {
  locale: Locale;
  t: Dictionary;
  resume: {
    versionLabel: string;
    documentLocale: Locale;
    updatedLabel: string;
    fileLabel: string;
    isFallback: boolean;
  } | null;
  /** Absolute URL of this page, for the copy-link control. */
  pageUrl: string;
  /** Only set when a résumé exists in the other language. */
  alternateLocale: Locale | null;
  /** The section navigation, rendered inside the panel on wide screens. */
  children?: React.ReactNode;
}) {
  return (
    <aside
      data-print="hide"
      className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start"
    >
      <div className="flex flex-col gap-4 rounded-(--radius-xl) border border-border bg-surface p-5 shadow-(--shadow-xs)">
        <h2 className="text-eyebrow font-semibold uppercase text-foreground-subtle">
          {t.resume.utility.heading}
        </h2>

        {resume ? (
          <>
            <p className="text-small font-semibold text-foreground">
              {resume.versionLabel}
            </p>

            {/*
              A definition list, because these are genuinely label/value pairs —
              and `dl` is what lets a screen reader read "Language: English"
              rather than two unrelated strings.
            */}
            <dl className="flex flex-col gap-2 text-small">
              <Row
                label={t.resume.utility.documentLanguage}
                value={localeMeta[resume.documentLocale].nativeName}
              />
              <Row label={t.resume.utility.updated} value={resume.updatedLabel} />
              <Row label={t.resume.utility.file} value={resume.fileLabel} />
            </dl>

            {resume.isFallback ? (
              <Notice tone="info">
                <p className="text-[0.8125rem]">
                  {interpolate(t.resume.noResumeForLocale, {
                    language: localeMeta[locale].nativeName,
                    fallback: localeMeta[resume.documentLocale].nativeName,
                  })}
                </p>
              </Notice>
            ) : null}
          </>
        ) : (
          <Notice tone="warning">
            <p className="text-[0.8125rem]">{t.resume.noResume}</p>
          </Notice>
        )}

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <CopyButton
            value={pageUrl}
            label={t.resume.utility.copyLink}
            copiedLabel={t.resume.utility.copied}
            failedLabel={t.resume.utility.copyFailed}
            icon="copy"
          />

          {/*
            The résumé-specific language control. It is not a duplicate of the
            header's locale switcher: this one exists to say which *document*
            the reader would get, and it only appears when a résumé in that
            language actually exists.
          */}
          {alternateLocale ? (
            <ButtonLink
              href={localePath(alternateLocale, "resume")}
              hrefLang={localeMeta[alternateLocale].tag}
              variant="outline"
              size="sm"
              className="justify-center"
            >
              {interpolate(t.resume.viewOtherLanguage, {
                language: localeMeta[alternateLocale].nativeName,
              })}
            </ButtonLink>
          ) : null}
        </div>
      </div>

      {children}
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <dt className="text-foreground-subtle">{label}</dt>
      <dd className="font-medium text-foreground-muted">{value}</dd>
    </div>
  );
}
