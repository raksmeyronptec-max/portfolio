"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActiveRoute, type NavItem } from "./nav-items";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils/cn";

/**
 * Desktop navigation.
 *
 * A Client Component solely to read `usePathname()` for the active state. It
 * ships no other behaviour, so the JavaScript cost is a single hook.
 *
 * The active item is marked with `aria-current="page"` and with a visible
 * underline — never colour alone.
 */
export function DesktopNav({
  locale,
  items,
  label,
}: {
  locale: Locale;
  items: NavItem[];
  label: string;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = isActiveRoute(pathname, item.href, locale);

          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex min-h-11 items-center rounded-[--radius-md] px-3 text-small font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {item.label}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 bottom-1.5 h-0.5 rounded-full bg-primary"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
