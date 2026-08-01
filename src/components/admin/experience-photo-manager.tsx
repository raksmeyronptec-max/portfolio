"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState, useTransition } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Badge, Card, CardBody, Divider } from "@/components/ui/primitives";
import { EmptyState, Notice } from "@/components/ui/states";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import {
  attachExperiencePhoto,
  removeExperiencePhoto,
  reorderExperienceGallery,
  setExperienceCover,
  updateExperiencePhoto,
} from "@/lib/actions/experience-media";
import type { AdminExperiencePhoto, MediaPickerOption } from "@/lib/data/admin-experience-media";
import { formatBytes, MAX_UPLOAD_SIZE_BYTES } from "@/lib/media/validate";
import {
  consentStatuses,
  EXPERIENCE_PHOTO_CHECKLIST,
  experienceMediaErrorLabels,
  mediaVisibilities,
  privacyStatuses,
  type ConsentStatus,
  type MediaVisibility,
  type PrivacyStatus,
} from "@/lib/validation/experience-media";
import type { ActionResult } from "@/lib/actions/result";
import { cn } from "@/lib/utils/cn";

/**
 * Experience photograph management.
 *
 * The ordering of the interface is the argument it makes: attach, then describe,
 * then review, then publish. Publication is the last control on the panel and is
 * disabled until the ones above it are satisfied, so the sequence cannot be
 * short-circuited by scrolling past the parts that matter.
 *
 * Nothing here is the security boundary. Every action re-checks the caller's
 * permission server-side and the database re-checks the publication invariant;
 * hiding a control only saves someone a refused request.
 */

/**
 * Admin thumbnail.
 *
 * A plain `<img>`, not `next/image`. These are 200px derivatives rendered behind
 * authentication on a `force-dynamic` page: the optimiser would add a transform
 * per photograph for no visual gain, and it cannot cache the result on an
 * authenticated route anyway. One component so the lint exemption is stated once
 * with its reason, rather than sprinkled at three call sites.
 */
function AdminThumbnail({
  src,
  size,
  className,
}: {
  src: string;
  size: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see the note above
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={cn(
        "shrink-0 rounded-(--radius-md) border border-border object-cover",
        className,
      )}
    />
  );
}

const PRIVACY_LABELS: Record<PrivacyStatus, string> = {
  pending_review: "Pending review",
  approved: "Approved for publication",
  rejected: "Rejected",
};

const CONSENT_LABELS: Record<ConsentStatus, string> = {
  not_required: "Not required — nobody is identifiable",
  pending: "Pending — not yet obtained",
  confirmed: "Confirmed — permission obtained",
  denied: "Denied — must not be published",
};

const VISIBILITY_LABELS: Record<MediaVisibility, string> = {
  private: "Private — my records only",
  hidden: "Hidden — approved, but withheld for now",
  public: "Public — shown on the Experience page",
};

