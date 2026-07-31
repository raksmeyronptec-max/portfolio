import Link from "next/link";
import type { Metadata } from "next";

import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { Icon, toIconName } from "@/components/ui/icon";
import { EmptyState, Notice } from "@/components/ui/states";
import { requireAdminSession } from "@/lib/auth/guards";
import { listAdminSkills } from "@/lib/data/admin-cv";

export const metadata: Metadata = { title: "Capabilities" };
export const dynamic = "force-dynamic";

/**
 * Capability groups.
 *
 * Read-oriented on purpose. The notable thing about this model is what it does not
 * have: a proficiency percentage. v1 showed bars like "Patience 95%", which asserted
 * precision that cannot exist. Here a capability is demonstrated by the projects
 * linked to it, so this page's job is to show which capabilities have evidence and
 * which do not.
 */
export default async function AdminSkillsPage() {
  await requireAdminSession();
  const groups = await listAdminSkills();

  const totalSkills = groups.reduce((sum, group) => sum + group.skills.length, 0);
  const withoutEvidence = groups.flatMap((group) =>
    group.skills.filter((skill) => skill.projectSlugs.length === 0),
  );

  return (
    <>
      <AdminPageHeader
        title="Capabilities"
        description="Grouped capabilities shown on the homepage and the About page. Each one is evidenced by the projects it links to, not by a self-assessed score."
      />

      <AdminPageBody className="flex flex-col gap-6">
        <Notice tone="info" icon="target" title="Why there are no percentages">
          <p>
            The old site rendered percentage bars for things like patience and
            communication. A number implies a measurement that does not exist, so this
            model replaces it with evidence: link a capability to the projects that
            demonstrate it, and the public page renders those links.
          </p>
        </Notice>

        {withoutEvidence.length > 0 ? (
          <Notice tone="warning" icon="alertTriangle">
            <p>
              {withoutEvidence.length} of {totalSkills} capabilities have no linked
              project. They still render, but without evidence beneath them. Link them
              from the relevant project&apos;s editor, or remove them.
            </p>
          </Notice>
        ) : null}

        {groups.length === 0 ? (
          <EmptyState
            icon="target"
            title="No capability groups yet"
            description="The seed creates four groups — Education, Product and Engineering, Academic Systems, and Product Quality. If this is empty, the seed has not been run."
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {groups.map((group) => (
              <Card key={group.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-(--radius-md) bg-primary-subtle text-primary-subtle-foreground">
                        <Icon name={toIconName(group.icon, "target")} size={17} />
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <h2 className="text-h4 font-semibold">{group.nameEn}</h2>
                        {group.nameKm ? (
                          <p lang="km" className="text-[0.8125rem] text-foreground-muted">
                            {group.nameKm}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {group.isPublished ? (
                      <Badge tone="success" icon="check">
                        Published
                      </Badge>
                    ) : (
                      <Badge tone="neutral" icon="eyeOff">
                        Hidden
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardBody>
                  {group.skills.length === 0 ? (
                    <p className="text-small text-foreground-muted">
                      No capabilities in this group yet.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2.5">
                      {group.skills.map((skill) => (
                        <li key={skill.id} className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-small font-medium">
                              {skill.nameEn}
                            </span>
                            {!skill.isPublished ? (
                              <Badge tone="neutral">Hidden</Badge>
                            ) : null}
                            {skill.projectSlugs.length === 0 ? (
                              <Badge tone="warning">No evidence</Badge>
                            ) : (
                              <Badge tone="secondary">
                                {skill.projectSlugs.length} project
                                {skill.projectSlugs.length === 1 ? "" : "s"}
                              </Badge>
                            )}
                          </div>

                          {skill.projectSlugs.length > 0 ? (
                            <p className="flex flex-wrap gap-x-2 pl-0.5 text-[0.75rem] text-foreground-muted">
                              {skill.projectSlugs.map((slug) => (
                                <code key={slug}>{slug}</code>
                              ))}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardBody className="flex flex-col gap-2">
            <h2 className="text-h4 font-semibold">Linking evidence</h2>
            <p className="text-small text-foreground-muted">
              Capability-to-project links are edited from the project side, where the
              context is clearer. Open a project in{" "}
              <Link href="/admin/projects" className="text-primary underline">
                Projects
              </Link>{" "}
              and attach its capabilities there.
            </p>
          </CardBody>
        </Card>
      </AdminPageBody>
    </>
  );
}
