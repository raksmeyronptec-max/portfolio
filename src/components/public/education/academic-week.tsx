import { Reveal } from "@/components/motion/reveal";
import type { Dictionary } from "@/i18n/messages/en";
import type { ProgrammeView } from "@/lib/content/education-view";
import { educationTrackMark } from "./marks";

/**
 * One academic week, two institutions.
 *
 * The schedules are the single most telling fact on this page — two degrees
 * held simultaneously by splitting the week — and the old page buried them as
 * a "Schedule: Monday – Friday" metadata row. This draws the split once,
 * statically.
 *
 * ── Honesty constraints ────────────────────────────────────────────────────
 * The CMS stores exactly one fact per programme: a day-range label. So the
 * visualisation shows day membership and nothing else — no hours, no class
 * blocks, no attendance, no calendar interaction. Each block carries its
 * institution in text, the two stacked rows restate the same facts as prose,
 * and the desktop strip is `aria-hidden` because it repeats what those rows
 * already say. Colour marks the track but the text carries the meaning.
 *
 * Renders only when the two current programmes split cleanly into one weekday
 * and one weekend schedule — with any other data shape there is no split to
 * draw, and guessing one would fabricate a timetable.
 */

const WEEK: ReadonlyArray<{
  key: keyof Dictionary["education"]["week"]["days"];
  kind: "weekday" | "weekend";
}> = [
  { key: "mon", kind: "weekday" },
  { key: "tue", kind: "weekday" },
  { key: "wed", kind: "weekday" },
  { key: "thu", kind: "weekday" },
  { key: "fri", kind: "weekday" },
  { key: "sat", kind: "weekend" },
  { key: "sun", kind: "weekend" },
];

export function AcademicWeek({
  t,
  programmes,
  headingId,
}: {
  t: Dictionary;
  programmes: ProgrammeView[];
  headingId: string;
}) {
  const weekday = programmes.find((p) => p.scheduleKind === "weekday");
  const weekend = programmes.find((p) => p.scheduleKind === "weekend");
  if (!weekday || !weekend) return null;

  const rows = [
    { label: t.education.week.weekdays, programme: weekday },
    { label: t.education.week.weekend, programme: weekend },
  ];

  return (
    <section aria-labelledby={headingId}>
      <div className="container-content section-y flex flex-col gap-8">
        <Reveal className="flex max-w-[52ch] flex-col gap-3">
          <p className="flex items-center gap-2.5 text-eyebrow font-semibold uppercase text-accent-subtle-foreground">
            <span aria-hidden="true" className="h-px w-8 bg-accent" />
            {t.education.schedule}
          </p>
          <h2 id={headingId} className="text-h2">
            {t.education.week.heading}
          </h2>
          <p className="text-body-lg text-foreground-muted">
            {t.education.week.description}
          </p>
        </Reveal>

        {/* ── The seven-day strip — decorative restatement, desktop only ── */}
        <Reveal delay={90}>
          <div aria-hidden="true" className="hidden gap-2 sm:grid sm:grid-cols-7">
            {WEEK.map((day) => {
              const programme = day.kind === "weekday" ? weekday : weekend;
              const mark = educationTrackMark(programme.track);

              return (
                <div
                  key={day.key}
                  className="experience-chip flex flex-col items-center gap-1 rounded-(--radius-md) border px-2 py-3 text-center"
                  style={{ "--mark-color": mark } as object}
                >
                  <span className="text-[0.75rem] font-semibold uppercase tracking-[0.08em]">
                    {t.education.week.days[day.key]}
                  </span>
                  <span className="text-[0.6875rem] font-medium opacity-80">
                    {shortName(programme)}
                  </span>
                </div>
              );
            })}
          </div>
        </Reveal>

        {/* ── The semantic version: two rows, all facts in text ─────────── */}
        <Reveal className="grid gap-3 sm:grid-cols-2">
          {rows.map((row) => {
            const mark = educationTrackMark(row.programme.track);

            return (
              <div key={row.label} className="relative flex h-full flex-col gap-1 overflow-hidden rounded-(--radius-lg) border border-border bg-surface p-4 sm:p-5">
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 start-0 w-0.5"
                    style={{ background: mark }}
                  />
                  <p className="text-eyebrow font-semibold uppercase text-foreground-subtle">
                    {row.label}
                  </p>
                  {row.programme.scheduleLabel ? (
                    <p className="text-body font-semibold text-foreground">
                      {row.programme.scheduleLabel}
                    </p>
                  ) : null}
                  <p className="text-small text-foreground-muted">
                    {[row.programme.fieldOfStudy, row.programme.institution]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}

/**
 * The block-sized institution label. The full name is in the semantic rows
 * directly below; a seven-column cell at 640px has room for an acronym-length
 * string, and the parenthesised acronym the CMS already stores is the honest
 * short form. Falls back to the first word rather than clipping mid-word.
 */
function shortName(programme: ProgrammeView): string {
  const acronym = programme.institution.match(/\(([^)]+)\)/)?.[1];
  return acronym ?? programme.institution.split(/\s+/)[0] ?? "";
}
