"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/primitives";
import { EmptyState, Notice } from "@/components/ui/states";
import { Icon, type IconName } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { addJourneyRelation, removeJourneyRelation } from "@/lib/actions/journey";
import type { AdminJourneyRelation, RelationOption } from "@/lib/data/admin-journey";
import {
  journeyErrorLabels,
  journeyRelationTypes,
  type JourneyRelationType,
} from "@/lib/validation/journey";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Links from a story to the records it is evidence for.
 *
 * ── Why a link rather than a copy ──────────────────────────────────────────
 * The award-ceremony photograph and the certificate scan are different things:
 * one is event evidence, the other is the credential document. Section 18 of the
 * brief is explicit that the ceremony photograph must not be used as the
 * credential. A relation keeps them associated without either standing in for the
 * other, and the Certificate page renders "the story behind this" rather than
 * absorbing the gallery.
 *
 * ── Draft targets are selectable ───────────────────────────────────────────
 * A story can be linked to an unpublished certificate. That is deliberate: the
 * owner will often write the story first. RLS refuses to return the relation
 * publicly until *both* ends are published, so an early link is invisible rather
 * than a leak — and the picker labels the target's status so the choice is
 * informed.
 */

const TYPE_LABELS: Record<JourneyRelationType, string> = {
  experience: "Experience",
  education: "Education",
  certificate: "Certificate",
  project: "Project",
};

const TYPE_ICONS: Record<JourneyRelationType, IconName> = {
  experience: "briefcase",
  education: "graduation",
  certificate: "award",
  project: "layers",
};

export function JourneyRelationsManager({
  journeyEntryId,
  relations,
  targets,
}: {
  journeyEntryId: string;
  relations: AdminJourneyRelation[];
  targets: Record<JourneyRelationType, RelationOption[]>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<JourneyRelationType>("experience");
  const [targetId, setTargetId] = useState("");
  const typeId = useId();
  const targetSelectId = useId();

  // Already-linked targets are removed from the picker rather than shown
  // disabled: the unique index would refuse the insert anyway, and a list of
  // unselectable options is just noise.
  const linkedIds = new Set(
    relations.filter((relation) => relation.type === type).map((r) => r.targetId),
  );
  const available = targets[type].filter((option) => !linkedIds.has(option.id));

  function run(label: string, action: () => Promise<ActionResult<unknown>>) {
    startTransition(async () => {
      const result = await action();

      if (result.ok) {
        toast.show({ tone: "success", title: label });
        setTargetId("");
        router.refresh();
        return;
      }

      toast.show({
        tone: "error",
        title: result.code === "forbidden" ? "Not permitted" : "Could not save",
        description:
          result.detail ??
          (result.fields
            ? Object.values(result.fields)
                .map((code) => journeyErrorLabels[code] ?? code)
                .join(" ")
            : "Please try again."),
        duration: 0,
      });
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {relations.length === 0 ? (
        <EmptyState
          icon="layers"
          title="Not linked to anything yet"
          description="Link this story to the Experience, Education, Certificate or Project record it is evidence for. The link appears on both pages once each side is published."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {relations.map((relation) => (
            <li
              key={relation.id}
              className="flex min-h-11 items-center gap-3 rounded-(--radius-md) border border-border bg-surface px-3 py-2"
            >
              <Icon
                name={TYPE_ICONS[relation.type]}
                size={16}
                className="shrink-0 text-foreground-subtle"
              />

              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[0.6875rem] uppercase tracking-[0.06em] text-foreground-subtle">
                  {TYPE_LABELS[relation.type]}
                </span>
                <span className="truncate text-small font-medium">{relation.label}</span>
              </span>

              <IconButton
                icon="trash"
                label={`Remove the link to ${relation.label}`}
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() =>
                  run("Link removed", () => removeJourneyRelation(relation.id))
                }
              />
            </li>
          ))}
        </ul>
      )}

      {/* ── Add a link ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-44">
          <Field id={typeId} label="Record type">
            {({ describedBy }) => (
              <Select
                id={typeId}
                value={type}
                aria-describedby={describedBy}
                onChange={(event) => {
                  setType(event.target.value as JourneyRelationType);
                  setTargetId("");
                }}
              >
                {journeyRelationTypes.map((value) => (
                  <option key={value} value={value}>
                    {TYPE_LABELS[value]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="flex-1">
          <Field id={targetSelectId} label="Record">
            {({ describedBy }) => (
              <Select
                id={targetSelectId}
                value={targetId}
                aria-describedby={describedBy}
                onChange={(event) => setTargetId(event.target.value)}
              >
                <option value="">Choose a record…</option>
                {available.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                    {option.status !== "published" ? ` (${option.status})` : ""}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Button
          disabled={!targetId || isPending}
          onClick={() =>
            run("Link added", () =>
              addJourneyRelation({
                journeyEntryId,
                relatedType: type,
                relatedId: targetId,
              }),
            )
          }
        >
          Add link
        </Button>
      </div>

      {available.length === 0 && targets[type].length > 0 ? (
        <p className="text-[0.8125rem] text-foreground-subtle">
          Every {TYPE_LABELS[type].toLowerCase()} record is already linked to this story.
        </p>
      ) : null}

      {relations.some((relation) => relation.type === "certificate") ? (
        <Notice tone="info" icon="award" title="Credential and event evidence stay separate">
          <p>
            The certificate page will show its redacted credential document and a link to
            this story. The award-ceremony photographs belong here, not on the
            certificate as the credential itself.
          </p>
        </Notice>
      ) : null}

      {relations.length > 0 ? (
        <p className="flex flex-wrap items-center gap-2">
          {journeyRelationTypes.map((value) => {
            const count = relations.filter((r) => r.type === value).length;
            if (count === 0) return null;
            return (
              <Badge key={value} tone="neutral" icon={TYPE_ICONS[value]}>
                {count} {TYPE_LABELS[value].toLowerCase()}
                {count === 1 ? "" : "s"}
              </Badge>
            );
          })}
        </p>
      ) : null}
    </div>
  );
}
