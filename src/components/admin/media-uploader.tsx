"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  isPrivateKind,
  MEDIA_KIND_LABELS,
  MEDIA_KINDS,
  PUBLICATION_FILE_KINDS,
  type MediaKind,
} from "@/lib/media/kinds";
import {
  acceptAttributeFor,
  formatBytes,
  uploadLimitFor,
} from "@/lib/media/validate";
import { cn } from "@/lib/utils/cn";

/**
 * Media upload.
 *
 * Uses a plain `fetch` with `FormData` rather than a Server Action, because
 * Server Actions cap request bodies at 2 MB — well under the 10 MB an upload here
 * is allowed to be.
 *
 * ── Why a queue rather than one file at a time ─────────────────────────────
 * A journey story is thirty photographs from one afternoon. Uploading them one
 * at a time — pick, name, submit, wait, repeat — is not a small inconvenience,
 * it is the thing that stops the library ever being populated.
 *
 * So: pick many, or drop a folder's worth on the panel, and they upload as a
 * queue. Each file is still its own request to the same endpoint, so the server
 * contract, the validation, the duplicate check and the audit log are all exactly
 * what they were for a single file. Nothing about the upload path changed; only
 * how many of them the browser drives.
 *
 * ── Why alt text is per file and never shared ──────────────────────────────
 * The obvious shortcut — one alt-text box applied to the whole batch — would be
 * actively harmful. Alt text describes *this* image; copying "students at a
 * science fair" onto thirty different photographs tells a screen-reader user
 * something false about twenty-nine of them, which is worse than telling them
 * nothing. This codebase's position throughout is that a wrong description costs
 * more than an absent one, so each row carries its own optional fields and the
 * gaps are surfaced afterwards by the library's "Missing alt text" filter.
 *
 * ── Concurrency ───────────────────────────────────────────────────────────
 * Three at a time. Each upload re-encodes an image with sharp, which is
 * CPU-bound on the server, so an unbounded fan-out of thirty would just queue on
 * the function anyway while making failures harder to attribute. Three is a
 * clear speedup over sequential and still bounded.
 */

const CONCURRENCY = 3;

type QueueStatus = "pending" | "uploading" | "done" | "error";

type QueueItem = {
  /** Stable key — `File` objects are not reliably identity-comparable. */
  id: string;
  file: File;
  altEn: string;
  altKm: string;
  status: QueueStatus;
  message: string | null;
  /** Object URL for the local preview, revoked when the row goes away. */
  previewUrl: string | null;
};

/**
 * True for an iPhone HEIC/HEIF file.
 *
 * Checked by extension as well as MIME type, because several platforms report no
 * type at all for HEIC — the same reason the server infers the type from the
 * extension.
 */
function isHeicFile(file: File): boolean {
  if (file.type === "image/heic" || file.type === "image/heif") return true;
  return /\.(heic|heif)$/i.test(file.name);
}

type UploadResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  filename?: string;
  processed?: boolean;
  visibility?: string;
};

