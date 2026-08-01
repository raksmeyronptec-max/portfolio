"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { trackEvent } from "@/lib/analytics/track";
import { getDictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/config";

/**
 * The citation block, with copy controls.
 *
 * The citation text itself is server-rendered above the buttons, so it is
 * selectable, printable and present without JavaScript. This component only adds
 * the convenience of copying it.
 *
 * BibTeX is offered only when there is enough verified metadata to produce a
 * valid `@book` entry — `buildBibTeX()` returns `null` below that threshold and
 * this renders no button. An entry missing its author or year renders as a
 * broken reference in whatever document it lands in, and a broken button is
 * worse than an absent one.
 */
export function PublicationCitation({
  citation,
  bibtex,
  slug,
  locale,
}: {
  citation: string;
  bibtex: string | null;
  slug: string;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const [copied, setCopied] = useState<"citation" | "bibtex" | null>(null);

  const copy = async (text: string, which: "citation" | "bibtex") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      // Reverts on its own so the button does not sit permanently in a "done"
      // state that no longer describes what pressing it would do.
      window.setTimeout(() => setCopied(null), 2500);

      void trackEvent({
        name: "publication_citation_copy",
        entityType: "publication",
        entitySlug: slug,
        locale,
        properties: { format: which },
      });
    } catch {
      /*
       * Clipboard access can be refused — an insecure context, a permissions
       * policy, an older browser. Nothing is reported, because the citation is
       * already on screen and selectable: the fallback is the page itself.
       */
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-(--radius-md) border border-border bg-surface-muted p-3 text-small leading-khmer text-foreground">
        {citation}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => void copy(citation, "citation")}>
          <Icon name={copied === "citation" ? "check" : "copy"} size={16} />
          {copied === "citation" ? t.publications.citationCopied : t.publications.copyCitation}
        </Button>

        {bibtex ? (
          <Button type="button" variant="ghost" onClick={() => void copy(bibtex, "bibtex")}>
            <Icon name={copied === "bibtex" ? "check" : "copy"} size={16} />
            {copied === "bibtex" ? t.publications.bibtexCopied : t.publications.copyBibtex}
          </Button>
        ) : null}
      </div>

      {/*
       * Announced politely so a screen-reader user learns the copy succeeded.
       * The buttons' own labels change too, but a label change on an element
       * that already has focus is not reliably announced.
       */}
      <p aria-live="polite" className="sr-only">
        {copied === "citation"
          ? t.publications.citationCopied
          : copied === "bibtex"
            ? t.publications.bibtexCopied
            : ""}
      </p>

      <p className="text-[0.75rem] leading-khmer text-foreground-subtle">
        {t.publications.citationNote}
      </p>
    </div>
  );
}
