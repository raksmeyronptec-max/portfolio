"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge, Card, CardBody } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { EntityEditor, type EntityValues, type FieldSpec, type TranslationFieldSpec } from "./entity-editor";
import { ReviewBadge, StatusBadge, TranslationBadge } from "./status-badge";
import { restoreCvEntry, setCvStatus, softDeleteCvEntry } from "@/lib/actions/cv";
import { cvErrorLabels } from "@/lib/validation/cv";
import type { ActionResult } from "@/lib/actions/result";
import { cn } from "@/lib/utils/cn";

export type CvItem = {
  id: string;
  slug: string;
  status: "draft" | "in_review" | "published" | "archived";
  deletedAt: string | null;
  /** Headline shown in the list. */
  primaryLabel: string;
  /** Sub-line shown under the headline. */
  secondaryLabel: string | null;
  /** Small meta line, e.g. a period label. */
  metaLabel: string | null;
  needsReview: boolean;
  reviewNote: string | null;
  translationStatus: "complete" | "partial" | "missing";
  featured?: boolean;
  /** Extra badges, e.g. "consent recorded". */
  badges?: Array<{ label: string; tone: "success" | "warning" | "neutral" }>;
  /** Editor values for this record. */
  values: EntityValues;
};

/**
 * List + editor for education, experience and references.
 *
 * All three share the same operations (create, edit, publish, archive, soft delete,
 * restore) and the same list layout, so they share one component. The differences —
 * which fields exist and which save action runs — are passed in.
 */
