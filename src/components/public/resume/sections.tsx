import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/icon";
import { SmartLink, StatusDot, Tag } from "@/components/ui/primitives";
import type { Locale } from "@/i18n/config";
import { localePath } from "@/i18n/config";
import type { Dictionary } from "@/i18n/messages/en";
import type {
  CapabilityGroup,
  ResumeContactLink,
  ResumeEducationEntry,
  ResumeExperienceEntry,
  ResumeProjectInput,
  ResumePublicationEntry,
} from "@/lib/content/resume-view";
import { cn } from "@/lib/utils/cn";

/**
 * The résumé's body sections.
 *
 * ── Editorial rows, not cards ──────────────────────────────────────────────
 * Experience and education are rendered as open rows with a date column and a
 * hairline rule, not as bordered cards. A résumé is read in one pass, and a
 * stack of cards forces the eye to re-enter a container for every entry —
 * besides printing as a wall of boxes. Cards are kept for the things that
 * genuinely are discrete objects: capability groups and project entries.
 *
 * ── Everything here is a Server Component ──────────────────────────────────
 * There is no state on this page beyond the two copy buttons and the section
 * nav, so nothing below ships JavaScript.
 */

// ── Section shell ───────────────────────────────────────────────────────────

export function ResumeSection({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  /** "Full experience details" — a way out to the page that holds it all. */
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="resume-section flex scroll-mt-24 flex-col gap-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2">
        <h2
          id={`${id}-heading`}
          className="text-eyebrow font-semibold uppercase text-accent-subtle-foreground"
        >
          {title}
        </h2>

        {action ? (
          <Link
            href={action.href}
            data-print="hide"
            className="inline-flex min-h-11 items-center text-[0.8125rem] font-medium text-primary underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current print:min-h-0"
          >
            {action.label}
          </Link>
        ) : null}
      </div>

      {children}
    </section>
  );
}

// ── Experience ──────────────────────────────────────────────────────────────

