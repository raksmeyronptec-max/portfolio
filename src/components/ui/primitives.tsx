import Link from "next/link";
import type { ComponentProps, ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { Icon, type IconName } from "./icon";

/* ═══════════════════════════════════════════════════════════════════════════
   Small presentational primitives shared by the public site and the admin.
   All server-renderable: none of these needs client JavaScript.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── SmartLink ───────────────────────────────────────────────────────────────

export type SmartLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  /** Force external treatment; otherwise inferred from the href. */
  external?: boolean;
  /** Screen-reader hint appended to external links. */
  newTabHint?: string;
  showExternalIcon?: boolean;
};

/**
 * Link that decides internal vs external once, in one place.
 *
 * External links always get `rel="noopener noreferrer"` and a visually hidden
 * "opens in a new tab" hint, so the behaviour is announced rather than
 * discovered. `mailto:` and `tel:` are treated as external but never opened in a
 * new tab, because that leaves an empty tab behind.
 */
export function SmartLink({
  href,
  external,
  newTabHint,
  showExternalIcon = false,
  className,
  children,
  ...rest
}: SmartLinkProps) {
  const isProtocolLink = /^(mailto:|tel:)/i.test(href);
  const isExternal = external ?? (/^https?:\/\//i.test(href) || isProtocolLink);

  if (isExternal) {
    return (
      <a
        href={href}
        className={className}
        {...(isProtocolLink
          ? {}
          : { target: "_blank", rel: "noopener noreferrer" })}
        {...rest}
      >
        {children}
        {showExternalIcon ? (
          <Icon name="externalLink" size={14} className="ml-1 inline align-[-0.1em]" />
        ) : null}
        {!isProtocolLink && newTabHint ? (
          <span className="sr-only"> ({newTabHint})</span>
        ) : null}
      </a>
    );
  }

  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────

type BadgeTone =
  | "neutral"
  | "primary"
  | "accent"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-foreground-muted border-border",
  primary: "bg-primary-subtle text-primary-subtle-foreground border-transparent",
  accent: "bg-accent-subtle text-accent-subtle-foreground border-transparent",
  secondary:
    "bg-secondary-subtle text-secondary-subtle-foreground border-transparent",
  success: "bg-success-subtle text-success-foreground border-transparent",
  warning: "bg-warning-subtle text-warning-foreground border-transparent",
  danger: "bg-danger-subtle text-danger-foreground border-transparent",
  info: "bg-info-subtle text-info-foreground border-transparent",
};

export function Badge({
  tone = "neutral",
  icon,
  className,
  children,
  ...rest
}: {
  tone?: BadgeTone;
  icon?: IconName;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<"span">, "children" | "className">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-(--radius-full) border px-2.5 py-1",
        "text-[0.8125rem] font-medium leading-tight",
        badgeTones[tone],
        className,
      )}
      {...rest}
    >
      {icon ? <Icon name={icon} size={13} /> : null}
      {children}
    </span>
  );
}

/**
 * A live/offline style status dot.
 *
 * The dot is decorative; the adjacent text carries the meaning, so colour is
 * never the only channel. This is why there is no colour-only variant.
 */
export function StatusDot({
  tone = "success",
  className,
}: {
  tone?: "success" | "warning" | "danger" | "neutral";
  className?: string;
}) {
  const tones = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    neutral: "bg-foreground-subtle",
  } as const;

  return (
    <span
      aria-hidden="true"
      className={cn("size-2 shrink-0 rounded-full", tones[tone], className)}
    />
  );
}

// ── Tag ─────────────────────────────────────────────────────────────────────

