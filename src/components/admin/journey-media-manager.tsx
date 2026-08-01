"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Badge, Card, CardBody, Divider } from "@/components/ui/primitives";
import { EmptyState, Notice } from "@/components/ui/states";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import {
  attachJourneyPhoto,
  attachJourneyVideo,
  removeJourneyMedia,
  reorderJourneyMedia,
  setJourneyCover,
  updateJourneyMedia,
} from "@/lib/actions/journey-media";
import type { AdminJourneyMedia } from "@/lib/data/admin-journey";
import type { MediaPickerOption } from "@/lib/data/admin-experience-media";
import {
  consentStatuses,
  JOURNEY_MEDIA_CHECKLIST,
  journeyErrorLabels,
  mediaVisibilities,
  parseVideoUrl,
  privacyStatuses,
  type ConsentStatus,
  type MediaVisibility,
  type PrivacyStatus,
} from "@/lib/validation/journey";
import type { ActionResult } from "@/lib/actions/result";
import { cn } from "@/lib/utils/cn";

/**
 * Journey media management — photographs and video references.
 *
 * The ordering of the interface is the argument it makes: attach, then describe,
 * then review, then publish. Publication is the last control on the panel and is
 * disabled until the ones above it are satisfied, so the sequence cannot be
 * short-circuited by scrolling past the parts that matter.
 *
 * Nothing here is the security boundary. Every action re-checks the caller's
 * permission server-side and the database re-checks the publication invariant;
 * hiding a control only saves someone a refused request.
 *
 * ── Video ──────────────────────────────────────────────────────────────────
 * A video is a URL plus a poster drawn from the same media library. The poster
 * picker is the ordinary picker — a poster frame is a normal image asset, and
 * inventing a second upload path for it would be the duplicate media library the
 * brief forbids.
 */

