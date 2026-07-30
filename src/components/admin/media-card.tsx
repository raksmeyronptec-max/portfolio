"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/ui/field";
import { Badge, Card } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { deleteMediaAsset, updateMediaMetadata } from "@/lib/actions/media";
import { resolveImage } from "@/lib/content/media";
import { formatBytes } from "@/lib/media/validate";
import type { AdminMediaRow } from "@/lib/data/admin";

/**
 * Media library card.
 *
 * A private asset never renders a thumbnail — `resolveImage` returns null for any
 * private asset, so there is no code path that could put a raw certificate scan in
 * the page. Private items show a lock and their metadata instead.
 */
export function MediaCard({
  asset,
  canEdit,
  canDelete,
}: {
  asset: AdminMediaRow;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [altEn, setAltEn] = useState(asset.alt_text_en ?? "");
  const [altKm, setAltKm] = useState(asset.alt_text_km ?? "");
  const [captionEn, setCaptionEn] = useState(asset.caption_en ?? "");
  const [captionKm, setCaptionKm] = useState(asset.caption_km ?? "");

  const image = resolveImage(asset, "en", "thumbnail");
  const isPdf = asset.mime_type === "application/pdf";
  const missingAlt = asset.visibility === "public" && !isPdf && (!asset.alt_text_en || !asset.alt_text_km);

  function save() {
    startTransition(async () => {
      const result = await updateMediaMetadata(asset.id, {
        alt_text_en: altEn,
        alt_text_km: altKm,
        caption_en: captionEn,
        caption_km: captionKm,
      });

      if (result.ok) {
        toast.show({ tone: "success", title: "Metadata saved" });
        setEditing(false);
        router.refresh();
        return;
      }

      toast.show({
        tone: "error",
        title: "Could not save",
        description:
          result.code === "forbidden"
            ? "Your role does not permit this."
            : result.detail ?? "Please try again.",
      });
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteMediaAsset(asset.id);

      if (result.ok) {
        toast.show({ tone: "success", title: "File deleted" });
        setConfirmDelete(false);
        router.refresh();
        return;
      }

      toast.show({
        tone: result.code === "conflict" ? "warning" : "error",
        title: result.code === "conflict" ? "Still in use" : "Could not delete",
        description: result.detail ?? "Please try again.",
        // A "still in use" message lists the referencing records and must stay
        // readable.
        duration: 0,
      });
      setConfirmDelete(false);
    });
  }

  return (
    <>
      <Card className="flex flex-col overflow-hidden">
        <div className="relative aspect-[4/3] border-b border-border bg-surface-muted">
          {image ? (
            <Image
              src={image.src}
              alt={image.alt || asset.original_filename}
              fill
              sizes="(min-width: 1024px) 25vw, 50vw"
              loading="lazy"
              className="object-contain p-2"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 text-foreground-subtle">
              <Icon name={isPdf ? "fileText" : "lock"} size={26} />
              <span className="px-3 text-center text-[0.75rem]">
                {asset.visibility === "private"
                  ? "Private — no public preview"
                  : isPdf
                    ? "PDF document"
                    : "No preview"}
              </span>
            </div>
          )}

          <span className="absolute left-2 top-2 flex flex-wrap gap-1.5">
            {asset.visibility === "private" ? (
              <Badge tone="warning" icon="lock">
                Private
              </Badge>
            ) : (
              <Badge tone="success" icon="globe">
                Public
              </Badge>
            )}
            {asset.requires_privacy_review ? (
              <Badge tone="danger" icon="shield">
                Review
              </Badge>
            ) : null}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <p
            className="truncate text-small font-medium"
            title={asset.original_filename}
          >
            {asset.original_filename}
          </p>

          <p className="text-[0.75rem] text-foreground-subtle">
            {asset.kind.replace(/_/g, " ")} · {formatBytes(asset.file_size_bytes)}
            {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
          </p>

          {missingAlt ? (
            <p className="flex items-start gap-1.5 text-[0.75rem] text-warning-foreground">
              <Icon name="alertTriangle" size={13} className="mt-0.5" />
              Missing alt text in{" "}
              {!asset.alt_text_en && !asset.alt_text_km
                ? "both languages"
                : !asset.alt_text_en
                  ? "English"
                  : "Khmer"}
            </p>
          ) : null}

          <p className="text-[0.75rem] text-foreground-subtle">
            {asset.usageCount === 0
              ? "Not used anywhere"
              : `Used in ${asset.usageCount} place${asset.usageCount === 1 ? "" : "s"}`}
          </p>

          <div className="mt-auto flex justify-end gap-1 pt-1">
            {canEdit ? (
              <IconButton
                icon="edit"
                label={`Edit metadata for ${asset.original_filename}`}
                size="sm"
                variant="ghost"
                onClick={() => setEditing(true)}
              />
            ) : null}

            {canDelete ? (
              <IconButton
                icon="trash"
                label={`Delete ${asset.original_filename}`}
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => setConfirmDelete(true)}
              />
            ) : null}
          </div>
        </div>
      </Card>

      {/* ── Metadata editor ─────────────────────────────────────────────────── */}
      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title="Media metadata"
        description={asset.original_filename}
        closeLabel="Close"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={isPending} iconStart="check">
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {asset.visibility === "public" && !isPdf ? (
            <Notice tone="info" icon="info">
              <p>
                Alt text describes the image for screen-reader users and for anyone
                whose images fail to load. Describe what it shows, not that it is an
                image.
              </p>
            </Notice>
          ) : null}

          <MetadataField
            label="Alt text (English)"
            value={altEn}
            onChange={setAltEn}
          />
          <MetadataField
            label="Alt text (Khmer)"
            value={altKm}
            onChange={setAltKm}
            lang="km"
          />
          <MetadataField
            label="Caption (English)"
            value={captionEn}
            onChange={setCaptionEn}
          />
          <MetadataField
            label="Caption (Khmer)"
            value={captionKm}
            onChange={setCaptionKm}
            lang="km"
          />
        </div>
      </Dialog>

      {/* ── Delete confirmation ─────────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Delete this file?"
        description="This permanently removes the file and all of its generated sizes from storage. Unlike content, media deletion cannot be undone."
        confirmLabel="Delete permanently"
        cancelLabel="Cancel"
        closeLabel="Close"
      >
        <div className="flex flex-col gap-3">
          <p className="text-small text-foreground-muted">
            {asset.usageCount > 0
              ? "This file appears to be in use. The deletion will be refused and will tell you exactly where it is referenced."
              : "This file is not referenced by any content."}
          </p>
          {asset.visibility === "private" ? (
            <Notice tone="warning" icon="shield">
              <p>
                This is a private original. Deleting it destroys the only stored copy
                of the unredacted document.
              </p>
            </Notice>
          ) : null}
        </div>
      </ConfirmDialog>
    </>
  );
}

function MetadataField({
  label,
  value,
  onChange,
  lang,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  lang?: string;
}) {
  const id = `media-meta-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;

  return (
    <Field id={id} label={label}>
      {({ describedBy }) => (
        <TextInput
          id={id}
          lang={lang}
          value={value}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}
