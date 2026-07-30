import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { Icon, type IconName } from "./icon";

/* ═══════════════════════════════════════════════════════════════════════════
   Loading, empty, error, permission and offline states.

   Every module in the app uses these rather than inventing its own, so the four
   states are always covered and always look the same. Public-facing copy is
   passed in from the locale dictionary — no internal CMS vocabulary leaks to
   visitors.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Skeletons ───────────────────────────────────────────────────────────────

/**
 * `aria-hidden` because a skeleton is a visual placeholder; the accessible
 * announcement comes from the `LoadingRegion` wrapper below, so screen-reader
 * users hear "Loading" once rather than a burst of meaningless boxes.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-pulse rounded-[--radius-sm] bg-surface-muted",
        className,
      )}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <span className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-4", index === lines - 1 && "w-3/5")}
        />
      ))}
    </span>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[--radius-lg] border border-border bg-surface",
        className,
      )}
    >
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="flex flex-col gap-3 p-5">
        <Skeleton className="h-5 w-2/3" />
        <SkeletonText lines={2} />
        <span className="flex gap-2 pt-1">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </span>
      </div>
    </div>
  );
}

/**
 * Wraps a skeleton so assistive technology is told, once, that content is
 * loading. `aria-busy` plus a polite live region is the pairing that actually
 * gets announced without spamming.
 */
export function LoadingRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

// ── Shared shell ────────────────────────────────────────────────────────────

function StateShell({
  icon,
  tone,
  title,
  description,
  actions,
  className,
  role,
}: {
  icon: IconName;
  tone: "neutral" | "warning" | "danger" | "info";
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  role?: "status" | "alert";
}) {
  const tones = {
    neutral: "text-foreground-subtle bg-surface-muted",
    warning: "text-warning-foreground bg-warning-subtle",
    danger: "text-danger-foreground bg-danger-subtle",
    info: "text-info-foreground bg-info-subtle",
  } as const;

  return (
    <div
      role={role}
      className={cn(
        "flex flex-col items-center gap-4 rounded-[--radius-lg] border border-border",
        "bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          tones[tone],
        )}
      >
        <Icon name={icon} size={24} />
      </span>

      <div className="flex max-w-[52ch] flex-col gap-2">
        <p className="text-h4 font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="text-body text-foreground-muted">{description}</p>
        ) : null}
      </div>

      {actions ? <div className="flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </div>
  );
}

// ── Public states ───────────────────────────────────────────────────────────

export function EmptyState({
  icon = "inbox",
  title,
  description,
  actions,
  className,
}: {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <StateShell
      icon={icon}
      tone="neutral"
      title={title}
      description={description}
      actions={actions}
      className={className}
      role="status"
    />
  );
}

export function ErrorState({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <StateShell
      icon="alertTriangle"
      tone="danger"
      title={title}
      description={description}
      actions={actions}
      className={className}
      role="alert"
    />
  );
}

export function PermissionDeniedState({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <StateShell
      icon="lock"
      tone="warning"
      title={title}
      description={description}
      actions={actions}
      className={className}
      role="alert"
    />
  );
}

export function OfflineState({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <StateShell
      icon="wifiOff"
      tone="warning"
      title={title}
      description={description}
      actions={actions}
      className={className}
      role="status"
    />
  );
}

// ── Inline notice ───────────────────────────────────────────────────────────

/**
 * Inline message used for form-level feedback and admin warnings.
 *
 * `role="alert"` is applied only for error and warning tones. Success and info
 * use `role="status"`, which is polite — an assertive announcement for a success
 * message interrupts the user for no reason.
 */
export function Notice({
  tone = "info",
  title,
  children,
  className,
  icon,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children?: ReactNode;
  className?: string;
  icon?: IconName;
}) {
  const config = {
    info: { icon: "info", classes: "bg-info-subtle text-info-foreground border-info/25" },
    success: {
      icon: "checkCircle",
      classes: "bg-success-subtle text-success-foreground border-success/25",
    },
    warning: {
      icon: "alertTriangle",
      classes: "bg-warning-subtle text-warning-foreground border-warning/30",
    },
    danger: {
      icon: "alertCircle",
      classes: "bg-danger-subtle text-danger-foreground border-danger/30",
    },
  } as const;

  const { icon: defaultIcon, classes } = config[tone];

  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-[--radius-md] border p-4 text-small",
        classes,
        className,
      )}
    >
      <Icon name={icon ?? (defaultIcon as IconName)} size={18} className="mt-0.5" />
      <div className="flex min-w-0 flex-col gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="[&_a]:underline">{children}</div> : null}
      </div>
    </div>
  );
}