/**
 * Admin thumbnail.
 *
 * A plain `<img>`, not `next/image`. These are 200px derivatives rendered behind
 * authentication on a `force-dynamic` page: the optimiser would add a transform
 * per image for no visual gain, and it cannot cache the result on an
 * authenticated route anyway. One component so the lint exemption is stated once
 * with its reason rather than sprinkled at every call site.
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
  public: "Public — shown on the journey story",
};

export function JourneyMediaManager({
  journeyEntryId,
  entryIsPublished,
  media,
  library,
  canReview,
}: {
  journeyEntryId: string;
  entryIsPublished: boolean;
  media: AdminJourneyMedia[];
  library: MediaPickerOption[];
  canReview: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [pickerMode, setPickerMode] = useState<
    { kind: "attach" } | { kind: "poster"; attachmentId: string } | null
  >(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminJourneyMedia | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<AdminJourneyMedia | null>(null);

  // Local order, so reordering feels immediate rather than waiting on a round
  // trip. Cleared on every successful mutation so the server stays authoritative.
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const ordered = useMemo(() => {
    if (!order) return media;
    const byId = new Map(media.map((item) => [item.id, item]));
    const sorted = order
      .map((id) => byId.get(id))
      .filter((item): item is AdminJourneyMedia => Boolean(item));
    // Anything added since the local order was captured still has to appear.
    const missing = media.filter((item) => !order.includes(item.id));
    return [...sorted, ...missing];
  }, [order, media]);

  const attachedIds = useMemo(
    () =>
      new Set(
        media
          .filter((item) => item.kind === "photo")
          .map((item) => item.mediaId)
          .filter((id): id is string => id !== null),
      ),
    [media],
  );

  const photoCount = media.filter((item) => item.kind === "photo").length;
  const videoCount = media.filter((item) => item.kind === "video").length;
  const liveCount = media.filter((item) => item.isLive).length;
  const pendingCount = media.filter(
    (item) => item.privacyStatus === "pending_review",
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
                .map((code) => journeyErrorLabels[code] ?? code)
                .join(" ")
            : "Please try again."),
        // `0` keeps the toast up until dismissed — a refused privacy change is
        // not something to notice out of the corner of an eye.
        duration: 0,
      });
    });
  }

  function commitOrder(next: AdminJourneyMedia[]) {
    const ids = next.map((item) => item.id);
    setOrder(ids);
    run("Order saved", () => reorderJourneyMedia(journeyEntryId, ids));
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
      {media.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {photoCount > 0 ? (
            <Badge tone="neutral" icon="image">
              {photoCount} {photoCount === 1 ? "photo" : "photos"}
            </Badge>
          ) : null}

          {videoCount > 0 ? (
            <Badge tone="neutral" icon="file">
              {videoCount} {videoCount === 1 ? "video" : "videos"}
            </Badge>
          ) : null}

          <Badge tone={liveCount > 0 ? "success" : "neutral"} icon="globe">
            {liveCount} public
          </Badge>

          {pendingCount > 0 ? (
            <Badge tone="warning" icon="shield">
              {pendingCount} awaiting privacy review
            </Badge>
          ) : null}

          {!media.some((item) => item.role === "cover") ? (
            <Badge tone="warning" icon="alertCircle">
              No cover set
            </Badge>
          ) : null}
        </div>
      ) : null}

      {!entryIsPublished && liveCount > 0 ? (
        <Notice tone="info" icon="eyeOff" title="Nothing is public yet">
          <p>
            {liveCount === 1 ? "One item is" : `${liveCount} items are`} marked public,
            but this story is not published, so nothing is visible on the site. Publish
            the story to show them.
          </p>
        </Notice>
      ) : null}

      {/* ── Add ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <Button iconStart="image" onClick={() => setPickerMode({ kind: "attach" })}>
          Add photographs
        </Button>
        <Button variant="secondary" iconStart="file" onClick={() => setVideoDialogOpen(true)}>
          Add a video
        </Button>
      </div>

      {/* ── The list ────────────────────────────────────────────────────── */}
      {media.length === 0 ? (
        <EmptyState
          icon="image"
          title="No photographs or video yet"
          description="Add the images that show what this story looked like. Everything starts private and pending privacy review — nothing becomes public until you review it and approve it here."
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {ordered.map((item, index) => (
            <li
              key={item.id}
              draggable={!isPending}
              onDragStart={() => setDragId(item.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (!dragId || dragId === item.id) return;
                const next = [...ordered];
                const from = next.findIndex((entry) => entry.id === dragId);
                const to = next.findIndex((entry) => entry.id === item.id);
                if (from < 0 || to < 0) return;
                const [moved] = next.splice(from, 1);
                if (!moved) return;
                next.splice(to, 0, moved);
                setDragId(null);
                commitOrder(next);
              }}
              className={cn(dragId === item.id && "opacity-50")}
            >
              <MediaRow
                item={item}
                index={index}
                total={ordered.length}
                isPending={isPending}
                onEdit={() => setEditing(item)}
                onMakeCover={() => run("Cover changed", () => setJourneyCover(item.id))}
                onChoosePoster={() =>
                  setPickerMode({ kind: "poster", attachmentId: item.id })
                }
                onMoveUp={() => move(index, -1)}
                onMoveDown={() => move(index, 1)}
                onRemove={() => setConfirmRemove(item)}
              />
            </li>
          ))}
        </ol>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}
      <MediaPickerDialog
        open={pickerMode !== null}
        title={
          pickerMode?.kind === "poster"
            ? "Choose a poster frame"
            : "Choose from the media library"
        }
        onClose={() => setPickerMode(null)}
        library={library}
        // When picking a poster, already-attached photographs are still valid
        // choices — a still from the story can legitimately front its own video.
        attachedIds={pickerMode?.kind === "poster" ? new Set() : attachedIds}
        isPending={isPending}
        onChoose={(mediaId) => {
          const mode = pickerMode;
          setPickerMode(null);
          if (!mode) return;

          if (mode.kind === "poster") {
            const target = media.find((item) => item.id === mode.attachmentId);
            if (!target) return;
            run("Poster set", () =>
              updateJourneyMedia(mode.attachmentId, {
                ...toEditorValues(target),
                mediaId,
              }),
            );
            return;
          }

          run("Photograph attached", () => attachJourneyPhoto(journeyEntryId, mediaId));
        }}
      />

      <AddVideoDialog
        open={videoDialogOpen}
        isPending={isPending}
        onClose={() => setVideoDialogOpen(false)}
        onAdd={(url) => {
          setVideoDialogOpen(false);
          run("Video added", () => attachJourneyVideo(journeyEntryId, url));
        }}
      />

      <MediaEditorDialog
        item={editing}
        canReview={canReview}
        onClose={() => setEditing(null)}
        onSave={(values) => {
          const target = editing;
          if (!target) return;
          setEditing(null);
          run("Saved", () => updateJourneyMedia(target.id, values));
        }}
      />

      <ConfirmDialog
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        onConfirm={async () => {
          const target = confirmRemove;
          if (!target) return;
          setConfirmRemove(null);
          run("Removed", () => removeJourneyMedia(target.id));
        }}
        title="Remove this from the story?"
        description="This detaches it from this story only. The image itself stays in the media library and any other content using it is unaffected."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        closeLabel="Close"
      />
    </div>
  );
}