export function MediaUploader() {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const fileId = useId();
  const kindId = useId();

  const [kind, setKind] = useState<MediaKind>("project_cover");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const isPrivate = isPrivateKind(kind);
  const isPublicationFile = PUBLICATION_FILE_KINDS.has(kind);
  const isSourceArchive = kind === "publication_source";
  const isPdfKind =
    kind === "certificate_original" || kind === "resume_file" || isPublicationFile;

  /*
   * Both derived from the kind rather than hard-coded, so this form and
   * `upload/route.ts` cannot disagree about what may be selected or how large it
   * may be. They did disagree: the route learned the publication kinds and this
   * form did not, which left every PDF greyed out in the picker under
   * "Publication PDF" and would have rejected a 12 MB book against a 10 MB limit
   * that does not apply to it.
   */
  const accept = acceptAttributeFor(kind);
  const maxBytes = uploadLimitFor(kind);
  const maxSizeLabel = formatBytes(maxBytes);

  // A source archive has no alt text and no preview — it is never rendered.
  const needsAltText = !isPrivate && kind !== "resume_file" && !isPublicationFile;

  /*
   * Object URLs are a manual resource. Without this, dropping several hundred
   * photographs over a working session leaks every preview until the tab closes.
   */
  useEffect(() => {
    return () => {
      for (const item of queue) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
    // Intentionally on unmount only — per-item revocation happens in `remove`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files);
      if (incoming.length === 0) return;

      const accepted: QueueItem[] = [];
      const rejected: string[] = [];

      for (const file of incoming) {
        /*
         * Size is checked here as well as on the server, so an oversized file
         * fails instantly instead of after a long upload that ends in a 400. The
         * server check is the real one; this only avoids wasting the editor's
         * time and bandwidth.
         */
        if (file.size > maxBytes) {
          rejected.push(`${file.name} (${formatBytes(file.size)})`);
          continue;
        }

        if (file.size === 0) {
          rejected.push(`${file.name} (empty)`);
          continue;
        }

        accepted.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          altEn: "",
          altKm: "",
          status: "pending",
          message: null,
          /*
           * No object URL for HEIC.
           *
           * Only Safari can render one, so everywhere else `<img src=blob:…>`
           * draws the browser's broken-image glyph — which reads as "this file
           * was rejected" when in fact it is queued and will upload fine. A
           * labelled tile says what will actually happen to it instead.
           */
          previewUrl:
            file.type.startsWith("image/") && !isHeicFile(file)
              ? URL.createObjectURL(file)
              : null,
        });
      }

      if (rejected.length > 0) {
        toast.show({
          tone: "error",
          title: `${rejected.length} file${rejected.length === 1 ? "" : "s"} skipped`,
          description: `Over the ${maxSizeLabel} limit, or empty: ${rejected.slice(0, 5).join(", ")}${rejected.length > 5 ? "…" : ""}`,
          duration: 0,
        });
      }

      if (accepted.length > 0) {
        // Appended rather than replacing, so a second pick adds to the queue —
        // which is what happens when the photographs live in two folders.
        setQueue((current) => [...current, ...accepted]);
      }
    },
    [maxBytes, maxSizeLabel, toast],
  );

  function update(id: string, patch: Partial<QueueItem>) {
    setQueue((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function remove(id: string) {
    setQueue((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  function clearFinished() {
    setQueue((current) => {
      for (const item of current) {
        if (item.status === "done" && item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
      return current.filter((item) => item.status !== "done");
    });
  }

  /** Upload one file. Never throws — the outcome is written onto the row. */
  async function uploadOne(item: QueueItem): Promise<boolean> {
    update(item.id, { status: "uploading", message: null });

    const body = new FormData();
    body.set("file", item.file);
    body.set("kind", kind);
    if (item.altEn.trim()) body.set("alt_text_en", item.altEn.trim());
    if (item.altKm.trim()) body.set("alt_text_km", item.altKm.trim());

    try {
      const response = await fetch("/api/admin/media/upload", {
        method: "POST",
        body,
      });

      const result = (await response.json().catch(() => null)) as UploadResponse | null;

      if (!response.ok || !result?.ok) {
        update(item.id, {
          status: "error",
          // The API returns specific, human-readable messages for validation
          // failures — surface them rather than a generic error.
          message:
            result?.error === "duplicate"
              ? (result.message ?? "Already in the library.")
              : (result?.message ?? "Upload failed."),
        });
        return false;
      }

      update(item.id, {
        status: "done",
        message: [
          result.visibility === "private" ? "private" : "public",
          result.processed ? "WebP + derivatives" : "stored as-is",
        ]
          .filter(Boolean)
          .join(" · "),
      });
      return true;
    } catch {
      update(item.id, {
        status: "error",
        message: "The connection dropped.",
      });
      return false;
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Anything not already uploaded — so pressing Upload again after a partial
    // failure retries exactly the ones that failed.
    const todo = queue.filter((item) => item.status !== "done");

    if (todo.length === 0) {
      toast.show({ tone: "error", title: "Choose some files first" });
      return;
    }

    setIsUploading(true);

    let succeeded = 0;
    let failed = 0;

    /*
     * A shared cursor consumed by N workers, rather than fixed slices. With
     * slices, one large file stalls its whole slice while other workers idle;
     * this keeps all three busy until the queue is empty.
     */
    let cursor = 0;
    const next = () => (cursor < todo.length ? todo[cursor++] : undefined);

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, todo.length) }, async () => {
        for (let item = next(); item; item = next()) {
          const ok = await uploadOne(item);
          if (ok) succeeded += 1;
          else failed += 1;
        }
      }),
    );

    setIsUploading(false);

    toast.show({
      tone: failed === 0 ? "success" : succeeded === 0 ? "error" : "warning",
      title:
        failed === 0
          ? `Uploaded ${succeeded} file${succeeded === 1 ? "" : "s"}`
          : `Uploaded ${succeeded} of ${todo.length}`,
      description:
        failed > 0
          ? "The failed rows below say why. Press Upload again to retry just those."
          : needsAltText && queue.some((item) => !item.altEn.trim())
            ? "Some files have no alt text. The library's “Missing alt text” filter lists them."
            : undefined,
      duration: failed > 0 ? 0 : 6000,
    });

    router.refresh();
  }

  const pendingCount = queue.filter((item) => item.status !== "done").length;
  const doneCount = queue.filter((item) => item.status === "done").length;
  const totalBytes = queue
    .filter((item) => item.status !== "done")
    .reduce((sum, item) => sum + item.file.size, 0);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-h4 font-semibold">Upload files</h2>
      </CardHeader>

      <CardBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field
            id={kindId}
            label="What are these files for?"
            description="Applies to every file in the queue. This decides which bucket they go in and whether they are ever publicly reachable."
          >
            {({ describedBy }) => (
              <Select
                id={kindId}
                value={kind}
                aria-describedby={describedBy}
                onChange={(event) => setKind(event.target.value as MediaKind)}
              >
                {MEDIA_KINDS.map((option) => (
                  <option key={option} value={option}>
                    {MEDIA_KIND_LABELS[option]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {/* State the privacy consequence before the upload, not after. */}
          {isPrivate ? (
            <Notice tone="warning" icon="lock" title="These files will be private">
              <p>
                Stored in a private bucket with no public URL. Anonymous visitors
                cannot see that they exist, and only the site owner can open them —
                through a 60-second signed link, with every access logged.
              </p>
            </Notice>
          ) : (
            <Notice tone="info" icon="globe" title="These files will be public">
              <p>
                Anyone with the URL will be able to view them. For a certificate,
                make sure it is the <strong>redacted</strong> copy.
              </p>
            </Notice>
          )}

          {/* ── Drop zone ─────────────────────────────────────────────────── */}
          <Field
            id={fileId}
            label="Files"
            description={
              isSourceArchive
                ? `A ZIP archive, up to ${maxSizeLabel}. Include the .tex, .sty, .bib, figures and a README — and remove .aux, .log, .out, .toc and .synctex.gz first, because a LaTeX log records every absolute path the compiler touched. The archive is stored privately and is never expanded or compiled.`
                : isPublicationFile
                  ? `A PDF, up to ${maxSizeLabel}. Stored privately and served only through the publication's download route, which checks its download policy first — so even the reader-facing edition never gets a public URL.`
                  : isPdfKind
                    ? `PDF, JPEG, PNG or WebP. Up to ${maxSizeLabel} each. Choose several at once, or drop them below.`
                    : `Images only — JPEG, PNG, WebP, AVIF or HEIC, up to ${maxSizeLabel} each. Choose several at once, or drop them below. iPhone HEIC photographs are converted automatically, so the site never serves one. To upload a PDF, choose “Certificate original”, “Resume PDF” or one of the “Publication” kinds above; PDFs are always stored privately. Images are re-encoded to WebP, stripped of EXIF metadata, and resized into thumbnail, card and preview versions.`
            }
          >
            {({ describedBy }) => (
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  if (event.dataTransfer.files.length > 0) {
                    addFiles(event.dataTransfer.files);
                  }
                }}
                className={cn(
                  "flex flex-col items-center gap-3 rounded-(--radius-md) border-2 border-dashed p-6 text-center transition-colors",
                  isDragging
                    ? "border-primary bg-primary-subtle"
                    : "border-border-strong bg-surface",
                )}
              >
                <Icon
                  name="upload"
                  size={22}
                  className={isDragging ? "text-primary" : "text-foreground-subtle"}
                />

                <p className="text-small text-foreground-muted">
                  Drop files here, or
                </p>

                {/*
                  A real file input rather than a div with a click handler: it is
                  keyboard-reachable, it is what a screen reader announces as a
                  file control, and it is what makes the drop zone optional rather
                  than the only way in.
                */}
                <input
                  ref={inputRef}
                  id={fileId}
                  type="file"
                  multiple
                  accept={accept}
                  aria-describedby={describedBy}
                  onChange={(event) => {
                    if (event.target.files) addFiles(event.target.files);
                    // Cleared so picking the same file again still fires change.
                    event.target.value = "";
                  }}
                  className="w-full max-w-sm rounded-(--radius-md) border border-border-strong bg-surface p-2.5 text-small file:mr-3 file:rounded-(--radius-sm) file:border-0 file:bg-primary file:px-3 file:py-2 file:text-small file:font-medium file:text-primary-foreground"
                />
              </div>
            )}
          </Field>

          {/* ── Queue ─────────────────────────────────────────────────────── */}
          {queue.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-small font-medium">
                  {queue.length} file{queue.length === 1 ? "" : "s"} in the queue
                </p>

                {pendingCount > 0 ? (
                  <Badge tone="neutral">{formatBytes(totalBytes)} to upload</Badge>
                ) : null}

                {doneCount > 0 ? (
                  <>
                    <Badge tone="success" icon="checkCircle">
                      {doneCount} uploaded
                    </Badge>
                    <button
                      type="button"
                      onClick={clearFinished}
                      className="ml-auto min-h-11 text-[0.8125rem] font-medium text-foreground-muted underline underline-offset-4 transition-colors hover:text-foreground"
                    >
                      Clear the uploaded ones
                    </button>
                  </>
                ) : null}
              </div>

              <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto p-0.5">
                {queue.map((item) => (
                  <li key={item.id}>
                    <QueueRow
                      item={item}
                      needsAltText={needsAltText}
                      disabled={isUploading}
                      onChange={(patch) => update(item.id, patch)}
                      onRemove={() => remove(item.id)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              iconStart="upload"
              loading={isUploading}
              disabled={pendingCount === 0}
            >
              {isUploading
                ? "Uploading…"
                : pendingCount === 0
                  ? "Upload"
                  : `Upload ${pendingCount} file${pendingCount === 1 ? "" : "s"}`}
            </Button>

            {queue.length > 0 && !isUploading ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  for (const item of queue) {
                    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
                  }
                  setQueue([]);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                Clear the queue
              </Button>
            ) : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

// ── One queued file ─────────────────────────────────────────────────────────

function QueueRow({
  item,
  needsAltText,
  disabled,
  onChange,
  onRemove,
}: {
  item: QueueItem;
  needsAltText: boolean;
  disabled: boolean;
  onChange: (patch: Partial<QueueItem>) => void;
  onRemove: () => void;
}) {
  const done = item.status === "done";
  const failed = item.status === "error";
  const isHeic = isHeicFile(item.file);

  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-(--radius-md) border p-3 transition-colors",
        done && "border-success/40 bg-success-subtle/40",
        failed && "border-danger/40 bg-danger-subtle/30",
        !done && !failed && "border-border bg-surface",
      )}
    >
      {item.previewUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element -- a local object
           URL, not a remote asset; the optimiser cannot process a blob. */
        <img
          src={item.previewUrl}
          alt=""
          width={56}
          height={56}
          className="size-14 shrink-0 rounded-(--radius-sm) border border-border object-cover"
        />
      ) : isHeic ? (
        /*
         * HEIC has no local preview — see the note where previewUrl is set. The
         * tile names the format rather than showing a generic file icon, so it
         * is obvious the file was recognised and not rejected.
         */
        <span
          className={cn(
            "flex size-14 shrink-0 flex-col items-center justify-center gap-0.5",
            "rounded-(--radius-sm) border border-border bg-surface-muted text-foreground-muted",
          )}
        >
          <Icon name="image" size={16} />
          <span className="text-[0.5625rem] font-semibold tracking-wide">HEIC</span>
        </span>
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded-(--radius-sm) border border-border text-foreground-subtle">
          <Icon name="file" size={18} />
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <code className="max-w-[28ch] truncate text-[0.8125rem] font-medium">
            {item.file.name}
          </code>

          <span className="text-[0.75rem] text-foreground-subtle">
            {formatBytes(item.file.size)}
          </span>

          {item.status === "uploading" ? (
            <Badge tone="info" icon="refresh">
              Uploading
            </Badge>
          ) : null}
          {done ? (
            <Badge tone="success" icon="checkCircle">
              Uploaded
            </Badge>
          ) : null}
          {failed ? (
            <Badge tone="danger" icon="alertCircle">
              Failed
            </Badge>
          ) : null}
        </div>

        {/*
          Said explicitly while the file is queued, because the absent preview
          would otherwise read as a problem. Dropped once the row reports its
          real outcome.
        */}
        {isHeic && !done && !failed ? (
          <p className="text-[0.75rem] text-foreground-subtle">
            iPhone HEIC — no preview here, because only Safari can display one.
            It converts to WebP on upload.
          </p>
        ) : null}

        {item.message ? (
          <p
            className={cn(
              "text-[0.75rem]",
              failed ? "text-danger-foreground" : "text-foreground-subtle",
            )}
          >
            {item.message}
          </p>
        ) : null}

        {/*
          Alt text is offered per file, and only while the file is still queued.
          Once uploaded, the row collapses to its result and further editing
          happens in the library, where the image can actually be seen at size.
        */}
        {needsAltText && !done ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <TextInput
              aria-label={`Alt text in English for ${item.file.name}`}
              placeholder="Alt text (English)"
              value={item.altEn}
              disabled={disabled}
              onChange={(event) => onChange({ altEn: event.target.value })}
            />
            <TextInput
              lang="km"
              aria-label={`Alt text in Khmer for ${item.file.name}`}
              placeholder="Alt text (Khmer)"
              value={item.altKm}
              disabled={disabled}
              onChange={(event) => onChange({ altKm: event.target.value })}
            />
          </div>
        ) : null}
      </div>

      <IconButton
        icon="close"
        label={`Remove ${item.file.name} from the queue`}
        size="sm"
        variant="ghost"
        disabled={disabled}
        onClick={onRemove}
      />
    </div>
  );
}