export function ExperiencePhotoManager({
  experienceId,
  experienceSlug,
  experienceIsPublished,
  photos,
  library,
  canReview,
}: {
  experienceId: string;
  experienceSlug: string;
  experienceIsPublished: boolean;
  photos: AdminExperiencePhoto[];
  library: MediaPickerOption[];
  canReview: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<AdminExperiencePhoto | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<AdminExperiencePhoto | null>(null);

  // Local order, so dragging feels immediate rather than waiting on a round trip.
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const ordered = useMemo(() => {
    if (!order) return photos;
    const byId = new Map(photos.map((photo) => [photo.id, photo]));
    const sorted = order.map((id) => byId.get(id)).filter(Boolean) as AdminExperiencePhoto[];
    // Anything added since the local order was captured still has to appear.
    const missing = photos.filter((photo) => !order.includes(photo.id));
    return [...sorted, ...missing];
  }, [order, photos]);

  const attachedIds = useMemo(
    () => new Set(photos.map((photo) => photo.mediaId)),
    [photos],
  );

  const liveCount = photos.filter((photo) => photo.isLive).length;
  const pendingCount = photos.filter(
    (photo) => photo.privacyStatus === "pending_review",
  ).length;

  function run(label: string, action: () => Promise<ActionResult<unknown>>) {
    startTransition(async () => {
      const result = await action();

      if (result.ok) {
        toast.show({ tone: "success", title: label });
        setOrder(null);
        router.refresh();
        return;
      }

      toast.show({
        tone: result.code === "publish_blocked" ? "warning" : "error",
        title:
          result.code === "publish_blocked"
            ? "Not ready to publish"
            : result.code === "forbidden"
              ? "Not permitted"
              : "Could not save",
        description:
          result.detail ??
          (result.fields
            ? Object.values(result.fields)
                .map((code) => experienceMediaErrorLabels[code] ?? code)
                .join(" ")
            : "Please try again."),
        duration: 0,
      });
    });
  }

  function commitOrder(next: AdminExperiencePhoto[]) {
    const ids = next.map((photo) => photo.id);
    setOrder(ids);
    run("Order saved", () => reorderExperienceGallery(experienceId, ids));
  }

  function move(index: number, delta: number) {
    const next = [...ordered];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    commitOrder(next);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Summary ─────────────────────────────────────────────────────── */}
      {photos.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral" icon="image">
            {photos.length} {photos.length === 1 ? "photo" : "photos"}
          </Badge>
          <Badge tone={liveCount > 0 ? "success" : "neutral"} icon="globe">
            {liveCount} public
          </Badge>
          {pendingCount > 0 ? (
            <Badge tone="warning" icon="shield">
              {pendingCount} awaiting privacy review
            </Badge>
          ) : null}
          {!photos.some((photo) => photo.role === "cover") ? (
            <Badge tone="warning" icon="alertCircle">
              No cover set
            </Badge>
          ) : null}
        </div>
      ) : null}

      {!experienceIsPublished && liveCount > 0 ? (
        <Notice tone="info" icon="eyeOff" title="Nothing is public yet">
          <p>
            {liveCount === 1 ? "One photograph is" : `${liveCount} photographs are`}{" "}
            marked public, but this experience entry is not published, so nothing is
            visible on the site. Publish the entry to show them.
          </p>
        </Notice>
      ) : null}

      {/* ── Add ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <Button iconStart="image" onClick={() => setPickerOpen(true)}>
          Choose from media library
        </Button>
        <UploadButton experienceId={experienceId} onUploaded={() => router.refresh()} />
      </div>

      {/* ── The list ────────────────────────────────────────────────────── */}
      {photos.length === 0 ? (
        <EmptyState
          icon="image"
          title="No photographs yet"
          description="Add photos that provide visual evidence of this experience — a lesson being taught, materials you prepared, the school environment. Text remains the primary evidence; photographs support it."
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {ordered.map((photo, index) => (
            <li
              key={photo.id}
              draggable={!isPending}
              onDragStart={() => setDragId(photo.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (!dragId || dragId === photo.id) return;
                const next = [...ordered];
                const from = next.findIndex((item) => item.id === dragId);
                const to = next.findIndex((item) => item.id === photo.id);
                if (from < 0 || to < 0) return;
                const [moved] = next.splice(from, 1);
                if (!moved) return;
                next.splice(to, 0, moved);
                setDragId(null);
                commitOrder(next);
              }}
              className={cn(dragId === photo.id && "opacity-50")}
            >
              <PhotoRow
                photo={photo}
                index={index}
                total={ordered.length}
                isPending={isPending}
                canReview={canReview}
                onEdit={() => setEditing(photo)}
                onMakeCover={() =>
                  run("Cover image changed", () => setExperienceCover(photo.id))
                }
                onMoveUp={() => move(index, -1)}
                onMoveDown={() => move(index, 1)}
                onRemove={() => setConfirmRemove(photo)}
              />
            </li>
          ))}
        </ol>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}
      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        library={library}
        attachedIds={attachedIds}
        isPending={isPending}
        onChoose={(mediaId) => {
          setPickerOpen(false);
          run("Photograph attached", () =>
            attachExperiencePhoto(experienceId, mediaId),
          );
        }}
      />

      <PhotoEditorDialog
        photo={editing}
        canReview={canReview}
        experienceSlug={experienceSlug}
        onClose={() => setEditing(null)}
        onSave={(values) => {
          const target = editing;
          if (!target) return;
          setEditing(null);
          run("Photograph saved", () => updateExperiencePhoto(target.id, values));
        }}
      />

      <ConfirmDialog
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        onConfirm={async () => {
          const target = confirmRemove;
          if (!target) return;
          setConfirmRemove(null);
          run("Photograph detached", () => removeExperiencePhoto(target.id));
        }}
        title="Remove this photograph from the experience?"
        description="This detaches the photograph from this entry only. The image itself stays in the media library and any other content using it is unaffected."
        confirmLabel="Remove attachment"
        cancelLabel="Cancel"
        closeLabel="Close"
      />
    </div>
  );
}