export function Tag({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-(--radius-sm) border border-border",
        "bg-surface px-2 py-1 text-[0.8125rem] leading-tight text-foreground-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TagList({
  items,
  className,
  label,
}: {
  items: ReadonlyArray<{ id: string; label: string }>;
  className?: string;
  /** Accessible name for the list. */
  label?: string;
}) {
  if (items.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label={label}>
      {items.map((item) => (
        <li key={item.id}>
          <Tag>{item.label}</Tag>
        </li>
      ))}
    </ul>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

export function Card({
  as: Component = "div",
  interactive = false,
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  /** Adds hover affordance. Only use when the whole card is a single link. */
  interactive?: boolean;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  return (
    <Component
      className={cn(
        "rounded-(--radius-lg) border border-border bg-surface",
        "shadow-(--shadow-xs)",
        interactive &&
          "transition-[border-color,box-shadow] hover:border-border-interactive hover:shadow-(--shadow-sm) focus-within:border-border-interactive",
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("p-5 sm:p-6", className)}>{children}</div>;
}

export function CardHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("border-b border-border px-5 py-4 sm:px-6", className)}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-t border-border bg-surface-muted/50 px-5 py-4 sm:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ── Section heading ─────────────────────────────────────────────────────────

/**
 * Standard section header.
 *
 * `headingLevel` is explicit so the document outline stays correct: v1 jumped
 * from `h2` to `h4` inside the About card, which breaks screen-reader
 * navigation.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  headingLevel = 2,
  id,
  align = "start",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  headingLevel?: 1 | 2 | 3 | 4;
  id?: string;
  align?: "start" | "center";
  className?: string;
}) {
  const Heading = `h${headingLevel}` as ElementType;

  return (
    <header
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow ? (
        <p className="text-eyebrow font-semibold uppercase tracking-[0.08em] text-accent-subtle-foreground">
          {eyebrow}
        </p>
      ) : null}

      <Heading
        id={id}
        className={cn(
          headingLevel === 1 ? "text-h1" : "text-h2",
          "max-w-[42ch]",
          align === "center" && "mx-auto",
        )}
      >
        {title}
      </Heading>

      {description ? (
        <p
          className={cn(
            "max-w-[62ch] text-body-lg text-foreground-muted",
            align === "center" && "mx-auto",
          )}
        >
          {description}
        </p>
      ) : null}
    </header>
  );
}

// ── Definition list ─────────────────────────────────────────────────────────

/**
 * Key/value metadata, rendered as a real `<dl>`.
 *
 * Rows whose value is nullish are dropped, and rows explicitly marked
 * `unconfirmed` render a visible "not yet confirmed" marker instead of a value.
 * That marker is the UI half of the `needs_review` model: an unverified fact is
 * shown as unverified rather than quietly omitted or invented.
 */
export function MetaList({
  items,
  unconfirmedLabel,
  className,
}: {
  items: ReadonlyArray<{
    label: string;
    value?: ReactNode;
    unconfirmed?: boolean;
  }>;
  unconfirmedLabel?: string;
  className?: string;
}) {
  const visible = items.filter(
    (item) => item.value != null || (item.unconfirmed && unconfirmedLabel),
  );

  if (visible.length === 0) return null;

  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-4 sm:grid-cols-[auto_1fr] sm:gap-y-3",
        className,
      )}
    >
      {visible.map((item) => (
        <div key={item.label} className="sm:col-span-2 sm:grid sm:grid-cols-subgrid">
          <dt className="text-small font-medium text-foreground-muted">
            {item.label}
          </dt>
          <dd className="text-body text-foreground">
            {item.value != null ? (
              item.value
            ) : (
              <span className="italic text-foreground-subtle">
                {unconfirmedLabel}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ── Divider ─────────────────────────────────────────────────────────────────

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-t border-border", className)} />;
}

// ── Prose block ─────────────────────────────────────────────────────────────

/**
 * Renders CMS plain-text prose, preserving paragraph breaks.
 *
 * Splits on blank lines and emits real `<p>` elements. Deliberately does NOT
 * interpret HTML: the text goes in as a React child, so it is escaped by
 * construction. v1 assigned translated content with `innerHTML`; this cannot.
 */
export function ProseText({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  if (!text || text.trim() === "") return null;

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className={cn("prose-content", className)}>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>
          {paragraph.split(/\n/).map((line, lineIndex, lines) => (
            <span key={lineIndex}>
              {line}
              {lineIndex < lines.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
