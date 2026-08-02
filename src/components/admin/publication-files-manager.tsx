"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, Badge } from "@/components/ui/primitives";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  activatePublicationVersion,
  createPublicationVersion,
  deletePublicationVersion,
  updatePublicationVersion,
} from "@/lib/actions/publications";
import {
  attachPublicationMedia,
  detachPublicationMedia,
} from "@/lib/actions/publication-media";
import type {
  AdminPublicationFile,
  AdminPublicationMedia,
  AdminPublicationVersion,
  PublicationImageOption,
} from "@/lib/data/admin-publications";
import type { ActionResult } from "@/lib/actions/result";
import { publicationErrorLabels } from "@/lib/validation/publication";
import { formatBytes } from "@/lib/media/validate";
import { cn } from "@/lib/utils/cn";

/**
 * Cover, editions and sample pages.
 *
 * This is the half of the editor that deals in files rather than words, and it
 * is deliberately not part of `PublicationForm`: choosing which PDF a reader
 * downloads is a different kind of decision from correcting a subtitle, and
 * mixing them would mean every save touched both.
 *
 * ── Why the pickers list uploads rather than opening a file dialog ─────────
 * Files reach the library through `/admin/media`, which validates magic bytes,
 * strips metadata, routes to the right bucket and records the audit entry. A
 * second upload path here would have to repeat all of that or quietly skip it.
 * So this picks from what is already in the library, filtered to the kind each
 * slot requires — offering an asset the database trigger would reject just
 * moves the failure from pick time to save time.
 */