// ── One row ─────────────────────────────────────────────────────────────────

function MediaRow({
  item,
  index,
  total,
  isPending,
  onEdit,
  onMakeCover,
  onChoosePoster,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  item: AdminJourneyMedia;
  index: number;
  total: number;
  isPending: boolean;
  onEdit: () => void;
  onMakeCover: () => void;
  onChoosePoster: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const label = item.kind === "video" ? item.videoTitleEn ?? "Video" : item.filename ?? "Image";

  return (
    <Card className={cn(item.role === "cover" && "border-primary/50")}>
      <CardBody className="flex flex-wrap items-start gap-4 p-4">
        {item.thumbnailSrc ? (
          <div className="relative">
            <AdminThumbnail src={item.thumbnailSrc} size={96} className="size-24" />
            {item.kind === "video" ? (
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center rounded-(--radius-md) bg-black/35 text-white"
              >
                <Icon name="chevronRight" size={22} />
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-(--radius-md) border border-dashed border-border-strong text-center text-foreground-subtle">
            <Icon name={item.kind === "video" ? "file" : "alertTriangle"} size={20} />
            {item.kind === "video" ? (
              <span className="text-[0.625rem] leading-tight">No poster</span>
            ) : null}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {item.role === "cover" ? (
              <Badge tone="accent" icon="star">
                Cover
              </Badge>
            ) : null}

            {item.kind === "video" ? (
              <Badge tone="info" icon="file">
                Video{item.videoProvider ? ` · ${item.videoProvider}` : ""}
              </Badge>
            ) : null}

            <Badge
              tone={item.isLive ? "success" : "neutral"}
              icon={item.isLive ? "globe" : "lock"}
            >
              {item.isLive ? "Public" : VISIBILITY_LABELS[item.visibility].split(" —")[0]}
            </Badge>

            <Badge
              tone={
                item.privacyStatus === "approved"
                  ? "success"
                  : item.privacyStatus === "rejected"
                    ? "danger"
                    : "warning"
              }
              icon="shield"
            >
              {PRIVACY_LABELS[item.privacyStatus]}
            </Badge>

            {item.consentStatus !== "not_required" ? (
              <Badge
                tone={
                  item.consentStatus === "confirmed"
                    ? "success"
                    : item.consentStatus === "denied"
                      ? "danger"
                      : "warning"
                }
                icon="users"
              >
                Consent: {item.consentStatus.replace("_", " ")}
              </Badge>
            ) : null}
          </div>

          <p className="text-small font-medium">
            {item.kind === "video"
              ? (item.videoTitleEn ?? (
                  <span className="text-foreground-subtle">No English video title</span>
                ))
              : (item.captionEn ?? (
                  <span className="text-foreground-subtle">No English caption</span>
                ))}
          </p>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-foreground-subtle">
            {item.filename ? (
              <code className="max-w-[24ch] truncate">{item.filename}</code>
            ) : null}
            {item.captionKm ? null : <span>Khmer caption missing</span>}
            {(item.altTextEn ?? item.assetAltTextEn) ? null : (
              <span className="text-warning-foreground">Alt text missing</span>
            )}
            {item.photoDate ? <span>{item.photoDate}</span> : null}
          </p>

          {item.isPrivateAsset ? (
            <Notice tone="danger" icon="lock">
              <p>
                The underlying file is stored privately and has no public URL, so this
                can never render. Detach it and use a public copy instead.
              </p>
            </Notice>
          ) : null}

          {/*
            An unrecognised video host is worth calling out here rather than
            leaving to be discovered on the public page. It is not an error — the
            story still renders a link — but the owner should know the poster will
            not open a player in place.
          */}
          {item.kind === "video" && item.videoUrl && !item.videoIsEmbeddable ? (
            <Notice tone="warning" icon="alertTriangle">
              <p>
                This URL is not a recognised YouTube or Vimeo video, so the story will
                link out to it rather than playing it in place. Unlisted Vimeo links
                with a private hash are treated this way deliberately.
              </p>
            </Notice>
          ) : null}

          {item.blockers.length > 0 && item.visibility !== "public" ? (
            <p className="text-[0.75rem] text-foreground-muted">
              Before this can be published:{" "}
              {item.blockers.map((code) => journeyErrorLabels[code] ?? code).join(" ")}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex gap-1">
            <IconButton
              icon="chevronUp"
              label={`Move ${label} earlier`}
              size="sm"
              variant="ghost"
              disabled={isPending || index === 0}
              onClick={onMoveUp}
            />
            <IconButton
              icon="chevronDown"
              label={`Move ${label} later`}
              size="sm"
              variant="ghost"
              disabled={isPending || index === total - 1}
              onClick={onMoveDown}
            />
          </div>

          <div className="flex gap-1">
            {item.kind === "video" ? (
              <IconButton
                icon="image"
                label={`Choose a poster frame for ${label}`}
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={onChoosePoster}
              />
            ) : null}

            {item.role !== "cover" ? (
              <IconButton
                icon="star"
                label={`Make ${label} the cover`}
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={onMakeCover}
              />
            ) : null}

            <IconButton
              icon="edit"
              label={`Edit ${label}`}
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={onEdit}
            />

            <IconButton
              icon="trash"
              label={`Remove ${label} from this story`}
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={onRemove}
            />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ── Media picker ────────────────────────────────────────────────────────────

function MediaPickerDialog({
  open,
  title,
  onClose,
  library,
  attachedIds,
  isPending,
  onChoose,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  library: MediaPickerOption[];
  attachedIds: Set<string>;
  isPending: boolean;
  onChoose: (mediaId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const searchId = useId();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return library;
    return library.filter((option) =>
      [option.filename, option.altTextEn, option.captionEn, option.kind]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [library, query]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description="Only public images appear here. A privately stored file has no public URL and could never be rendered on the site."
      size="lg"
      closeLabel="Close"
    >
      <div className="flex flex-col gap-4">
        <Field id={searchId} label="Search the library">
          {({ describedBy }) => (
            <TextInput
              id={searchId}
              type="search"
              value={query}
              aria-describedby={describedBy}
              placeholder="Filename, caption or alt text"
              onChange={(event) => setQuery(event.target.value)}
            />
          )}
        </Field>

        {filtered.length === 0 ? (
          <EmptyState
            icon="image"
            title="Nothing matches"
            description="Upload images in the media library first, choosing the “Journey photo” kind."
          />
        ) : (
          <ul className="grid max-h-[26rem] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3">
            {filtered.map((option) => {
              const already = attachedIds.has(option.id);

              return (
                <li key={option.id}>
                  <button
                    type="button"
                    disabled={isPending || already}
                    onClick={() => onChoose(option.id)}
                    className={cn(
                      "flex w-full flex-col gap-1.5 rounded-(--radius-md) border p-2 text-left transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
                      already
                        ? "cursor-not-allowed border-border opacity-50"
                        : "border-border hover:border-border-interactive hover:bg-surface-muted",
                    )}
                  >
                    {option.thumbnailSrc ? (
                      <AdminThumbnail
                        src={option.thumbnailSrc}
                        size={200}
                        className="aspect-[4/3] w-full"
                      />
                    ) : (
                      <span className="flex aspect-[4/3] w-full items-center justify-center rounded-(--radius-sm) border border-dashed border-border-strong">
                        <Icon name="image" size={20} />
                      </span>
                    )}

                    <span className="truncate text-[0.75rem] font-medium">
                      {option.filename}
                    </span>

                    {/*
                      The usage hint. Reusing one file across two stories is
                      correct and encouraged — this exists so the owner knows the
                      caption they are about to write is contextual to this story
                      and will not overwrite the other one's.
                    */}
                    {option.usedBy.length > 0 ? (
                      <span className="truncate text-[0.6875rem] text-foreground-subtle">
                        Used by: {option.usedBy.join(", ")}
                      </span>
                    ) : null}

                    {already ? (
                      <span className="text-[0.6875rem] text-foreground-subtle">
                        Already attached
                      </span>
                    ) : null}
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

// ── Add video ───────────────────────────────────────────────────────────────

function AddVideoDialog({
  open,
  isPending,
  onClose,
  onAdd,
}: {
  open: boolean;
  isPending: boolean;
  onClose: () => void;
  onAdd: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const id = useId();

  // Parsed live, so the owner sees whether the URL will play in place *before*
  // committing it rather than discovering it on the public page.
  const parsed = parseVideoUrl(url.trim() || null);
  const valid = /^https:\/\//i.test(url.trim());

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a video"
      description="This CMS references video, it does not host it. Upload the video to YouTube or Vimeo, then paste its address here."
      size="md"
      closeLabel="Close"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || isPending}
            onClick={() => {
              onAdd(url.trim());
              setUrl("");
            }}
          >
            Add video
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          id={id}
          label="Video address"
          description="Must start with https://. YouTube and Vimeo play in place; anything else becomes a link."
        >
          {({ describedBy }) => (
            <TextInput
              id={id}
              type="url"
              inputMode="url"
              value={url}
              placeholder="https://www.youtube.com/watch?v=…"
              aria-describedby={describedBy}
              onChange={(event) => setUrl(event.target.value)}
            />
          )}
        </Field>

        {url.trim() ? (
          <Notice
            tone={parsed.embedUrl ? "success" : "warning"}
            icon={parsed.embedUrl ? "checkCircle" : "alertTriangle"}
          >
            <p>
              {parsed.embedUrl
                ? `Recognised as ${parsed.provider}. It will play in place, behind a poster image, and nothing loads from ${parsed.provider} until a visitor presses Play.`
                : "Not recognised as a YouTube or Vimeo video. The story will show the poster with a link out rather than an in-place player."}
            </p>
          </Notice>
        ) : null}

        <Notice tone="info" icon="shield" title="This starts private">
          <p>
            The video is added pending privacy review, with no poster yet. Watch the
            whole thing with the sound on before approving it — a safe opening frame
            says nothing about minute four, and audio carries things a still never
            would.
          </p>
        </Notice>
      </div>
    </Dialog>
  );
}

// ── Editor ──────────────────────────────────────────────────────────────────

type EditorValues = {
  kind: "photo" | "video";
  role: "cover" | "gallery";
  sortOrder: number;
  mediaId: string | null;
  videoUrl: string | null;
  durationSeconds: string;
  videoTitleEn: string;
  videoTitleKm: string;
  transcriptEn: string;
  transcriptKm: string;
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

function toEditorValues(item: AdminJourneyMedia): EditorValues {
  return {
    kind: item.kind,
    role: item.role,
    sortOrder: item.sortOrder,
    mediaId: item.mediaId,
    videoUrl: item.videoUrl,
    durationSeconds: item.durationSeconds?.toString() ?? "",
    videoTitleEn: item.videoTitleEn ?? "",
    videoTitleKm: item.videoTitleKm ?? "",
    transcriptEn: item.transcriptEn ?? "",
    transcriptKm: item.transcriptKm ?? "",
    captionEn: item.captionEn ?? "",
    captionKm: item.captionKm ?? "",
    altTextEn: item.altTextEn ?? "",
    altTextKm: item.altTextKm ?? "",
    photoDate: item.photoDate ?? "",
    locationEn: item.locationEn ?? "",
    locationKm: item.locationKm ?? "",
    credit: item.credit ?? "",
    privacyStatus: item.privacyStatus,
    consentStatus: item.consentStatus,
    visibility: item.visibility,
    focalX: item.focalX?.toString() ?? "",
    focalY: item.focalY?.toString() ?? "",
    reviewNote: item.reviewNote ?? "",
  };
}

function MediaEditorDialog({
  item,
  canReview,
  onClose,
  onSave,
}: {
  item: AdminJourneyMedia | null;
  canReview: boolean;
  onClose: () => void;
  onSave: (values: EditorValues) => void;
}) {
  /*
   * `key` on the dialog resets this state when a different attachment is opened.
   * Without it, editing one item and then another would show the first one's
   * unsaved text — the classic uncontrolled-form-in-a-shared-dialog bug.
   */
  if (!item) return null;
  return (
    <MediaEditorForm
      key={item.id}
      item={item}
      canReview={canReview}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function MediaEditorForm({
  item,
  canReview,
  onClose,
  onSave,
}: {
  item: AdminJourneyMedia;
  canReview: boolean;
  onClose: () => void;
  onSave: (values: EditorValues) => void;
}) {
  const [values, setValues] = useState<EditorValues>(() => toEditorValues(item));
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const set = <K extends keyof EditorValues>(key: K, value: EditorValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const isVideo = item.kind === "video";

  const checklist = JOURNEY_MEDIA_CHECKLIST.filter(
    (entry) => !entry.videoOnly || isVideo,
  );

  const allChecked = checklist.every((entry) => checked.has(entry.id));

  /*
   * Whether "Approved" may be selected.
   *
   * The checklist is a *gate on the control*, not a stored record — which boxes
   * were ticked is deliberately never persisted, because storing them would imply
   * a legal record of consent that a CMS cannot substantiate. Re-opening an
   * already-approved item therefore starts with the boxes clear and the existing
   * approval intact; only *changing* the decision requires reading them again.
   */
  const canApprove = allChecked || item.privacyStatus === "approved";

  const blocksPublic =
    values.privacyStatus !== "approved" ||
    values.consentStatus === "pending" ||
    values.consentStatus === "denied" ||
    !values.altTextEn.trim() ||
    (isVideo && !values.mediaId) ||
    (isVideo && !values.videoTitleEn.trim());

  return (
    <Dialog
      open
      onClose={onClose}
      title={isVideo ? "Edit video" : "Edit photograph"}
      description={
        isVideo
          ? "Describe the video, choose its poster, and record the privacy review."
          : "Describe the photograph in both languages, then record the privacy review."
      }
      size="lg"
      closeLabel="Close"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(values)}>Save</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* ── Video fields ──────────────────────────────────────────────── */}
        {isVideo ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <LabelledInput
                label="Video title (English)"
                description="Required before it can be public — it becomes the Play button's accessible name."
                value={values.videoTitleEn}
                onChange={(value) => set("videoTitleEn", value)}
              />
              <LabelledInput
                label="Video title (Khmer)"
                value={values.videoTitleKm}
                onChange={(value) => set("videoTitleKm", value)}
                khmer
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <LabelledInput
                label="Video address"
                description="https:// only."
                value={values.videoUrl ?? ""}
                onChange={(value) => set("videoUrl", value)}
              />
              <LabelledInput
                label="Length in seconds"
                description="Optional. Shown on the poster and used for structured data."
                type="number"
                value={values.durationSeconds}
                onChange={(value) => set("durationSeconds", value)}
              />
            </div>

            {!values.mediaId ? (
              <Notice tone="warning" icon="image" title="No poster frame yet">
                <p>
                  Close this and use the poster button on the row to choose one. Without
                  a poster the video cannot be made public — the page would have to load
                  the third-party player before anyone asked for it.
                </p>
              </Notice>
            ) : null}

            <LabelledArea
              label="Transcript or written summary (English)"
              description="Strongly recommended, and the thing that makes an educational video usable without playing it. Shown behind a “Read the transcript” control."
              value={values.transcriptEn}
              onChange={(value) => set("transcriptEn", value)}
            />
            <LabelledArea
              label="Transcript or written summary (Khmer)"
              value={values.transcriptKm}
              onChange={(value) => set("transcriptKm", value)}
              khmer
            />

            <Divider />
          </>
        ) : null}

        {/* ── Description ───────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <LabelledArea
            label="Caption (English)"
            description="What is happening, and why it mattered. Do not name other people."
            placeholder="Preparing and testing PLP learning activities during fieldwork at Kakoh Primary School."
            value={values.captionEn}
            onChange={(value) => set("captionEn", value)}
          />
          <LabelledArea
            label="Caption (Khmer)"
            value={values.captionKm}
            onChange={(value) => set("captionKm", value)}
            khmer
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <LabelledArea
            label="Alt text (English)"
            description={
              isVideo
                ? "Describes the poster image. Required before this goes public."
                : "Describes the image for someone who cannot see it. Required before this goes public. Do not write “photo” or a filename."
            }
            placeholder="A group of students and an educator holding awards at an academic event."
            value={values.altTextEn}
            onChange={(value) => set("altTextEn", value)}
          />
          <LabelledArea
            label="Alt text (Khmer)"
            value={values.altTextKm}
            onChange={(value) => set("altTextKm", value)}
            khmer
          />
        </div>

        {item.assetAltTextEn && !values.altTextEn ? (
          <p className="text-[0.75rem] text-foreground-subtle">
            Leaving this empty falls back to the media library&rsquo;s own alt text:
            &ldquo;{item.assetAltTextEn}&rdquo;
          </p>
        ) : null}

        <Divider />

        {/* ── Context ───────────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-3">
          <LabelledInput
            label="Date taken"
            description="Optional."
            type="date"
            value={values.photoDate}
            onChange={(value) => set("photoDate", value)}
          />
          <LabelledInput
            label="Location (English)"
            value={values.locationEn}
            onChange={(value) => set("locationEn", value)}
          />
          <LabelledInput
            label="Location (Khmer)"
            value={values.locationKm}
            onChange={(value) => set("locationKm", value)}
            khmer
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <LabelledInput
            label="Credit"
            description="Who took it, if not you."
            value={values.credit}
            onChange={(value) => set("credit", value)}
          />
          <LabelledInput
            label="Focal point X"
            description="0–1. Optional; controls cropping."
            value={values.focalX}
            onChange={(value) => set("focalX", value)}
          />
          <LabelledInput
            label="Focal point Y"
            description="0–1."
            value={values.focalY}
            onChange={(value) => set("focalY", value)}
          />
        </div>

        <Divider />

        {/* ── Privacy review ────────────────────────────────────────────── */}
        {canReview ? (
          <>
            <div className="flex flex-col gap-3">
              <h3 className="text-small font-semibold">Privacy review</h3>
              <p className="text-[0.8125rem] text-foreground-muted">
                Read every statement against this specific {isVideo ? "video" : "photograph"}.
                Which boxes you tick is not stored — only that you reviewed it, when, and
                any note you leave.
              </p>

              <ul className="flex flex-col gap-2">
                {checklist.map((entry) => (
                  <li key={entry.id}>
                    <ChecklistItem
                      checked={checked.has(entry.id)}
                      label={entry.label}
                      description={entry.detail}
                      onChange={(next) =>
                        setChecked((current) => {
                          const updated = new Set(current);
                          if (next) updated.add(entry.id);
                          else updated.delete(entry.id);
                          return updated;
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <LabelledSelect
                label="Privacy decision"
                value={values.privacyStatus}
                options={privacyStatuses.map((status) => ({
                  value: status,
                  label: PRIVACY_LABELS[status],
                  // "Approved" stays unselectable until the checklist has been
                  // read. Everything else is always available, including
                  // rejection, which must never be gated behind a checklist.
                  disabled: status === "approved" && !canApprove,
                }))}
                onChange={(value) => set("privacyStatus", value as PrivacyStatus)}
              />

              <LabelledSelect
                label="Consent"
                value={values.consentStatus}
                options={consentStatuses.map((status) => ({
                  value: status,
                  label: CONSENT_LABELS[status],
                }))}
                onChange={(value) => set("consentStatus", value as ConsentStatus)}
              />

              <LabelledSelect
                label="Visibility"
                description={
                  blocksPublic ? "Public is unavailable until the checks above pass." : undefined
                }
                value={values.visibility}
                options={mediaVisibilities.map((visibility) => ({
                  value: visibility,
                  label: VISIBILITY_LABELS[visibility],
                  disabled: visibility === "public" && blocksPublic,
                }))}
                onChange={(value) => set("visibility", value as MediaVisibility)}
              />
            </div>

            <LabelledArea
              label="Review note"
              description="What you checked, or what is still outstanding. Kept private."
              value={values.reviewNote}
              onChange={(value) => set("reviewNote", value)}
            />
          </>
        ) : (
          <Notice tone="info" icon="lock" title="Privacy review is owner-only">
            <p>
              You can describe and caption this, but the decision to publish an image of
              other people belongs to the site owner. The server refuses the change
              regardless of what this form shows.
            </p>
          </Notice>
        )}
      </div>
    </Dialog>
  );
}

// ── Small labelled controls ─────────────────────────────────────────────────

/**
 * One privacy-checklist statement.
 *
 * `Checkbox` takes a required `id` and a native change event; this supplies the
 * id from `useId()` and hands the caller a boolean.
 */
function ChecklistItem({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description?: string;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();

  return (
    <Checkbox
      id={id}
      checked={checked}
      label={label}
      description={description}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

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
          rows={3}
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
