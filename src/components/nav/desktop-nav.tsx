"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavMenu } from "./nav-menu";
import { isActiveRoute, isNavGroup, type NavEntry } from "./nav-items";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils/cn";

/**
 * Desktop navigation.
 *
 * A Client Component solely to read `usePathname()` for the active state. It
 * ships no other behaviour, so the JavaScript cost is a single hook.
 *
 * Styling note: the underline is drawn by `.link-underline`, which animates
 * `background-size` from 0 to 100% on hover and stays at 100% while
 * `data-active` is set. That replaces v2's filled pill, which read as a button
 * and made the header look like a toolbar.
 *
 * The underline is never the only signal. `aria-current` carries the state for
 * assistive technology, and the active link is also a weight step heavier — so
 * it survives forced-colors mode, which drops the background image the
 * underline is painted with.
 */
export function DesktopNav({
  locale,
  items,
  label,
}: {
  locale: Locale;
  items: NavEntry[];
  label: string;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {items.map((entry) => {
          if (isNavGroup(entry)) {
            return (
              <NavMenu
                key={entry.key}
                group={entry}
                locale={locale}
                pathname={pathname}
              />
            );
          }

          const active = isActiveRoute(pathname, entry.href, locale);

          return (
            <li key={entry.key}>
              <Link
                href={entry.href}
                aria-current={active ? "page" : undefined}
                data-active={active ? "true" : undefined}
                className={cn(
                  "link-underline inline-flex min-h-9 items-center px-2.5",
                  "text-[0.9375rem] transition-colors duration-200",
                  active
                    ? "font-semibold text-foreground"
                    : "font-medium text-foreground-muted hover:text-foreground",
                )}
              >
                {entry.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
