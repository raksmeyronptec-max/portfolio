import { Icon } from "@/components/ui/icon";
import { SmartLink } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion/reveal";
import type { Dictionary } from "@/i18n/messages/en";
import type {
  ConvergenceApplication,
  ProgrammeView,
} from "@/lib/content/education-view";
import { cn } from "@/lib/utils/cn";
import { educationTrackMark, CONNECTION_MARK } from "./marks";

/**
 * The knowledge-convergence map: what each degree develops, the point where
 * they meet, and the real work that applies the combination.
 *
 * ── Semantic HTML is the diagram ───────────────────────────────────────────
 * This is headed lists and links in document order — two topic groups, a
 * convergence node, then the applications — with the connecting strokes drawn
 * as `aria-hidden` decoration between them. A screen reader hears the same
 * argument the eye sees, in the same order, and the section works with CSS
 * alone: no canvas, no WebGL, no animation it would have to switch off.
 *
 * ── One section, not three ─────────────────────────────────────────────────
 * The brief sketches a convergence map, a focus-area section and an
 * education-to-evidence table. All three answer "what does the study amount
 * to?", and three sections saying it would triple the same claim. This one
 * carries all of it: the topic lists are the focus areas, and every
 * application card is evidence — a link to a practicum, a publication or a
 * product that exists. An application with nothing behind it was filtered out
 * upstream and never renders.
 */
export function KnowledgeConvergence({
  t,
  programmes,
  applications,
  headingId,
}: {
  t: Dictionary;
  programmes: ProgrammeView[];
  applications: ConvergenceApplication[];
  headingId: string;
}) {
  const teacher = programmes.find((p) => p.track === "teacher");
  const mathematics = programmes.find((p) => p.track === "mathematics");
  if (!teacher || !mathematics || applications.length === 0) return null;

  const columns = [
    {
      programme: teacher,
      label: t.education.spotlight.teacherLabel,
    },
    {
      programme: mathematics,
      label: t.education.spotlight.mathematicsLabel,
    },
  ];

  return (
    <section aria-labelledby={headingId} className="bg-surface-muted">
      <div className="container-content section-y flex flex-col gap-10">
        <Reveal className="flex max-w-[54ch] flex-col gap-3">
          <p className="flex items-center gap-2.5 text-eyebrow font-semibold uppercase text-accent-subtle-foreground">
            <span aria-hidden="true" className="h-px w-8 bg-accent" />
            {t.education.convergence.eyebrow}
          </p>
          <h2 id={headingId} className="text-h2">
            {t.education.convergence.heading}
          </h2>
          <p className="text-body-lg text-foreground-muted">
            {t.education.convergence.description}
          </p>
        </Reveal>

        {/* ── The two topic groups ──────────────────────────────────────── */}
        <div className="relative grid gap-6 sm:grid-cols-2 sm:gap-10">
          {columns.map(({ programme, label }) => {
            const mark = educationTrackMark(programme.track);

            return (
              <Reveal key={programme.id}>
                <div className="flex h-full flex-col gap-3 border-s-2 ps-4"
                  style={{ borderInlineStartColor: mark } as object}
                >
                  <h3
                    className="experience-mark text-eyebrow font-semibold uppercase"
                    style={{ "--mark-color": mark } as object}
                  >
                    {label}
                  </h3>
                  <ul className="flex flex-wrap gap-x-2 gap-y-1.5">
                    {programme.focus.map((topic) => (
                      <li
                        key={topic}
                        className="text-small text-foreground-muted after:ms-2 after:text-foreground-subtle after:content-['·'] last:after:content-none"
                      >
                        {topic}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* ── The convergence node ──────────────────────────────────────── */}
        <Reveal className="flex flex-col items-center gap-0">
          <span
            aria-hidden="true"
            className="block h-8 w-px"
            style={{
              backgroundImage: `linear-gradient(to bottom, transparent, ${CONNECTION_MARK})`,
            }}
          />
          <p
            className="experience-chip inline-flex items-center gap-2 rounded-(--radius-full) border px-5 py-2.5 text-body font-semibold"
            style={{ "--mark-color": CONNECTION_MARK } as object}
          >
            <Icon name="lightbulb" size={17} aria-hidden="true" />
            {t.education.convergence.convergesInto}
          </p>
          <span
            aria-hidden="true"
            className="block h-8 w-px"
            style={{
              backgroundImage: `linear-gradient(to bottom, ${CONNECTION_MARK}, transparent)`,
            }}
          />
        </Reveal>

        {/* ── The applications: each one linked evidence ────────────────── */}
        <div className="flex flex-col gap-3">
          <h3 className="text-eyebrow font-semibold uppercase text-foreground-subtle">
            {t.education.convergence.appliedThrough}
          </h3>

          <Reveal>
            <ul className="grid gap-3 sm:grid-cols-2">
              {applications.map((application) => (
                <li key={application.id} className="flex h-full flex-col gap-2 rounded-(--radius-lg) border border-border bg-surface p-4 sm:p-5">
                  <p className="text-body font-semibold text-foreground">
                    {application.label}
                  </p>
                  <p className="max-w-[52ch] text-small text-foreground-muted">
                    {application.detail}
                  </p>

                  <ul className="mt-auto flex flex-col gap-1 pt-1.5">
                    {application.links.map((link) => (
                      <li key={link.id}>
                        <SmartLink
                          href={link.href}
                          className={cn(
                            "group/link inline-flex min-h-8 items-center gap-1.5 text-small font-medium",
                            "text-primary underline decoration-transparent underline-offset-4",
                            "transition-colors hover:decoration-current",
                          )}
                        >
                          <Icon
                            name="arrowRight"
                            size={14}
                            className="travel shrink-0"
                          />
                          {link.label}
                        </SmartLink>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
