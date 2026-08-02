"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { isActiveRoute, type NavGroup } from "./nav-items";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils/cn";

/**
 * A disclosure menu in the desktop header.
 *
 * Deliberately a *disclosure* (button + `aria-expanded`) rather than an ARIA
 * `menu`/`menuitem` widget. The children are ordinary page links, and the menu
 * role would tell a screen reader they are application commands — it would also
 * oblige us to reimplement arrow-key roving focus and take the links out of the
 * tab order, which makes plain link navigation worse to satisfy a pattern the
 * content does not match. The APG's own guidance is that a set of links is a
 * disclosure, not a menu.
 *
 * What it therefore has to get right, all from section 6 of the brief:
 *
 *   • **Not hover-only.** Opening is a click or Enter/Space. Pointer hover is an
 *     enhancement layered on top for fine pointers, never the only way in.
 *   • **Escape closes and returns focus** to the trigger, so a keyboard visitor
 *     is not dropped at the top of the document.
 *   • **Outside click and focus-leaving close it**, the second of which is what
 *     makes Tab out of the last link behave.
 *   • **Active state is carried by the group as well.** When the current route
 *     is one of the children, the trigger is marked so the header still says
 *     where you are — `aria-current` stays on the child link itself.
 *
 * Close-on-navigation is derived from the pathname rather than run in an
 * effect: the same trick `MobileNav` uses, and for the same reason — an effect
 * would render one stale open frame and would miss back/forward.
 */
export function NavMenu({
  group,
  locale,
  pathname,
}: {
  group: NavGroup;
  locale: Locale;
  pathname: string;
}) {
  const id = useId();
  const containerRef = useRef<HTMLLIElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // The pathname the menu was opened on. Navigating changes `pathname`, which
  // closes the menu without an effect.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt !== null && openedAt === pathname;

  const close = useCallback((returnFocus: boolean) => {
    setOpenedAt(null);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) close(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
      }
    }
    // Tabbing past the last link leaves the container: close, but do not steal
    // focus back, or Tab would be a trap.
    function onFocusIn(event: FocusEvent) {
      if (!containerRef.current?.contains(event.target as Node)) close(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open, close]);

  const activeChild = group.items.some((item) =>
    isActiveRoute(pathname, item.href, locale),
  );

  return (
    <li
      ref={containerRef}
      className="relative"
      // Hover is an enhancement for fine pointers only. `onPointerEnter` with a
      // pointerType check keeps a touch tap from opening and instantly closing.
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setOpenedAt(pathname);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setOpenedAt(null);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        data-active={activeChild ? "true" : undefined}
        onClick={() => setOpenedAt(open ? null : pathname)}
        className={cn(
          "link-underline inline-flex min-h-9 items-center gap-1 px-2.5",
          "text-[0.9375rem] transition-colors duration-200",
          activeChild
            ? "font-semibold text-foreground"
            : "font-medium text-foreground-muted hover:text-foreground",
        )}
      >
        {group.label}
        <Icon
          name="chevronDown"
          size={15}
          aria-hidden
          className={cn(
            "transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {/*
        Rendered only when open rather than hidden with CSS: a closed menu's
        links must not be reachable by Tab, and `display:none` plus a transition
        is the usual way that bug ships.
      */}
      {open ? (
        <div
          id={id}
          className={cn(
            "absolute left-0 top-full z-50 min-w-56 pt-2",
            // The trigger and panel must not have a gap the pointer can cross,
            // or a mouse travelling to the panel closes it. The padding above
            // is inside the hover area; the visible panel starts below it.
          )}
        >
          <ul
            className={cn(
              "flex flex-col gap-0.5 rounded-(--radius-lg) border border-border",
              "bg-surface-raised p-2 shadow-lg",
            )}
          >
            {group.items.map((item) => {
              const active = isActiveRoute(pathname, item.href, locale);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center gap-2.5 rounded-(--radius-md) px-3",
                      "text-[0.9375rem] transition-colors duration-150",
                      active
                        ? "bg-primary-subtle font-semibold text-primary-subtle-foreground"
                        : "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
                    )}
                  >
                    <Icon name={item.icon} size={16} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </li>
  );
}
