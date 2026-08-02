import { ClosingBand } from "@/components/public/closing-band";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";

/**
 * The Experience page's closing band: the argument restated, then the three
 * routes that follow from it — the products, the résumé, a conversation.
 * Structure and restraint live in the shared `ClosingBand`; this file only
 * chooses the words and the destinations.
 */
export function ExperienceClosingCta({
  locale,
  t,
  headingId,
}: {
  locale: Locale;
  t: Dictionary;
  headingId: string;
}) {
  return (
    <ClosingBand
      headingId={headingId}
      eyebrow={t.experience.cta.eyebrow}
      heading={t.experience.cta.heading}
      body={t.experience.cta.body}
      actions={[
        {
          href: localePath(locale, "projects"),
          label: t.experience.cta.projects,
          variant: "accent",
          iconEnd: "arrowRight",
        },
        {
          href: localePath(locale, "resume"),
          label: t.nav.resume,
          variant: "outline",
          iconStart: "fileText",
        },
        {
          href: localePath(locale, "contact"),
          label: t.experience.cta.contact,
          variant: "link",
          iconEnd: "arrowRight",
        },
      ]}
    />
  );
}