export function ResumeExperienceList({
  t,
  entries,
}: {
  t: Dictionary;
  entries: ResumeExperienceEntry[];
}) {
  return (
    <ol className="flex flex-col">
      {entries.map((entry) => (
        <li
          key={entry.id}
          /*
            `resume-entry` is the print hook: entries avoid breaking across
            pages, while the section around them stays breakable. Doing it the
            other way round is what left the old print output with a blank
            first page.
          */
          className="resume-entry resume-entry-lg grid gap-x-6 border-b border-border py-4 first:pt-0 last:border-b-0 sm:grid-cols-[9.5rem_minmax(0,1fr)]"
        >
          <div className="flex flex-col gap-1 pb-1 sm:pb-0">
            <p className="font-mono text-[0.8125rem] text-foreground-subtle">
              {entry.periodLabel}
            </p>
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-foreground-subtle">
              {entry.categoryLabel}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="text-h4 font-semibold">{entry.roleTitle}</h3>
              {entry.isCurrent ? (
                <span className="inline-flex items-center gap-1.5 rounded-(--radius-full) bg-success-subtle px-2.5 py-0.5 text-[0.75rem] font-semibold text-success-foreground">
                  <StatusDot tone="success" className="size-1.5" />
                  {t.resume.experience.current}
                </span>
              ) : null}
            </div>

            <p className="text-small font-medium text-foreground-muted">
              {[entry.organization, entry.location].filter(Boolean).join(" · ")}
            </p>

            {entry.summary ? (
              <p className="max-w-[68ch] text-small text-foreground-muted">
                {entry.summary}
              </p>
            ) : null}

            {entry.contributions.length > 0 ? (
              <ul className="flex flex-col gap-1 pt-0.5">
                {entry.contributions.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2.5 text-small text-foreground-muted"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[0.55em] size-1 shrink-0 rounded-full bg-border-strong"
                    />
                    <span className="max-w-[66ch]">{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {entry.evidence.length > 0 ? (
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-1 text-[0.8125rem]">
                <span className="font-semibold text-foreground-subtle">
                  {t.resume.experience.evidence}
                </span>
                {entry.evidence.map((item, index) => (
                  <span key={item.id} className="text-foreground-muted">
                    {index > 0 ? <span aria-hidden="true"> · </span> : null}
                    <SmartLink
                      href={item.href}
                      className="underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                    >
                      {item.label}
                    </SmartLink>
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Education ───────────────────────────────────────────────────────────────

export function ResumeEducationList({
  t,
  current,
  completed,
}: {
  t: Dictionary;
  current: ResumeEducationEntry[];
  completed: ResumeEducationEntry[];
}) {
  return (
    <div className="flex flex-col gap-5">
      {current.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-foreground-subtle">
            {t.resume.education.currentHeading}
          </h3>

          <ul className="flex flex-col">
            {current.map((entry) => (
              <li
                key={entry.id}
                className="resume-entry grid gap-x-6 border-b border-border py-3 first:pt-0 last:border-b-0 sm:grid-cols-[9.5rem_minmax(0,1fr)]"
              >
                <p className="font-mono text-[0.8125rem] text-foreground-subtle">
                  {entry.periodLabel}
                </p>

                <div className="flex flex-col gap-0.5">
                  <h4 className="text-body font-semibold">{entry.institution}</h4>
                  {entry.qualification ? (
                    <p className="text-small text-foreground-muted">
                      {entry.qualification}
                    </p>
                  ) : null}
                  {entry.fieldOfStudy ? (
                    <p className="text-[0.8125rem] text-foreground-subtle">
                      {entry.fieldOfStudy}
                      {entry.scheduleLabel ? ` · ${entry.scheduleLabel}` : ""}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {completed.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-foreground-subtle">
            {t.resume.education.completedHeading}
          </h3>

          <ul className="flex flex-col">
            {completed.map((entry) => (
              <li
                key={entry.id}
                className="resume-entry grid gap-x-6 border-b border-border py-3 first:pt-0 last:border-b-0 sm:grid-cols-[9.5rem_minmax(0,1fr)]"
              >
                <p className="font-mono text-[0.8125rem] text-foreground-subtle">
                  {entry.periodLabel}
                </p>

                <div className="flex flex-col gap-0.5">
                  <h4 className="text-small font-semibold">
                    {entry.qualification ?? entry.institution}
                  </h4>
                  {entry.qualification ? (
                    <p className="text-[0.8125rem] text-foreground-muted">
                      {entry.institution}
                    </p>
                  ) : null}
                  {/* A grade is never shown without the scale that awarded it. */}
                  {entry.gradeValue && entry.gradeScale ? (
                    <p className="text-[0.8125rem] text-foreground-muted">
                      <span className="font-medium">{t.resume.education.result}:</span>{" "}
                      {entry.gradeValue} — {entry.gradeScale}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ── Capabilities ────────────────────────────────────────────────────────────

export function ResumeCapabilities({ groups }: { groups: CapabilityGroup[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {groups.map((group) => (
        <div
          key={group.id}
          className="resume-entry resume-capability-group flex flex-col gap-2 rounded-(--radius-lg) border border-border bg-surface p-4"
        >
          <h3 className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-foreground-subtle">
            {group.label}
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {group.items.map((item) => (
              <li key={item}>
                <Tag>{item}</Tag>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ── Projects ────────────────────────────────────────────────────────────────

export function ResumeProjects({
  locale,
  t,
  projects,
}: {
  locale: Locale;
  t: Dictionary;
  projects: ResumeProjectInput[];
}) {
  return (
    <ul className="flex flex-col">
      {projects.map((project) => (
        <li
          key={project.id}
          className="resume-entry flex flex-col gap-1.5 border-b border-border py-4 first:pt-0 last:border-b-0"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="text-h4 font-semibold">{project.title}</h3>
            {project.categories.length > 0 ? (
              <p className="text-[0.8125rem] text-foreground-subtle">
                {project.categories.map((c) => c.name).join(" · ")}
              </p>
            ) : null}
          </div>

          {project.summary ? (
            <p className="max-w-[68ch] text-small text-foreground-muted">
              {project.summary}
            </p>
          ) : null}

          {project.role ? (
            <p className="text-[0.8125rem] text-foreground-muted">
              <span className="font-semibold">{t.resume.projects.role}:</span>{" "}
              {project.role}
            </p>
          ) : null}

          {/*
            Descriptive links, never the bare URL as body text — that was the
            old page's habit and it printed three raw addresses mid-document.
            The print stylesheet appends the real URL after the label, which is
            where a URL is actually useful.
          */}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-[0.8125rem]">
            <SmartLink
              href={localePath(locale, `projects/${project.slug}`)}
              className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4 print:min-h-0"
            >
              {t.resume.projects.viewProject}
            </SmartLink>

            {project.liveUrl ? (
              <SmartLink
                href={project.liveUrl}
                newTabHint={t.a11y.opensInNewTab}
                className="inline-flex min-h-11 items-center font-medium text-foreground-muted underline underline-offset-4 print:min-h-0"
              >
                {t.resume.projects.visitLive}
              </SmartLink>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  );
}

// ── Publications ────────────────────────────────────────────────────────────

export function ResumePublications({
  publications,
}: {
  publications: ResumePublicationEntry[];
}) {
  return (
    <ul className="flex flex-col gap-3">
      {publications.map((publication) => (
        <li key={publication.id} className="resume-entry flex flex-col gap-0.5">
          <h3 className="text-small font-semibold">
            <SmartLink
              href={publication.href}
              className="underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
            >
              {publication.title}
            </SmartLink>
          </h3>
          {publication.meta ? (
            <p className="text-[0.8125rem] text-foreground-subtle">
              {publication.meta}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// ── Languages ───────────────────────────────────────────────────────────────

export function ResumeLanguages({
  languages,
}: {
  languages: Array<{ id: string; name: string; proficiency: string }>;
}) {
  return (
    <ul className="flex flex-wrap gap-x-8 gap-y-2">
      {languages.map((language) => (
        <li key={language.id} className="text-small">
          <span className="font-semibold">{language.name}</span>
          {language.proficiency ? (
            <span className="text-foreground-muted"> — {language.proficiency}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// ── Contact ─────────────────────────────────────────────────────────────────

const CONTACT_ICONS: Record<ResumeContactLink["icon"], IconName> = {
  mail: "mail",
  telegram: "telegram",
  globe: "globe",
  linkedin: "externalLink",
  mapPin: "mapPin",
};

export function ResumeContact({
  t,
  links,
  availability,
  copySlot,
}: {
  /** Used for the availability label and the external-link hint. */
  t: Dictionary;
  links: ResumeContactLink[];
  availability: string | null;
  /** The copy-email control, injected so this stays a Server Component. */
  copySlot?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/*
        A real `<address>`: it is the element for the contact details of its
        nearest article or document, which is exactly what this is.
      */}
      <address className="not-italic">
        <ul className="grid gap-3 sm:grid-cols-2">
          {links.map((link) => (
            <li key={link.id} className="flex items-start gap-2.5">
              <Icon
                name={CONTACT_ICONS[link.icon]}
                size={16}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-foreground-subtle"
              />

              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-foreground-subtle">
                  {link.label}
                </span>

                <span className="flex flex-wrap items-center gap-2">
                  <SmartLink
                    href={link.href}
                    newTabHint={
                      link.href.startsWith("http") ? t.a11y.opensInNewTab : undefined
                    }
                    className={cn(
                      "text-small font-medium text-foreground",
                      "underline decoration-border-strong underline-offset-4",
                      "transition-colors hover:decoration-current",
                      // Long addresses wrap rather than overflowing at 320px.
                      "break-words",
                    )}
                  >
                    {link.display}
                  </SmartLink>

                  {link.id === "email" ? copySlot : null}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </address>

      {availability ? (
        <p className="text-small text-foreground-muted">
          <span className="font-semibold">{t.resume.contact.availability}:</span>{" "}
          {availability}
        </p>
      ) : null}
    </div>
  );
}
