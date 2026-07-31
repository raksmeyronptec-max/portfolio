import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { Icon, type IconName } from "./icon";

/**
 * Button system.
 *
 * Accessibility guarantees baked in here rather than left to callers:
 *  - Minimum 44×44px hit area on the default and large sizes; the small size is
 *    only permitted inside dense admin tables where it sits in a padded row.
 *  - Focus uses the global branded `:focus-visible` ring; nothing here removes
 *    an outline.
 *  - `aria-busy` while loading, and the label stays in the DOM so the accessible
 *    name never disappears mid-action.
 *  - Icon-only buttons require an explicit `label`, enforced by the type.
 */

type Variant =
  | "primary"
  | "secondary"
  | "accent"
  | "outline"
  | "ghost"
  | "danger"
  | "link";

type Size = "sm" | "md" | "lg";

const base = [
  "inline-flex items-center justify-center gap-2",
  "font-medium text-center",
  "rounded-(--radius-md)",
  "border border-transparent",
  "transition-colors duration-150",
  "disabled:opacity-55 disabled:cursor-not-allowed disabled:pointer-events-none",
  "aria-busy:cursor-progress",
  // Khmer labels wrap rather than overflow their container.
  "whitespace-normal text-balance",
].join(" ");

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
  accent: "bg-accent text-accent-foreground hover:bg-accent-hover",
  outline:
    "border-border-strong bg-surface text-foreground hover:bg-surface-muted hover:border-border-interactive",
  ghost: "bg-transparent text-foreground hover:bg-surface-muted",
  danger: "bg-danger text-white hover:brightness-95",
  link: "bg-transparent text-primary underline underline-offset-4 hover:decoration-2 rounded-(--radius-xs)",
};

const sizes: Record<Size, string> = {
  // Dense admin contexts only.
  sm: "min-h-8 px-2.5 py-1.5 text-[0.9375rem]",
  // 44px minimum touch target.
  md: "min-h-11 px-4 py-2.5 text-base",
  lg: "min-h-12 px-5 py-3 text-[1.0625rem]",
};

const iconOnlySizes: Record<Size, string> = {
  sm: "min-h-8 w-8 p-0",
  md: "min-h-11 w-11 p-0",
  lg: "min-h-12 w-12 p-0",
};

type SharedProps = {
  variant?: Variant;
  size?: Size;
  /** Icon shown before the label. */
  iconStart?: IconName;
  /** Icon shown after the label. */
  iconEnd?: IconName;
  /** Stretch to the container width. */
  fullWidth?: boolean;
};

function classesFor({
  variant = "primary",
  size = "md",
  fullWidth,
  iconOnly,
  className,
}: SharedProps & { iconOnly?: boolean; className?: string }) {
  return cn(
    base,
    variants[variant],
    iconOnly ? iconOnlySizes[size] : sizes[size],
    fullWidth && "w-full",
    className,
  );
}

// ── Button ──────────────────────────────────────────────────────────────────

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  SharedProps & {
    /** Shows a spinner and sets aria-busy. The label is retained. */
    loading?: boolean;
    children: ReactNode;
  };

export function Button({
  variant,
  size,
  iconStart,
  iconEnd,
  fullWidth,
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classesFor({ variant, size, fullWidth, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : iconStart ? <Icon name={iconStart} size={18} /> : null}
      <span>{children}</span>
      {iconEnd && !loading ? <Icon name={iconEnd} size={18} /> : null}
    </button>
  );
}

// ── IconButton ──────────────────────────────────────────────────────────────

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> &
  Omit<SharedProps, "iconStart" | "iconEnd"> & {
    icon: IconName;
    /** Required: an icon alone has no accessible name. */
    label: string;
    loading?: boolean;
  };

export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  loading = false,
  className,
  disabled,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={classesFor({ variant, size, iconOnly: true, className })}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : <Icon name={icon} size={size === "sm" ? 16 : 20} />}
    </button>
  );
}

// ── ButtonLink ──────────────────────────────────────────────────────────────

export type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> &
  SharedProps & {
    className?: string;
    /**
     * External destination. Adds `target="_blank"` with
     * `rel="noopener noreferrer"` and an "opens in a new tab" hint for screen
     * readers, so the behaviour is never a surprise.
     */
    external?: boolean;
    /** Screen-reader-only text appended for external links. */
    externalHint?: string;
    children: ReactNode;
  };

export function ButtonLink({
  variant,
  size,
  iconStart,
  iconEnd,
  fullWidth,
  className,
  external = false,
  externalHint,
  children,
  ...rest
}: ButtonLinkProps) {
  const externalProps = external
    ? { target: "_blank", rel: "noopener noreferrer" as const }
    : {};

  return (
    <Link
      className={classesFor({ variant, size, fullWidth, className })}
      {...externalProps}
      {...rest}
    >
      {iconStart ? <Icon name={iconStart} size={18} /> : null}
      <span>{children}</span>
      {iconEnd ? <Icon name={iconEnd} size={18} /> : null}
      {external && !iconEnd ? <Icon name="externalLink" size={16} /> : null}
      {external && externalHint ? (
        <span className="sr-only"> ({externalHint})</span>
      ) : null}
    </Link>
  );
}

// ── Spinner ─────────────────────────────────────────────────────────────────

/**
 * `animate-spin` is a CSS animation, so the global
 * `prefers-reduced-motion` rule in globals.css already stops it for users who
 * ask for reduced motion; the icon then reads as a static glyph.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-[18px] animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeOpacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
