"use client";

import { Icon } from "@/components/ui/icon";
import { trackEvent } from "@/lib/analytics/track";
import type { Locale } from "@/i18n/config";

/**
 * Resume download link.
 *
 * Points at `/api/resume/download`, not directly at the storage object. The route
 * handler resolves the currently active version server-side, increments the
 * counter, records a download event, and only then streams the file. Linking
 * straight to storage would make the download count unknowable and would hardcode
 * a URL that changes whenever a new version is activated.
 *
 * It is a real `<a download>`, so it works without JavaScript; the tracking call
 * is additive.
 */
export function ResumeDownloadButton({
  locale,
  resumeId,
  label,
  fileHint,
}: {
  locale: Locale;
  resumeId: string;
  label: string;
  /** e.g. "PDF, 240 KB" — announced with the link. */
  fileHint: string;
}) {
  return (
    <a
      href={`/api/resume/download?locale=${locale}`}
      onClick={() => {
        void trackEvent({
          name: "resume_download",
          locale,
          entityType: "resume",
          entityId: resumeId,
        });
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) bg-primary px-4 text-base font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
    >
      <Icon name="download" size={18} />
      <span>{label}</span>
      {/*
        Visible to everyone: knowing the type and size before clicking is useful
        sighted-user information too, not just an a11y accommodation.

        No `opacity` here. It used to be `opacity-80`, which took 13px text
        below 4.5:1 against the button fill and was the only accessibility
        failure Lighthouse found on this page. Size and weight already
        distinguish the hint from the label; dimming it as well was buying a
        visual nicety with contrast.
      */}
      <span className="text-[0.8125rem] font-normal">({fileHint})</span>
    </a>
  );
}
