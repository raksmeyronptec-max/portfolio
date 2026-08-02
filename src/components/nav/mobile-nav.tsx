"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import { ButtonLink, IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Divider } from "@/components/ui/primitives";
import { LanguageSwitcher } from "./language-switcher";
import { isActiveRoute, isNavGroup, type NavEntry, type NavItem } from "./nav-items";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils/cn";

/**
 * Mobile navigation drawer.
 *
 * Built on `<Dialog variant="drawer">`, which uses the native `<dialog>`
 * element — so the focus trap, Escape handling and focus restoration come from
 * the platform rather than from hand-written key handlers. v1's menu had none of
 * those, plus no body-scroll lock.
 *
 * The drawer closes on route change, so tapping a link does not leave it open
 * over the new page. That is expressed as derived state — "open at this
 * pathname" — rather than an effect that resets a boolean when the pathname
 * changes. The derived form cannot render a stale open drawer for one frame, and
 * it also covers back/forward navigation, which a link `onClick` would miss.
 */
export function MobileNav({
  locale,
  primary,
  secondary,
  resumeHref,
  labels,
}: {
  locale: Locale;
  primary: NavEntry[];
  secondary: NavItem[];
  resumeHref: string;
  labels: {
    open: string;
    close: string;
    title: string;
    language: string;
    downloadResume: string;
  };
}) {
  const pathname = usePathname();

  // The pathname the drawer was opened on, or null when closed.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt !== null && openedAt === pathname;

  return (
    <>
      <IconButton
        icon="menu"
        label={labels.open}
        variant="outline"
        onClick={() => setOpenedAt(pathname)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="lg:hidden"
      />

      <Dialog
        open={open}
        onClose={() => setOpenedAt(null)}
        title={labels.title}
        closeLabel={labels.close}
        variant="drawer"
      >
        {/*
          Groups render flat, under a heading — not as nested accordions. The
          drawer is already a disclosure; making a visitor open a second one to
          reach Certificates would add a tap and hide the destination behind it.
          Everything the header groups is visible here in one scroll.
        */}
        <nav aria-label={labels.title}>
          <ul className="flex flex-col gap-1">
            {primary.map((entry) =>
              isNavGroup(entry) ? (
                <li key={entry.key}>
                  <p
                    className="px-3 pb-1 pt-4 text-eyebrow font-semibold uppercase text-foreground-subtle"
                    id={`drawer-group-${entry.key}`}
                  >
                    {entry.label}
                  </p>
                  <ul
                    aria-labelledby={`drawer-group-${entry.key}`}
                    className="flex flex-col gap-1"
                  >
                    {entry.items.map((item) => (
                      <MobileNavLink
                        key={item.key}
                        item={item}
                        active={isActiveRoute(pathname, item.href, locale)}
                      />
                    ))}
                  </ul>
                </li>
              ) : (
                <MobileNavLink
                  key={entry.key}
                  item={entry}
                  active={isActiveRoute(pathname, entry.href, locale)}
                />
              ),
            )}
          </ul>

          <Divider className="my-4" />

          <ul className="flex flex-col gap-1">
            {secondary.map((item) => (
              <MobileNavLink
                key={item.key}
                item={item}
                active={isActiveRoute(pathname, item.href, locale)}
              />
            ))}
          </ul>
        </nav>

        <Divider className="my-4" />

        <ButtonLink
          href={resumeHref}
          variant="primary"
          iconStart="download"
          fullWidth
        >
          {labels.downloadResume}
        </ButtonLink>

        <Divider className="my-4" />

        <LanguageSwitcher
          currentLocale={locale}
          label={labels.language}
          variant="list"
        />
      </Dialog>
    </>
  );
}

function MobileNavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-(--radius-md) px-3 text-base",
          active
            ? "bg-primary-subtle font-semibold text-primary-subtle-foreground"
            : "text-foreground hover:bg-surface-muted",
        )}
      >
        <Icon name={item.icon} size={18} className="text-foreground-muted" />
        {item.label}
      </Link>
    </li>
  );
}
