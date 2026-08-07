import { Reveal } from "@/components/motion/reveal";

/**
 * Section header — label, heading, supporting line.
 *
 * The shared pattern for the closing sections (Teaching, Contact) and anything
 * that adopts it later. It is deliberately thinner than `SectionHead` in
 * home-sections.tsx, which additionally carries a watermark numeral and an
 * action button; this one is the plain three-part header and nothing else.
 *
 * `id` is required rather than optional: every section that uses this is
 * labelled by its heading through `aria-labelledby`, so a header without an id
 * would silently produce an unlabelled region.
 */
export function SectionHeader({
  id,
  label,
  title,
  description,
  /** `h2` inside a page that already has an `h1`. */
  headingLevel = "h2",
  className,
}: {
  id: string;
  label?: string;
  title: string;
  description?: string;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const Heading = headingLevel;

  return (
    <Reveal
      as="header"
      className={className ? `section-header ${className}` : "section-header"}
    >
      {label ? <span className="section-label">{label}</span> : null}
      <Heading id={id}>{title}</Heading>
      {description ? <p>{description}</p> : null}
    </Reveal>
  );
}
