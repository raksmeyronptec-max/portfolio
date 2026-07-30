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
    <div className="container-prose flex min-h-[60vh] flex-col items-center justify-center gap-6 py-16 text-center">
      {/*
        A `not-found.tsx` file cannot export `metadata`, and page metadata is
        skipped when a page throws `notFound()` — so without this the 404 document
        had no <title> at all. React 19 hoists <title> into <head> from anywhere in
        the tree, which is the only way to name this document.
      */}
      <title>{t.errors.notFoundTitle}</title>

      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full bg-surface-muted text-foreground-subtle"
      >
        <Icon name="search" size={26} />
      </span>

      <div className="flex flex-col gap-3">
        <p className="font-mono text-small text-foreground-subtle">404</p>
        <h1 className="text-h1 font-bold">{t.errors.notFoundTitle}</h1>
        <p className="text-body-lg text-foreground-muted">{t.errors.notFoundBody}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href={localePath(locale)} variant="primary" iconStart="arrowLeft">
          {t.errors.notFoundHome}
        </ButtonLink>
        <ButtonLink href={localePath(locale, "projects")} variant="outline">
          {t.errors.notFoundProjects}
        </ButtonLink>
        <ButtonLink href={localePath(locale, "certificates")} variant="outline">
          {t.errors.notFoundCertificates}
        </ButtonLink>
      </div>
    </div>
  );
}