export function PublicationFilesManager({
  publicationId,
  versions,
  media,
  images,
  fileLibrary,
  canEdit,
  canPublish,
  canDelete,
}: {
  publicationId: string;
  versions: AdminPublicationVersion[];
  media: AdminPublicationMedia[];
  images: PublicationImageOption[];
  fileLibrary: {
    pdf: AdminPublicationFile[];
    original: AdminPublicationFile[];
    source: AdminPublicationFile[];
  };
  canEdit: boolean;
  canPublish: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [showNewEdition, setShowNewEdition] = useState(versions.length === 0);

  function run(label: string, action: () => Promise<ActionResult<unknown>>) {
    startTransition(async () => {
      const result = await action();

      if (result.ok) {
        toast.show({ tone: "success", title: label });
        router.refresh();
        return;
      }

      const fieldMessages = Object.values(result.fields ?? {})
        .map((code) => publicationErrorLabels[code] ?? code)
        .join(" ");

      toast.show({
        tone: result.code === "publish_blocked" ? "warning" : "error",
        title:
          result.code === "forbidden"
            ? "Not permitted"
            : result.code === "publish_blocked"
              ? "Not allowed yet"
              : "Could not save",
        // The database trigger's own message when there is one — it names the
        // rule that failed, e.g. "the archival original must be a private asset".
        description: result.detail ?? fieldMessages ?? "Please try again.",
        duration: 0,
      });
    });
  }

  const cover = media.find((item) => item.role === "cover");
  const samplePages = media.filter((item) => item.role === "sample_page");

  return (
    <div className="flex flex-col gap-6">
      {/* ── Cover ───────────────────────────────────────────────────────── */}
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-body font-semibold text-foreground">Cover</h2>
            {cover ? <Badge tone="success">Set</Badge> : <Badge tone="neutral">None</Badge>}
          </div>

          {cover?.asset ? (
            <div className="flex flex-wrap items-start gap-4">
              <CoverThumb
                src={images.find((i) => i.id === cover.asset?.id)?.thumbnailSrc ?? null}
                alt={cover.altTextEn ?? ""}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="text-small text-foreground-muted">
                  {images.find((i) => i.id === cover.asset?.id)?.filename ?? "Cover image"}
                </p>
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!canEdit || isPending}
                    onClick={() =>
                      run("Cover removed", () => detachPublicationMedia(cover.id))
                    }
                  >
                    Remove cover
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <ImagePicker
              images={images}
              disabled={!canEdit || isPending}
              emptyHint="Upload one in the media library with the kind “Publication cover”."
              actionLabel="Set as cover"
              onPick={(image) =>
                run("Cover set", () =>
                  attachPublicationMedia({
                    publicationId,
                    mediaAssetId: image.id,
                    role: "cover",
                    sortOrder: 0,
                    pageNumber: "",
                    captionEn: "",
                    captionKm: "",
                    // Alt text is required before an image goes public, so it is
                    // seeded from the asset's own and can be edited in the
                    // library. Without it the attachment would be rejected.
                    altTextEn: image.altTextEn ?? image.filename,
                    altTextKm: "",
                    visibility: "public",
                  }),
                )
              }
            />
          )}
        </CardBody>
      </Card>

      {/* ── Editions ────────────────────────────────────────────────────── */}
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-body font-semibold text-foreground">Editions</h2>
            {canEdit && !showNewEdition ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowNewEdition(true)}
              >
                <Icon name="plus" size={15} />
                New edition
              </Button>
            ) : null}
          </div>

          {versions.length === 0 && !showNewEdition ? (
            <p className="text-small text-foreground-muted">
              No editions yet. An edition carries the three files: the public-safe
              PDF, the private archival original, and the LaTeX source archive.
            </p>
          ) : null}

          {versions.map((version) => (
            <EditionRow
              key={version.id}
              publicationId={publicationId}
              version={version}
              fileLibrary={fileLibrary}
              canEdit={canEdit}
              canPublish={canPublish}
              canDelete={canDelete}
              isPending={isPending}
              run={run}
            />
          ))}

          {showNewEdition ? (
            <NewEditionForm
              publicationId={publicationId}
              fileLibrary={fileLibrary}
              isFirst={versions.length === 0}
              disabled={!canEdit || isPending}
              onCancel={() => setShowNewEdition(false)}
              onSubmit={(payload) =>
                run("Edition created", async () => {
                  const result = await createPublicationVersion(payload);
                  if (result.ok) setShowNewEdition(false);
                  return result;
                })
              }
            />
          ) : null}

          {fileLibrary.pdf.length === 0 ? (
            <Notice tone="info">
              No publication PDFs are in the library yet. Upload one in{" "}
              <Link href="/admin/media" className="underline">
                the media library
              </Link>{" "}
              with the kind “Publication PDF”, then create an edition here.
            </Notice>
          ) : null}
        </CardBody>
      </Card>

      {/* ── Sample pages ────────────────────────────────────────────────── */}
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-body font-semibold text-foreground">Sample pages</h2>
            <span className="text-small text-foreground-subtle">
              {samplePages.length} attached
            </span>
          </div>

          <p className="text-small text-foreground-muted">
            Rendered page images the reader can look through. These are what the
            “Sample pages” preview policy shows — the PDF itself is never served
            for that policy.
          </p>

          {samplePages.length > 0 ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {samplePages.map((page) => (
                <li key={page.id} className="flex flex-col gap-1.5">
                  <CoverThumb
                    src={
                      images.find((i) => i.id === page.asset?.id)?.thumbnailSrc ?? null
                    }
                    alt={page.altTextEn ?? ""}
                    className="w-full"
                  />
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[0.75rem] tabular-nums text-foreground-subtle">
                      Page {page.pageNumber}
                    </span>
                    <IconButton
                      icon="trash"
                      label={`Remove page ${page.pageNumber}`}
                      size="sm"
                      disabled={!canEdit || isPending}
                      onClick={() =>
                        run("Sample page removed", () => detachPublicationMedia(page.id))
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          <SamplePagePicker
            publicationId={publicationId}
            images={images}
            nextSortOrder={samplePages.length}
            disabled={!canEdit || isPending}
            run={run}
          />
        </CardBody>
      </Card>
    </div>
  );
}

// ── Edition row ─────────────────────────────────────────────────────────────

function EditionRow({
  publicationId,
  version,
  fileLibrary,
  canEdit,
  canPublish,
  canDelete,
  isPending,
  run,
}: {
  publicationId: string;
  version: AdminPublicationVersion;
  fileLibrary: {
    pdf: AdminPublicationFile[];
    original: AdminPublicationFile[];
    source: AdminPublicationFile[];
  };
  canEdit: boolean;
  canPublish: boolean;
  canDelete: boolean;
  isPending: boolean;
  run: (label: string, action: () => Promise<ActionResult<unknown>>) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);

  const [pdfId, setPdfId] = useState(version.pdf?.id ?? "");
  const [originalId, setOriginalId] = useState(version.original?.id ?? "");
  const [sourceId, setSourceId] = useState(version.source?.id ?? "");
  const [status, setStatus] = useState(version.status);

  const save = () =>
    run("Edition saved", () =>
      updatePublicationVersion(version.id, {
        publicationId,
        versionLabel: version.versionLabel,
        editionNumber: version.editionNumber?.toString() ?? "",
        publicationYear: version.publicationYear?.toString() ?? "",
        publicationDate: version.publicationDate ?? "",
        pageCount: version.pageCount?.toString() ?? "",
        pdfMediaId: pdfId || null,
        originalMediaId: originalId || null,
        sourceArchiveMediaId: sourceId || null,
        changelogEn: version.changelogEn ?? "",
        changelogKm: version.changelogKm ?? "",
        isActive: version.isActive,
        status,
      }),
    );

  return (
    <div className="flex flex-col gap-3 rounded-(--radius-md) border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{version.versionLabel}</span>
        {version.isActive ? <Badge tone="success">Active</Badge> : null}
        <Badge tone={version.status === "published" ? "info" : "neutral"}>
          {version.status}
        </Badge>
        {version.publicationYear ? (
          <span className="text-small tabular-nums text-foreground-subtle">
            {version.publicationYear}
          </span>
        ) : null}

        <span className="ml-auto flex items-center gap-1">
          {!version.isActive && canPublish ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isPending}
              onClick={() =>
                run("Edition activated", () =>
                  activatePublicationVersion({ publicationId, versionId: version.id }),
                )
              }
            >
              Make active
            </Button>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? "Close" : "Files"}
          </Button>

          {canDelete ? (
            <IconButton
              icon="trash"
              label={`Delete ${version.versionLabel}`}
              size="sm"
              disabled={isPending}
              onClick={() =>
                run("Edition deleted", () => deletePublicationVersion(version.id))
              }
            />
          ) : null}
        </span>
      </div>

      <dl className="grid gap-1.5 text-[0.8125rem] sm:grid-cols-3">
        <SlotSummary label="Public PDF" file={version.pdf} />
        <SlotSummary label="Archival original" file={version.original} />
        <SlotSummary label="LaTeX source" file={version.source} />
      </dl>

      {open ? (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <FileSlotSelect
            id={`${id}-pdf`}
            label="Public PDF"
            description="The redacted edition a reader downloads. Served through the download route, which checks the publication's policy first."
            value={pdfId}
            onChange={setPdfId}
            options={fileLibrary.pdf}
            emptyHint="Upload one with the kind “Publication PDF”."
            disabled={!canEdit || isPending}
          />
          <FileSlotSelect
            id={`${id}-original`}
            label="Archival original"
            description="The copy the next edition is cut from. Never served to a reader — owner-only, always."
            value={originalId}
            onChange={setOriginalId}
            options={fileLibrary.original}
            emptyHint="Upload one with the kind “Publication original”."
            disabled={!canEdit || isPending}
          />
          <FileSlotSelect
            id={`${id}-source`}
            label="LaTeX source archive"
            description="A ZIP of the .tex, .sty, figures and README. Private by default whatever the source policy says."
            value={sourceId}
            onChange={setSourceId}
            options={fileLibrary.source}
            emptyHint="Upload one with the kind “Publication LaTeX source”."
            disabled={!canEdit || isPending}
          />

          <Field
            id={`${id}-status`}
            label="Edition status"
            description="A published edition needs a PDF, and appears in the public version history."
          >
            {({ describedBy }) => (
              <Select
                id={`${id}-status`}
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                aria-describedby={describedBy}
                disabled={!canPublish || isPending}
              >
                <option value="draft">Draft</option>
                <option value="in_review">In review</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
            )}
          </Field>

          <div>
            <Button type="button" disabled={!canEdit || isPending} onClick={save}>
              <Icon name="check" size={16} />
              Save files
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NewEditionForm({
  publicationId,
  fileLibrary,
  isFirst,
  disabled,
  onCancel,
  onSubmit,
}: {
  publicationId: string;
  fileLibrary: {
    pdf: AdminPublicationFile[];
    original: AdminPublicationFile[];
    source: AdminPublicationFile[];
  };
  isFirst: boolean;
  disabled: boolean;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const id = useId();
  const [label, setLabel] = useState(isFirst ? "First edition" : "");
  const [editionNumber, setEditionNumber] = useState(isFirst ? "1" : "");
  const [year, setYear] = useState("");
  const [pageCount, setPageCount] = useState("");
  const [pdfId, setPdfId] = useState("");
  const [originalId, setOriginalId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [changelog, setChangelog] = useState("");

  return (
    <div className="flex flex-col gap-3 rounded-(--radius-md) border border-primary/40 bg-primary-subtle/30 p-3">
      <h3 className="text-small font-semibold text-foreground">New edition</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${id}-label`} label="Edition label" required>
          {() => (
            <TextInput
              id={`${id}-label`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="First edition"
            />
          )}
        </Field>
        <Field id={`${id}-number`} label="Edition number">
          {() => (
            <TextInput
              id={`${id}-number`}
              type="number"
              min={1}
              value={editionNumber}
              onChange={(e) => setEditionNumber(e.target.value)}
            />
          )}
        </Field>
        <Field
          id={`${id}-year`}
          label="Publication year"
          description="Leave blank rather than guessing."
        >
          {({ describedBy }) => (
            <TextInput
              id={`${id}-year`}
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        <Field id={`${id}-pages`} label="Page count">
          {() => (
            <TextInput
              id={`${id}-pages`}
              type="number"
              min={1}
              value={pageCount}
              onChange={(e) => setPageCount(e.target.value)}
            />
          )}
        </Field>
      </div>

      <FileSlotSelect
        id={`${id}-pdf`}
        label="Public PDF"
        description="The redacted edition a reader downloads."
        value={pdfId}
        onChange={setPdfId}
        options={fileLibrary.pdf}
        emptyHint="Upload one with the kind “Publication PDF”."
        disabled={disabled}
      />
      <FileSlotSelect
        id={`${id}-original`}
        label="Archival original"
        description="Never served to a reader."
        value={originalId}
        onChange={setOriginalId}
        options={fileLibrary.original}
        emptyHint="Upload one with the kind “Publication original”."
        disabled={disabled}
      />
      <FileSlotSelect
        id={`${id}-source`}
        label="LaTeX source archive"
        description="Private by default."
        value={sourceId}
        onChange={setSourceId}
        options={fileLibrary.source}
        emptyHint="Upload one with the kind “Publication LaTeX source”."
        disabled={disabled}
      />

      <Field id={`${id}-changelog`} label="What changed in this edition">
        {() => (
          <TextArea
            id={`${id}-changelog`}
            rows={2}
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
          />
        )}
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={disabled || label.trim() === ""}
          onClick={() =>
            onSubmit({
              publicationId,
              versionLabel: label,
              editionNumber,
              publicationYear: year,
              publicationDate: "",
              pageCount,
              pdfMediaId: pdfId || null,
              originalMediaId: originalId || null,
              sourceArchiveMediaId: sourceId || null,
              changelogEn: changelog,
              changelogKm: "",
              /*
               * The first edition is active on creation — a publication with
               * exactly one edition and no active pointer cannot serve a
               * download, and there is nothing for the owner to choose between.
               */
              isActive: isFirst,
              status: "draft",
            })
          }
        >
          Create edition
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function SlotSummary({
  label,
  file,
}: {
  label: string;
  file: AdminPublicationFile | null;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-foreground-subtle">{label}</dt>
      <dd className="flex items-center gap-1.5 text-foreground">
        {file ? (
          <>
            <Icon
              name={file.visibility === "private" ? "lock" : "globe"}
              size={13}
              aria-hidden
            />
            <span className="min-w-0 truncate" title={file.filename}>
              {file.filename}
            </span>
            <span className="shrink-0 text-foreground-subtle">
              ({formatBytes(file.sizeBytes)})
            </span>
          </>
        ) : (
          <span className="text-foreground-subtle">Not attached</span>
        )}
      </dd>
    </div>
  );
}

function FileSlotSelect({
  id,
  label,
  description,
  value,
  onChange,
  options,
  emptyHint,
  disabled,
}: {
  id: string;
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  options: AdminPublicationFile[];
  emptyHint: string;
  disabled: boolean;
}) {
  return (
    <Field
      id={id}
      label={label}
      description={options.length === 0 ? `${description} ${emptyHint}` : description}
    >
      {({ describedBy }) => (
        <Select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={describedBy}
          disabled={disabled || options.length === 0}
        >
          <option value="">Not attached</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.filename} ({formatBytes(option.sizeBytes)})
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function CoverThumb({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative block aspect-[3/4] w-24 overflow-hidden rounded-(--radius-md) border border-border bg-surface-muted",
        className,
      )}
    >
      {src ? (
        <Image src={src} alt={alt} fill sizes="12rem" className="object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center text-foreground-subtle">
          <Icon name="image" size={20} aria-hidden />
        </span>
      )}
    </span>
  );
}

function ImagePicker({
  images,
  disabled,
  emptyHint,
  actionLabel,
  onPick,
}: {
  images: PublicationImageOption[];
  disabled: boolean;
  emptyHint: string;
  actionLabel: string;
  onPick: (image: PublicationImageOption) => void;
}) {
  if (images.length === 0) {
    return (
      <Notice tone="info">
        No public images in the library yet. {emptyHint}
      </Notice>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {images.slice(0, 12).map((image) => (
        <li key={image.id} className="flex flex-col gap-1.5">
          <CoverThumb src={image.thumbnailSrc} alt="" className="w-full" />
          <p className="truncate text-[0.75rem] text-foreground-subtle" title={image.filename}>
            {image.filename}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => onPick(image)}
          >
            {actionLabel}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function SamplePagePicker({
  publicationId,
  images,
  nextSortOrder,
  disabled,
  run,
}: {
  publicationId: string;
  images: PublicationImageOption[];
  nextSortOrder: number;
  disabled: boolean;
  run: (label: string, action: () => Promise<ActionResult<unknown>>) => void;
}) {
  const id = useId();
  const [assetId, setAssetId] = useState("");
  const [pageNumber, setPageNumber] = useState("");

  const chosen = images.find((image) => image.id === assetId);

  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
      <Field id={`${id}-asset`} label="Add a page image" className="min-w-52 flex-1">
        {() => (
          <Select
            id={`${id}-asset`}
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            disabled={disabled || images.length === 0}
          >
            <option value="">Choose an image…</option>
            {images.map((image) => (
              <option key={image.id} value={image.id}>
                {image.filename}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        id={`${id}-page`}
        label="Which page"
        description="Required — the viewer labels it."
        className="w-32"
      >
        {({ describedBy }) => (
          <TextInput
            id={`${id}-page`}
            type="number"
            min={1}
            value={pageNumber}
            onChange={(e) => setPageNumber(e.target.value)}
            aria-describedby={describedBy}
          />
        )}
      </Field>

      <Button
        type="button"
        variant="secondary"
        disabled={disabled || !assetId || pageNumber.trim() === ""}
        onClick={() => {
          if (!chosen) return;
          run("Sample page added", async () => {
            const result = await attachPublicationMedia({
              publicationId,
              mediaAssetId: chosen.id,
              role: "sample_page",
              sortOrder: nextSortOrder,
              pageNumber,
              captionEn: "",
              captionKm: "",
              altTextEn: chosen.altTextEn ?? `Page ${pageNumber}`,
              altTextKm: "",
              visibility: "public",
            });
            if (result.ok) {
              setAssetId("");
              setPageNumber("");
            }
            return result;
          });
        }}
      >
        Add page
      </Button>
    </div>
  );
}
