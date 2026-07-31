"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Badge, Card, CardBody } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  activateResumeVersion,
  archiveResumeVersion,
  createResumeVersion,
  unarchiveResumeVersion,
} from "@/lib/actions/resume";
import { seoErrorLabels } from "@/lib/validation/settings";
import { locales, localeMeta, type Locale } from "@/i18n/config";
import type { AdminResumeVersion } from "@/lib/data/admin-cv";
import type { ActionResult } from "@/lib/actions/result";

export function ResumeManager({
  versions,
  fileOptions,
  canManage,
}: {
  versions: AdminResumeVersion[];
  fileOptions: Array<{ id: string; label: string }>;
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);

  const labelId = useId();
  const localeId = useId();
  const fileId = useId();
  const notesId = useId();

  const [label, setLabel] = useState("");
  const [locale, setLocale] = useState<Locale>("en");
  const [mediaId, setMediaId] = useState("");
  const [notes, setNotes] = useState("");
  const [activate, setActivate] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function act(message: string, run: () => Promise<ActionResult<unknown>>) {
    startTransition(async () => {
      const result = await run();

      if (result.ok) {
        toast.show({ tone: "success", title: message });
        router.refresh();
        return;
      }

      toast.show({
        tone: result.code === "conflict" ? "warning" : "error",
        title: result.code === "conflict" ? "Not allowed yet" : "Action failed",
        // A conflict here explains which version is active and what to do first.
        description: result.detail ?? "Please try again.",
        duration: result.code === "conflict" ? 0 : undefined,
      });
    });
  }

  function create() {
    setErrors({});

    startTransition(async () => {
      const result = await createResumeVersion({
        version_label: label,
        locale,
        media_id: mediaId,
        notes,
        activate,
      });

      if (result.ok) {
        toast.show({
          tone: "success",
          title: activate ? "Version added and activated" : "Version added",
        });
        setCreating(false);
        setLabel("");
        setMediaId("");
        setNotes("");
        router.refresh();
        return;
      }

      if (result.fields) setErrors(result.fields);

      toast.show({
        tone: "error",
        title: "Could not add the version",
        description:
          result.detail ??
          Object.values(result.fields ?? {})
            .map((code) => seoErrorLabels[code] ?? code)
            .join(" ") ??
          "Please try again.",
      });
    });
  }

  const activeByLocale = new Map(
    versions.filter((version) => version.isActive).map((v) => [v.locale, v]),
  );

  return (
    <>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            iconStart="plus"
            onClick={() => setCreating(true)}
            disabled={fileOptions.length === 0}
          >
            Add a version
          </Button>

          {/* Say plainly which locales currently have a live resume. */}
          <p className="text-[0.8125rem] text-foreground-muted">
            {locales
              .map((code) => {
                const active = activeByLocale.get(code);
                return `${localeMeta[code].shortLabel}: ${active ? active.versionLabel : "none active"}`;
              })
              .join(" · ")}
          </p>
        </div>
      ) : null}

      {versions.length === 0 ? (
        <EmptyState
          icon="fileText"
          title="No resume versions yet"
          description="Upload a PDF in the Media library, then add it as a version here."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {versions.map((version) => (
            <li key={version.id}>
              <Card>
                <CardBody className="flex flex-wrap items-start gap-4 p-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {version.isActive ? (
                        <Badge tone="success" icon="checkCircle">
                          Active — publicly downloadable
                        </Badge>
                      ) : version.isArchived ? (
                        <Badge tone="neutral" icon="archive">
                          Archived — not publicly readable
                        </Badge>
                      ) : (
                        <Badge tone="warning" icon="eyeOff">
                          Inactive
                        </Badge>
                      )}
                      <Badge tone="primary">{version.locale.toUpperCase()}</Badge>
                    </div>

                    <p className="text-small font-semibold">{version.versionLabel}</p>

                    <p className="text-[0.8125rem] text-foreground-muted">
                      {version.filename ?? "file missing"}
                      {version.fileSizeBytes
                        ? ` · ${Math.round(version.fileSizeBytes / 1024)} KB`
                        : ""}
                      {" · "}
                      {version.downloadCount} download
                      {version.downloadCount === 1 ? "" : "s"}
                    </p>

                    <p className="text-[0.75rem] text-foreground-subtle">
                      Effective from{" "}
                      <time dateTime={version.effectiveFrom}>
                        {new Date(version.effectiveFrom).toLocaleDateString("en-GB")}
                      </time>
                    </p>

                    {version.notes ? (
                      <p className="max-w-[70ch] text-[0.8125rem] text-foreground-muted">
                        {version.notes}
                      </p>
                    ) : null}
                  </div>

                  {canManage ? (
                    <div className="flex shrink-0 gap-1">
                      {!version.isActive ? (
                        <IconButton
                          icon="checkCircle"
                          label={`Activate ${version.versionLabel}`}
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() =>
                            act("Activated", () => activateResumeVersion(version.id))
                          }
                        />
                      ) : null}

                      {version.isArchived ? (
                        <IconButton
                          icon="restore"
                          label={`Unarchive ${version.versionLabel}`}
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() =>
                            act("Unarchived", () => unarchiveResumeVersion(version.id))
                          }
                        />
                      ) : (
                        <IconButton
                          icon="archive"
                          label={`Archive ${version.versionLabel}`}
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() =>
                            act("Archived", () => archiveResumeVersion(version.id))
                          }
                        />
                      )}
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* ── New version ─────────────────────────────────────────────────────── */}
      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Add a resume version"
        description="Attach an already-uploaded PDF from the resumes bucket."
        closeLabel="Close"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              onClick={create}
              loading={isPending}
              iconStart="check"
              disabled={!label.trim() || !mediaId}
            >
              Add version
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field
            id={labelId}
            label="Version label"
            description="Something you will recognise later, e.g. “2026 Q1 — teaching focus”."
            required
            requiredLabel="required"
            error={errors.version_label ? seoErrorLabels[errors.version_label] : undefined}
          >
            {({ describedBy, invalid }) => (
              <TextInput
                id={labelId}
                value={label}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                onChange={(event) => setLabel(event.target.value)}
              />
            )}
          </Field>

          <Field id={localeId} label="Language">
            {({ describedBy }) => (
              <Select
                id={localeId}
                value={locale}
                aria-describedby={describedBy}
                onChange={(event) => setLocale(event.target.value as Locale)}
              >
                {locales.map((code) => (
                  <option key={code} value={code}>
                    {localeMeta[code].englishName}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            id={fileId}
            label="File"
            required
            requiredLabel="required"
            description="Only PDFs uploaded with the kind “Resume PDF” appear here."
            error={errors.media_id ? seoErrorLabels[errors.media_id] : undefined}
          >
            {({ describedBy, invalid }) => (
              <Select
                id={fileId}
                value={mediaId}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                onChange={(event) => setMediaId(event.target.value)}
              >
                <option value="">Select a file</option>
                {fileOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field id={notesId} label="Notes" optionalLabel="optional" showOptional>
            {({ describedBy }) => (
              <TextArea
                id={notesId}
                rows={3}
                value={notes}
                aria-describedby={describedBy}
                onChange={(event) => setNotes(event.target.value)}
              />
            )}
          </Field>

          <Checkbox
            id="activate-now"
            label="Make this the active version for that language"
            description="The previously active version stops being publicly readable."
            checked={activate}
            onChange={(event) => setActivate(event.target.checked)}
          />
        </div>
      </Dialog>
    </>
  );
}
