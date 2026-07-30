"use client";

import { useSyncExternalStore } from "react";

import { IconButton } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics/track";
import { THEME_STORAGE_KEY } from "./theme-script";

type Theme = "light" | "dark";

/**
 * Light/dark toggle.
 *
 * The `data-theme` attribute on `<html>` is the single source of truth. It is set
 * before first paint by `ThemeScript`, so this component subscribes to it rather
 * than keeping a parallel copy in React state — which is why there is no flash
 * and no hydration mismatch.
 *
 * `useSyncExternalStore` is the right tool for exactly this: an external mutable
 * value (a DOM attribute) that React must render consistently. The earlier
 * version read the attribute in an effect and mirrored it into state, which meant
 * two sources of truth and a guaranteed second render on every mount.
 *
 * The server snapshot is `null`, so SSR renders a neutral button and the label
 * only claims a direction once the client knows which way that is.
 */

function subscribe(onStoreChange: () => void): () => void {
  // The attribute changes when this component toggles it, when another tab's
  // storage event is handled, or when the OS scheme changes below.
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function handleSchemeChange(event: MediaQueryListEvent) {
    // Follow the OS only while the visitor has not made an explicit choice.
    try {
      if (localStorage.getItem(THEME_STORAGE_KEY)) return;
    } catch {
      // A blocked localStorage read means no stored preference is observable, so
      // following the OS is the correct fallback.
    }
    applyTheme(event.matches ? "dark" : "light");
  }

  media.addEventListener("change", handleSchemeChange);

  return () => {
    observer.disconnect();
    media.removeEventListener("change", handleSchemeChange);
  };
}

function getClientSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

function getServerSnapshot(): null {
  return null;
}

function applyTheme(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);
  document.documentElement.style.colorScheme = next;
}

export function ThemeToggle({
  labels,
}: {
  labels: { toggle: string; toLight: string; toDark: string };
}) {
  const theme = useSyncExternalStore<Theme | null>(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";

    // Writing the attribute is the state change; the MutationObserver above
    // re-renders this component.
    applyTheme(next);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private browsing can reject writes; the theme still applies for the
      // current page, which is the best available outcome.
    }

    void trackEvent({ name: "theme_change", properties: { theme: next } });
  }

  const isDark = theme === "dark";

  return (
    <IconButton
      icon={isDark ? "sun" : "moon"}
      label={theme === null ? labels.toggle : isDark ? labels.toLight : labels.toDark}
      variant="outline"
      onClick={toggle}
      // Announces the current state, not just the action.
      aria-pressed={theme === null ? undefined : isDark}
    />
  );
}