export function CvManager({
  table,
  singular,
  items,
  emptyTitle,
  emptyDescription,
  fields,
  translationFields,
  blankValues,
  onSave,
  canEdit,
  canPublish,
  canDelete,
  mediaHrefBase,
}: {
  table: "education" | "experiences" | "testimonials";
  singular: string;
  items: CvItem[];
  emptyTitle: string;
  emptyDescription?: string;
  fields: FieldSpec[];
  translationFields: TranslationFieldSpec[];
  blankValues: EntityValues;
  onSave: (values: EntityValues, id?: string) => Promise<ActionResult<unknown>>;
  canEdit: boolean;
  canPublish: boolean;
  canDelete: boolean;
  /**
   * When set, each row gains a "Manage photos" action linking to
   * `${mediaHrefBase}/${item.id}/photos`.
   *
   * A string rather than a `(item) => string` builder, which is what this
   * originally was. `CvManager` is a Client Component and the callers are Server
   * Components, so a function prop crosses the serialization boundary and Next
   * rejects it at *render* time with "Functions cannot be passed directly to
   * Client Components" — a 500 on /admin/experience that types, lint and the
   * build all pass cleanly.
   *
   * Optional because only experience entries carry photographs; education and
   * references get no control rather than a dead one.
   */
  mediaHrefBase?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [editing, setEditing] = useState<CvItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CvItem | null>(null);

  const active = useMemo(
    () => items.filter((item) => !item.deletedAt),
    [items],
  );
  const deleted = useMemo(() => items.filter((item) => item.deletedAt), [items]);

  function act(label: string, run: () => Promise<ActionResult<unknown>>) {
    startTransition(async () => {
      const result = await run();

      if (result.ok) {
        toast.show({ tone: "success", title: label });
        router.refresh();
        return;
      }

      toast.show({
        tone: result.code === "publish_blocked" ? "warning" : "error",
        title: result.code === "publish_blocked" ? "Cannot publish yet" : "Action failed",
        description:
          result.detail ??
          (result.fields
            ? Object.values(result.fields)
                .map((code) => cvErrorLabels[code] ?? code)
                .join(" ")
            : result.code === "forbidden"
              ? "Your role does not permit this."
              : "Please try again."),
        duration: result.code === "publish_blocked" ? 0 : undefined,
      });
    });
  }

  return (
    <>
      {canEdit ? (
        <div>
          <Button iconStart="plus" onClick={() => setCreating(true)}>
            Add {singular}
          </Button>
        </div>
      ) : null}

      {active.length === 0 ? (
        <EmptyState icon="fileText" title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className="flex flex-col gap-3">
          {active.map((item) => (
            <li key={item.id}>
              <Card>
                <CardBody className="flex flex-wrap items-start gap-4 p-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.status} />
                      <TranslationBadge status={item.translationStatus} />
                      {item.featured ? (
                        <Badge tone="accent" icon="star">
                          Featured
                        </Badge>
                      ) : null}
                      {item.needsReview ? <ReviewBadge note={item.reviewNote} /> : null}
                      {item.badges?.map((badge) => (
                        <Badge key={badge.label} tone={badge.tone}>
                          {badge.label}
                        </Badge>
                      ))}
                    </div>

                    <p className="text-small font-semibold">{item.primaryLabel}</p>

                    {item.secondaryLabel ? (
                      <p className="text-[0.8125rem] text-foreground-muted">
                        {item.secondaryLabel}
                      </p>
                    ) : null}

                    <p className="flex flex-wrap items-center gap-x-3 text-[0.75rem] text-foreground-subtle">
                      <code>/{item.slug}</code>
                      {item.metaLabel ? <span>{item.metaLabel}</span> : null}
                    </p>

                    {item.needsReview && item.reviewNote ? (
                      <p className="max-w-[70ch] text-[0.75rem] leading-snug text-warning-foreground">
                        {item.reviewNote}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    {mediaHrefBase ? (
                      <Link
                        href={`${mediaHrefBase}/${item.id}/photos`}
                        aria-label={`Manage photos for ${item.primaryLabel}`}
                        className="inline-flex size-9 items-center justify-center rounded-(--radius-md) text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                      >
                        <Icon name="image" size={16} />
                      </Link>
                    ) : null}

                    <IconButton
                      icon="edit"
                      label={`Edit ${item.primaryLabel}`}
                      size="sm"
                      variant="ghost"
                      disabled={!canEdit}
                      onClick={() => setEditing(item)}
                    />

                    {canPublish ? (
                      item.status === "published" ? (
                        <IconButton
                          icon="eyeOff"
                          label={`Unpublish ${item.primaryLabel}`}
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() =>
                            act("Unpublished", () => setCvStatus(table, item.id, "draft"))
                          }
                        />
                      ) : (
                        <IconButton
                          icon="checkCircle"
                          label={`Publish ${item.primaryLabel}`}
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() =>
                            act("Published", () =>
                              setCvStatus(table, item.id, "published"),
                            )
                          }
                        />
                      )
                    ) : null}

                    {canPublish && item.status !== "archived" ? (
                      <IconButton
                        icon="archive"
                        label={`Archive ${item.primaryLabel}`}
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() =>
                          act("Archived", () => setCvStatus(table, item.id, "archived"))
                        }
                      />
                    ) : null}

                    {canDelete ? (
                      <IconButton
                        icon="trash"
                        label={`Delete ${item.primaryLabel}`}
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => setConfirmDelete(item)}
                      />
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* ── Deleted ─────────────────────────────────────────────────────────── */}
      {deleted.length > 0 ? (
        <details className="rounded-(--radius-lg) border border-border bg-surface p-4">
          <summary className="cursor-pointer text-small font-medium text-foreground-muted">
            {deleted.length} deleted {deleted.length === 1 ? "entry" : "entries"}
          </summary>

          <ul className="mt-3 flex flex-col gap-2">
            {deleted.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3",
                  "rounded-(--radius-md) border border-border p-3",
                )}
              >
                <span className="text-small">{item.primaryLabel}</span>
                <IconButton
                  icon="restore"
                  label={`Restore ${item.primaryLabel}`}
                  size="sm"
                  variant="outline"
                  disabled={!canDelete || isPending}
                  onClick={() =>
                    act("Restored as draft", () => restoreCvEntry(table, item.id))
                  }
                />
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* ── Editors ─────────────────────────────────────────────────────────── */}
      <EntityEditor
        open={creating}
        onClose={() => setCreating(false)}
        title={`Add ${singular}`}
        fields={fields}
        translationFields={translationFields}
        values={blankValues}
        errorLabels={cvErrorLabels}
        onSave={(values) => onSave(values)}
        saveLabel={`Create ${singular}`}
      />

      <EntityEditor
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.primaryLabel}` : ""}
        description={editing ? `/${editing.slug}` : undefined}
        fields={fields}
        translationFields={translationFields}
        values={editing?.values ?? blankValues}
        errorLabels={cvErrorLabels}
        onSave={(values) => onSave(values, editing?.id)}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          const target = confirmDelete;
          setConfirmDelete(null);
          act("Moved to deleted", () => softDeleteCvEntry(table, target.id));
        }}
        title={`Delete this ${singular}?`}
        description="A soft delete — the entry is hidden from the public site and can be restored below. Nothing is permanently removed."
        confirmLabel={`Delete ${singular}`}
        cancelLabel="Cancel"
        closeLabel="Close"
      />
    </>
  );
}
