import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getDictionary } from "@/i18n/dictionary";
import { defaultLocale, localePath } from "@/i18n/config";

/**
 * 404 for the public site.
 *
 * `not-found.tsx` cannot read route params, so it cannot know which locale the
 * missing URL was under. Rather than guess, it renders the recovery links in the
 * default locale and offers the routes people are most likely to have been looking
 * for. Middleware guarantees every public URL is locale-prefixed, so a broken link
 * still lands here rather than on a bare Next.js error page.
 */
export default function NotFound() {
  const locale = defaultLocale;
  const t = getDictionary(locale);

  return (
    /*
     * Ink-scoped and full height, like every other public page's opening band.
     *
     * This is not only cosmetic. The site header is transparent and ink-scoped
     * until the visitor scrolls, which assumes the top of the page is dark. On
     * the previous light 404 the header's own controls came out light-on-light
     * and axe reported a serious colour-contrast violation. Every public entry
     * point therefore opens on ink.
     *
     * The negative margin pulls the band under the sticky header; the padding
     * gives the space back. Same technique as PageHeader.
     */
    <section
      data-scheme="ink"
      className="decorated flex flex-1 flex-col bg-background text-foreground"
      style={{ marginTop: "calc(-1 * var(--header-height))" }}
    >
      {/*
        A `not-found.tsx` file cannot export `metadata`, and page metadata is
        skipped when a page throws `notFound()` — so without this the 404 document
        had no <title> at all. React 19 hoists <title> into <head> from anywhere in
        the tree, which is the only way to name this document.
      */}
      <title>{t.errors.notFoundTitle}</title>

      <div aria-hidden="true" className="grid-lines" />
      <div
        aria-hidden="true"
        className="glow"
        style={{ "--glow-x": "50%", "--glow-y": "22%", "--glow-alpha": "0.18" } as object}
      />

      <div
        className="container-prose flex flex-1 flex-col items-center justify-center gap-7 pb-24 text-center"
        style={{ paddingTop: "calc(var(--header-height) + clamp(3rem, 8vw, 6rem))" }}
      >
        <span
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-(--radius-lg) border border-border bg-surface text-foreground-subtle"
        >
          <Icon name="search" size={28} />
        </span>

        <div className="flex flex-col gap-3">
          <p className="font-mono text-small text-foreground-subtle">404</p>
          <h1 className="text-h1">{t.errors.notFoundTitle}</h1>
          <p className="text-body-lg text-foreground-muted">{t.errors.notFoundBody}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink
            href={localePath(locale)}
            variant="accent"
            iconStart="arrowLeft"
            className="rounded-(--radius-full) px-5"
          >
            {t.errors.notFoundHome}
          </ButtonLink>
          <ButtonLink
            href={localePath(locale, "projects")}
            variant="outline"
            className="rounded-(--radius-full) px-5"
          >
            {t.errors.notFoundProjects}
          </ButtonLink>
          <ButtonLink
            href={localePath(locale, "certificates")}
            variant="outline"
            className="rounded-(--radius-full) px-5"
          >
            {t.errors.notFoundCertificates}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