// ── One row ─────────────────────────────────────────────────────────────────

function PhotoRow({
  photo,
  index,
  total,
  isPending,
  canReview,
  onEdit,
  onMakeCover,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  photo: AdminExperiencePhoto;
  index: number;
  total: number;
  isPending: boolean;
  canReview: boolean;
  onEdit: () => void;
  onMakeCover: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <Card className={cn(photo.role === "cover" && "border-primary/50")}>
      <CardBody className="flex flex-wrap items-start gap-4 p-4">
        {photo.thumbnailSrc ? (
          <AdminThumbnail src={photo.thumbnailSrc} size={96} className="size-24" />
        ) : (
          <div className="flex size-24 shrink-0 items-center justify-center rounded-(--radius-md) border border-dashed border-border-strong text-foreground-subtle">
            <Icon name="alertTriangle" size={20} />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {photo.role === "cover" ? (
              <Badge tone="accent" icon="star">
                Cover
              </Badge>
            ) : null}

            <Badge tone={photo.isLive ? "success" : "neutral"} icon={photo.isLive ? "globe" : "lock"}>
              {photo.isLive ? "Public" : VISIBILITY_LABELS[photo.visibility].split(" —")[0]}
            </Badge>

            <Badge
              tone={
                photo.privacyStatus === "approved"
                  ? "success"
                  : photo.privacyStatus === "rejected"
                    ? "danger"
                    : "warning"
              }
              icon="shield"
            >
              {PRIVACY_LABELS[photo.privacyStatus]}
            </Badge>

            {photo.consentStatus !== "not_required" ? (
              <Badge
                tone={
                  photo.consentStatus === "confirmed"
                    ? "success"
                    : photo.consentStatus === "denied"
                      ? "danger"
                      : "warning"
                }
                icon="users"
              >
                Consent: {photo.consentStatus.replace("_", " ")}
              </Badge>
            ) : null}
          </div>

          <p className="text-small font-medium">
            {photo.captionEn ?? (
              <span className="text-foreground-subtle">No English caption</span>
            )}
          </p>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-foreground-subtle">
            <code className="max-w-[24ch] truncate">{photo.filename}</code>
            {photo.captionKm ? null : <span>Khmer caption missing</span>}
            {photo.altTextEn ?? photo.assetAltTextEn ? null : (
              <span className="text-warning-foreground">Alt text missing</span>
            )}
            {photo.photoDate ? <span>{photo.photoDate}</span> : null}
          </p>

          {photo.isPrivateAsset ? (
            <Notice tone="danger" icon="lock">
              <p>
                The underlying file is stored privately and has no public URL, so
                this photograph can never render. Detach it and upload a public
                copy instead.
              </p>
            </Notice>
          ) : null}

          {photo.blockers.length > 0 && photo.visibility !== "public" ? (
            <p className="text-[0.75rem] text-foreground-muted">
              Before this can be published:{" "}
              {photo.blockers
                .map((code) => experienceMediaErrorLabels[code] ?? code)
                .join(" ")}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex gap-1">
            <IconButton
              icon="chevronUp"
              label={`Move ${photo.filename} earlier`}
              size="sm"
              variant="ghost"
              disabled={isPending || index === 0}
              onClick={onMoveUp}
            />
            <IconButton
              icon="chevronDown"
              label={`Move ${photo.filename} later`}
              size="sm"
              variant="ghost"
              disabled={isPending || index === total - 1}
              onClick={onMoveDown}
            />
          </div>

          <div className="flex gap-1">
            {photo.role !== "cover" ? (
              <IconButton
                icon="star"
                label={`Make ${photo.filename} the cover image`}
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={onMakeCover}
              />
            ) : null}

            <IconButton
              icon="edit"
              label={`Edit ${photo.filename}`}
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={onEdit}
            />

            <IconButton
              icon="trash"
              label={`Remove ${photo.filename} from this experience`}
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={onRemove}
            />
          </div>
        </div>
      </CardBody>

      {!canReview ? null : null}
    </Card>
  );
}

// ── Media picker ────────────────────────────────────────────────────────────

function MediaPickerDialog({
  open,
  onClose,
  library,
  attachedIds,
  isPending,
  onChoose,
}: {
  open: boolean;
  onClose: () => void;
  library: MediaPickerOption[];
  attachedIds: Set<string>;
  isPending: boolean;
  onChoose: (mediaId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const searchId = useId();

  const filtered = library.filter((item) => {
    if (!query.trim()) return true;
    const haystack = [item.filename, item.altTextEn, item.captionEn, item.kind]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Choose a photograph"
      description="Only public images are listed. A privately stored file has no public URL and could never be displayed."
      closeLabel="Close"
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <Field id={searchId} label="Search the library">
          {({ describedBy }) => (
            <TextInput
              id={searchId}
              value={query}
              aria-describedby={describedBy}
              placeholder="Filename, alt text or caption"
              onChange={(event) => setQuery(event.target.value)}
            />
          )}
        </Field>

        {filtered.length === 0 ? (
          <EmptyState
            icon="image"
            title="No approved experience photos are available"
            description="Upload a new image, or review an existing private upload and publish a redacted copy."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filtered.map((item) => {
              const alreadyAttached = attachedIds.has(item.id);

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={alreadyAttached || isPending}
                    onClick={() => onChoose(item.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-(--radius-md) border p-3 text-left transition-colors",
                      alreadyAttached
                        ? "cursor-not-allowed border-dashed border-border opacity-60"
                        : "border-border hover:border-border-interactive hover:bg-surface-muted",
                    )}
                  >
                    {item.thumbnailSrc ? (
                      <AdminThumbnail
                        src={item.thumbnailSrc}
                        size={64}
                        className="size-16"
                      />
                    ) : (
                      <span className="flex size-16 shrink-0 items-center justify-center rounded-(--radius-sm) border border-border text-foreground-subtle">
                        <Icon name="image" size={18} />
                      </span>
                    )}

                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-small font-medium">
                        {item.filename}
                      </span>
                      <span className="text-[0.75rem] text-foreground-subtle">
                        {item.kind.replace(/_/g, " ")}
                        {item.width && item.height
                          ? ` · ${item.width}×${item.height}`
                          : ""}
                      </span>
                      {alreadyAttached ? (
                        <span className="text-[0.75rem] font-medium text-foreground-muted">
                          Already attached
                        </span>
                      ) : item.usedBy.length > 0 ? (
                        <span className="text-[0.75rem] text-foreground-subtle">
                          Used by: {item.usedBy.join(", ")}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

// ── Upload ──────────────────────────────────────────────────────────────────

/**
 * Upload without leaving the page.
 *
 * Posts to the existing `/api/admin/media/upload` route rather than introducing a
 * second upload path — that endpoint already validates the MIME type and the file
 * signature, enforces the size cap, sanitises the filename, strips EXIF including
 * GPS, re-encodes to WebP and generates the thumbnail, card and preview
 * derivatives. Duplicating any of that here would eventually mean two sets of
 * rules, one of them wrong.
 *
 * The uploaded asset is NOT auto-attached: it lands in the library and the admin
 * picks it, so the "which image did I just upload?" step is explicit.
 */
function UploadButton({
  experienceId,
  onUploaded,
}: {
  experienceId: string;
  onUploaded: () => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.show({
        tone: "error",
        title: "That file is too large",
        description: `“${file.name}” is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_UPLOAD_SIZE_BYTES)} — resize or re-export it and try again.`,
        duration: 0,
      });
      return;
    }

    setBusy(true);

    const body = new FormData();
    body.set("file", file);
    body.set("kind", "experience_photo");

    try {
      const response = await fetch("/api/admin/media/upload", {
        method: "POST",
        body,
      });

      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        message?: string;
      } | null;

      if (!response.ok || !result?.ok) {
        toast.show({
          tone: result?.error === "duplicate" ? "warning" : "error",
          title:
            result?.error === "duplicate"
              ? "Already in the library"
              : "Upload failed",
          description:
            result?.message ??
            "The upload could not be processed. Check the format and try again.",
          duration: 0,
        });
        return;
      }

      toast.show({
        tone: "success",
        title: "Uploaded to the media library",
        description:
          "EXIF metadata including GPS was removed and web-sized copies were generated. Choose it below to attach it.",
      });

      onUploaded();
    } catch {
      toast.show({
        tone: "error",
        title: "Upload failed",
        description: "The connection dropped. Please try again.",
        duration: 0,
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        id={`upload-${experienceId}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button
        variant="outline"
        iconStart="upload"
        loading={busy}
        onClick={() => inputRef.current?.click()}
      >
        Upload new
      </Button>
    </>
  );
}

// ── Editor ──────────────────────────────────────────────────────────────────

type EditorValues = {
  mediaId: string;
  role: "cover" | "gallery";
  sortOrder: number;
  captionEn: string;
  captionKm: string;
  altTextEn: string;
  altTextKm: string;
  photoDate: string;
  locationEn: string;
  locationKm: string;
  credit: string;
  privacyStatus: PrivacyStatus;
  consentStatus: ConsentStatus;
  visibility: MediaVisibility;
  focalX: string;
  focalY: string;
  reviewNote: string;
};

function toEditorValues(photo: AdminExperiencePhoto): EditorValues {
  return {
    mediaId: photo.mediaId,
    role: photo.role,
    sortOrder: photo.sortOrder,
    captionEn: photo.captionEn ?? "",
    captionKm: photo.captionKm ?? "",
    altTextEn: photo.altTextEn ?? "",
    altTextKm: photo.altTextKm ?? "",
    photoDate: photo.photoDate ?? "",
    locationEn: photo.locationEn ?? "",
    locationKm: photo.locationKm ?? "",
    credit: photo.credit ?? "",
    privacyStatus: photo.privacyStatus,
    consentStatus: photo.consentStatus,
    visibility: photo.visibility,
    focalX: photo.focalX === null ? "" : String(photo.focalX),
    focalY: photo.focalY === null ? "" : String(photo.focalY),
    reviewNote: photo.reviewNote ?? "",
  };
}

/**
 * The state the dialog holds while no photograph is open.
 *
 * A real object, not `{} as EditorValues`: the reset below runs *during* render,
 * and React finishes the current render pass before re-running the component
 * with the new state. So the frame in which a photograph is first selected still
 * reads these fields — and a cast that lied about them crashed the whole admin
 * page on `values.altTextEn.trim()` the moment anyone clicked Edit.
 */
function blankEditorValues(): EditorValues {
  return {
    mediaId: "",
    role: "gallery",
    sortOrder: 0,
    captionEn: "",
    captionKm: "",
    altTextEn: "",
    altTextKm: "",
    photoDate: "",
    locationEn: "",
    locationKm: "",
    credit: "",
    privacyStatus: "pending_review",
    consentStatus: "pending",
    visibility: "hidden",
    focalX: "",
    focalY: "",
    reviewNote: "",
  };
}

function PhotoEditorDialog({
  photo,
  canReview,
  experienceSlug,
  onClose,
  onSave,
}: {
  photo: AdminExperiencePhoto | null;
  canReview: boolean;
  experienceSlug: string;
  onClose: () => void;
  onSave: (values: EditorValues) => void;
}) {
  const [values, setValues] = useState<EditorValues>(() =>
    photo ? toEditorValues(photo) : blankEditorValues(),
  );
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  /*
   * Reset when a different photograph is opened. Adjusted during render rather
   * than in an effect — the same pattern as EntityEditor, so the dialog never
   * paints the previous photograph's captions for a frame.
   */
  const [renderedFor, setRenderedFor] = useState<AdminExperiencePhoto | null>(photo);

  if (photo && renderedFor !== photo) {
    setRenderedFor(photo);
    setValues(toEditorValues(photo));
    // An already-approved photograph starts with the checklist satisfied, so a
    // small caption fix does not force the whole review again.
    setTicked(
      photo.privacyStatus === "approved"
        ? new Set(EXPERIENCE_PHOTO_CHECKLIST.map((item) => item.id))
        : new Set(),
    );
  } else if (!photo && renderedFor !== null) {
    setRenderedFor(null);
  }

  if (!photo) {
    return (
      <Dialog open={false} onClose={onClose} title="" closeLabel="Close">
        <span />
      </Dialog>
    );
  }

  const allTicked = EXPERIENCE_PHOTO_CHECKLIST.every((item) => ticked.has(item.id));
  const remaining = EXPERIENCE_PHOTO_CHECKLIST.length - ticked.size;

  const effectiveAltEn = values.altTextEn.trim() || photo.assetAltTextEn?.trim() || "";
  const canGoPublic =
    values.privacyStatus === "approved" &&
    (values.consentStatus === "confirmed" || values.consentStatus === "not_required") &&
    effectiveAltEn !== "";

  function update<K extends keyof EditorValues>(key: K, value: EditorValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggle(id: string, checked: boolean) {
    setTicked((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

    // Un-ticking revokes the approval: the review no longer covers the full list.
    if (!checked && values.privacyStatus === "approved") {
      setValues((current) => ({
        ...current,
        privacyStatus: "pending_review",
        visibility: current.visibility === "public" ? "hidden" : current.visibility,
      }));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Photograph details"
      description={`Attached to /${experienceSlug}`}
      closeLabel="Close"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button iconStart="check" onClick={() => onSave(values)}>
            Save photograph
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {/* ── Preview ───────────────────────────────────────────────────── */}
        {photo.thumbnailSrc ? (
          <div className="flex items-start gap-4">
            <AdminThumbnail src={photo.thumbnailSrc} size={112} className="size-28" />
            <div className="flex flex-col gap-1 text-[0.8125rem] text-foreground-muted">
              <code className="text-foreground">{photo.filename}</code>
              <span>
                This is the public, optimised copy — EXIF metadata including any GPS
                location was removed at upload.
              </span>
            </div>
          </div>
        ) : null}

        {/* ── Captions ──────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <h3 className="text-small font-semibold">Caption</h3>

          <LabelledArea
            label="Caption (English)"
            description="Explain the professional relevance. “Preparing a learner-centred mathematics activity during my second-year teaching practicum” — not “Me teaching”."
            value={values.captionEn}
            onChange={(value) => update("captionEn", value)}
          />

          <LabelledArea
            label="Caption (Khmer)"
            khmer
            value={values.captionKm}
            onChange={(value) => update("captionKm", value)}
          />
        </section>

        <Divider />

        {/* ── Alt text ──────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <h3 className="text-small font-semibold">Alt text</h3>

          <Notice tone="info" icon="info">
            <p>
              Describe what is in the photograph, for someone who cannot see it —
              not the file, and not the role title. Leave blank only if the image
              is decorative and the caption already conveys everything.
            </p>
          </Notice>

          <LabelledArea
            label="Alt text (English)"
            description="Required before this photograph can be public."
            placeholder="Ron Raksmey presenting a primary mathematics activity beside a classroom whiteboard."
            value={values.altTextEn}
            onChange={(value) => update("altTextEn", value)}
          />

          <LabelledArea
            label="Alt text (Khmer)"
            khmer
            value={values.altTextKm}
            onChange={(value) => update("altTextKm", value)}
          />

          {!values.altTextEn.trim() && photo.assetAltTextEn ? (
            <p className="text-[0.75rem] text-foreground-subtle">
              Falling back to the media library’s own alt text:{" "}
              <span className="text-foreground-muted">“{photo.assetAltTextEn}”</span>
            </p>
          ) : null}
        </section>

        <Divider />

        {/* ── Context ───────────────────────────────────────────────────── */}
        <section className="grid gap-4 sm:grid-cols-2">
          <LabelledInput
            label="Photo date"
            type="date"
            value={values.photoDate}
            onChange={(value) => update("photoDate", value)}
          />
          <LabelledInput
            label="Credit"
            description="Who took the photograph, if it was not you."
            value={values.credit}
            onChange={(value) => update("credit", value)}
          />
          <LabelledInput
            label="Location (English)"
            description="Name a school, never a private address."
            value={values.locationEn}
            onChange={(value) => update("locationEn", value)}
          />
          <LabelledInput
            label="Location (Khmer)"
            khmer
            value={values.locationKm}
            onChange={(value) => update("locationKm", value)}
          />
          <LabelledInput
            label="Focal point X (0–1)"
            description="Optional. Keeps the subject in frame when cropped. 0 is the left edge."
            value={values.focalX}
            onChange={(value) => update("focalX", value)}
          />
          <LabelledInput
            label="Focal point Y (0–1)"
            description="0 is the top edge. Leave both blank to centre."
            value={values.focalY}
            onChange={(value) => update("focalY", value)}
          />
        </section>

        <Divider />

        {/* ── Privacy review ────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-small font-semibold">Privacy and consent</h3>
            <p className="text-[0.8125rem] text-foreground-muted">
              A classroom photograph is a decision about other people. Work through
              every item before approving it.
            </p>
          </div>

          {!canReview ? (
            <Notice tone="warning" icon="lock" title="Owner decision">
              <p>
                Only the site owner can approve a photograph, record consent, or make
                one public. You can still add captions, alt text and context above.
              </p>
            </Notice>
          ) : (
            <>
              {photo.reviewedAt ? (
                <Notice tone="success" icon="checkCircle">
                  <p>
                    A privacy review was recorded on{" "}
                    <time dateTime={photo.reviewedAt}>
                      {new Date(photo.reviewedAt).toLocaleString("en-GB")}
                    </time>
                    . Un-tick any item below to revoke it.
                  </p>
                </Notice>
              ) : null}

              <fieldset className="flex flex-col gap-3 border-0 p-0">
                <legend className="text-small font-medium">
                  Confirm, for this photograph:
                </legend>

                <ul className="flex flex-col gap-2.5">
                  {EXPERIENCE_PHOTO_CHECKLIST.map((item) => {
                    const isTicked = ticked.has(item.id);

                    return (
                      <li key={item.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-(--radius-md) border p-3 transition-colors",
                            isTicked
                              ? "border-success/40 bg-success-subtle/40"
                              : "border-border hover:bg-surface-muted",
                          )}
                        >
                          <input
                            id={`photo-check-${item.id}`}
                            type="checkbox"
                            checked={isTicked}
                            onChange={(event) => toggle(item.id, event.target.checked)}
                            className="mt-0.5 size-5 shrink-0 rounded-(--radius-xs) border border-border-strong accent-(--primary)"
                          />
                          <span className="flex flex-col gap-0.5">
                            <span className="text-small font-medium">{item.label}</span>
                            <span className="text-[0.8125rem] text-foreground-muted">
                              {item.detail}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>

              <div
                className={cn(
                  "flex flex-col gap-4 rounded-(--radius-md) border p-4",
                  allTicked
                    ? "border-border"
                    : "border-dashed border-border-strong opacity-70",
                )}
              >
                <LabelledSelect
                  label="Privacy review"
                  description={
                    allTicked
                      ? undefined
                      : `Tick all ${EXPERIENCE_PHOTO_CHECKLIST.length} items above first — ${remaining} remaining.`
                  }
                  value={values.privacyStatus}
                  disabled={!allTicked}
                  options={privacyStatuses.map((status) => ({
                    value: status,
                    label: PRIVACY_LABELS[status],
                  }))}
                  onChange={(value) => update("privacyStatus", value as PrivacyStatus)}
                />

                <LabelledSelect
                  label="Consent"
                  description="Records only that you asserted this. It is not evidence of legal consent, and this CMS does not claim it is."
                  value={values.consentStatus}
                  options={consentStatuses.map((status) => ({
                    value: status,
                    label: CONSENT_LABELS[status],
                  }))}
                  onChange={(value) => update("consentStatus", value as ConsentStatus)}
                />
              </div>

              <LabelledArea
                label="Review note"
                description="What did you check, and what did you deliberately leave visible? Useful when you revisit this in a year."
                value={values.reviewNote}
                onChange={(value) => update("reviewNote", value)}
              />
            </>
          )}
        </section>

        <Divider />

        {/* ── Publication ───────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h3 className="text-small font-semibold">Where this photograph appears</h3>

          <LabelledSelect
            label="Visibility"
            value={values.visibility}
            disabled={!canReview}
            options={mediaVisibilities.map((visibility) => ({
              value: visibility,
              label: VISIBILITY_LABELS[visibility],
              // The public option is unselectable until the review is done. The
              // schema and the database both refuse it too — this only stops the
              // admin from choosing something that will be rejected.
              disabled: visibility === "public" && !canGoPublic,
            }))}
            onChange={(value) => update("visibility", value as MediaVisibility)}
          />

          {!canGoPublic ? (
            <Notice tone="warning" icon="shield" title="Not publishable yet">
              <ul className="ml-4 list-disc">
                {values.privacyStatus !== "approved" ? (
                  <li>The privacy review has not been approved.</li>
                ) : null}
                {values.consentStatus !== "confirmed" &&
                values.consentStatus !== "not_required" ? (
                  <li>Consent is not confirmed, and is not marked as not required.</li>
                ) : null}
                {effectiveAltEn === "" ? <li>English alt text is missing.</li> : null}
              </ul>
            </Notice>
          ) : null}

          <Checkbox
            id="photo-is-cover"
            label="Use as the cover image for this experience"
            description="The cover is the large photograph shown beside the entry. There is one per experience."
            checked={values.role === "cover"}
            onChange={(event) =>
              update("role", event.target.checked ? "cover" : "gallery")
            }
          />
        </section>
      </div>
    </Dialog>
  );
}

// ── Small labelled controls ─────────────────────────────────────────────────

function LabelledInput({
  label,
  description,
  value,
  onChange,
  type = "text",
  khmer,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  khmer?: boolean;
}) {
  const id = useId();

  return (
    <Field id={id} label={label} description={description}>
      {({ describedBy }) => (
        <TextInput
          id={id}
          type={type}
          lang={khmer ? "km" : undefined}
          value={value}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

function LabelledArea({
  label,
  description,
  placeholder,
  value,
  onChange,
  khmer,
}: {
  label: string;
  description?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  khmer?: boolean;
}) {
  const id = useId();

  return (
    <Field id={id} label={label} description={description}>
      {({ describedBy }) => (
        <TextArea
          id={id}
          rows={2}
          lang={khmer ? "km" : undefined}
          value={value}
          placeholder={placeholder}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

function LabelledSelect({
  label,
  description,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();

  return (
    <Field id={id} label={label} description={description}>
      {({ describedBy }) => (
        <Select
          id={id}
          value={value}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
