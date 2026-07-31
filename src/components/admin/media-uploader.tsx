"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  isPrivateKind,
  MEDIA_KIND_LABELS,
  MEDIA_KINDS,
  type MediaKind,
} from "@/lib/media/kinds";
import { formatBytes, MAX_UPLOAD_SIZE_BYTES } from "@/lib/media/validate";

/**
 * Media upload form.
 *
 * Uses a plain `fetch` with `FormData` and `XMLHttpRequest`-free progress via the
 * upload's own state, because Server Actions cap request bodies at 2 MB — well
 * under the 10 MB an upload here is allowed to be.
 *
 * The privacy consequence of the chosen "kind" is stated before the upload happens,
 * not after: selecting "Certificate original" shows that the file will be private
 * and unreachable without a signed link, and selecting a public kind says so just as
 * plainly. Getting this wrong is the one mistake with an irreversible cost.
 */
export function MediaUploader() {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const fileId = useId();
  const kindId = useId();
  const altEnId = useId();
  const altKmId = useId();

  const [kind, setKind] = useState<MediaKind>("project_cover");
  const [file, setFile] = useState<File | null>(null);
  const [altEn, setAltEn] = useState("");
  const [altKm, setAltKm] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const isPrivate = isPrivateKind(kind);
  const isPdfKind = kind === "certificate_original" || kind === "resume_file";
  const maxSizeLabel = formatBytes(MAX_UPLOAD_SIZE_BYTES);
  const needsAltText = !isPrivate && kind !== "resume_file";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      toast.show({ tone: "error", title: "Choose a file first" });
      return;
    }

    setIsUploading(true);

    const body = new FormData();
    body.set("file", file);
    body.set("kind", kind);
    if (altEn) body.set("alt_text_en", altEn);
    if (altKm) body.set("alt_text_km", altKm);

    try {
      const response = await fetch("/api/admin/media/upload", {
        method: "POST",
        body,
      });

      const result = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            message?: string;
            filename?: string;
            processed?: boolean;
            visibility?: string;
          }
        | null;

      if (!response.ok || !result?.ok) {
        toast.show({
          tone: result?.error === "duplicate" ? "warning" : "error",
          title:
            result?.error === "duplicate"
              ? "Already in the library"
              : "Upload failed",
          // The API returns specific, human-readable messages for validation
          // failures — surface them rather than a generic error.
          description: result?.message ?? "Please try again.",
          duration: 0,
        });
        return;
      }

      toast.show({
        tone: "success",
        title: "Uploaded",
        description: [
          result.filename,
          result.visibility === "private" ? "stored privately" : "stored publicly",
          result.processed ? "converted to WebP with derivatives" : "stored as-is",
        ]
          .filter(Boolean)
          .join(" · "),
      });

      setFile(null);
      setAltEn("");
      setAltKm("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      toast.show({
        tone: "error",
        title: "Upload failed",
        description: "The connection dropped. Please try again.",
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-h4 font-semibold">Upload a file</h2>
      </CardHeader>

      <CardBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field
            id={kindId}
            label="What is this file for?"
            description="This decides which bucket it goes in and whether it is ever publicly reachable."
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
            <Notice tone="warning" icon="lock" title="This file will be private">
              <p>
                Stored in a private bucket with no public URL. Anonymous visitors
                cannot see that it exists, and only the site owner can open it —
                through a 60-second signed link, with every access logged.
              </p>
            </Notice>
          ) : (
            <Notice tone="info" icon="globe" title="This file will be public">
              <p>
                Anyone with the URL will be able to view it. For a certificate, make
                sure it is the <strong>redacted</strong> copy.
              </p>
            </Notice>
          )}

          <Field
            id={fileId}
            label="File"
            description={
              isPdfKind
                ? `PDF, JPEG, PNG or WebP. Up to ${maxSizeLabel}.`
                : `JPEG, PNG, WebP or AVIF. Up to ${maxSizeLabel}. Images are re-encoded to WebP, stripped of EXIF metadata, and resized into thumbnail, card and preview versions.`
            }
            required
            requiredLabel="required"
          >
            {({ describedBy }) => (
              <input
                ref={inputRef}
                id={fileId}
                type="file"
                required
                accept={
                  isPdfKind
                    ? "application/pdf,image/jpeg,image/png,image/webp"
                    : "image/jpeg,image/png,image/webp,image/avif"
                }
                aria-describedby={describedBy}
                onChange={(event) => {
                  const chosen = event.target.files?.[0] ?? null;

                  /*
                   * Rejected here as well as on the server, so an oversized file
                   * fails instantly instead of after a long upload that ends in
                   * a 400. The server check is the real one — this is only to
                   * avoid wasting the editor's time and bandwidth.
                   */
                  if (chosen && chosen.size > MAX_UPLOAD_SIZE_BYTES) {
                    toast.show({
                      tone: "error",
                      title: "That file is too large",
                      description: `“${chosen.name}” is ${formatBytes(chosen.size)}. The limit is ${maxSizeLabel} — resize or re-export it and try again.`,
                    });
                    // Cleared so the form cannot be submitted with a file the
                    // server is certain to reject.
                    setFile(null);
                    event.target.value = "";
                    return;
                  }

                  setFile(chosen);
                }}
                className="w-full rounded-(--radius-md) border border-border-strong bg-surface p-2.5 text-small file:mr-3 file:rounded-(--radius-sm) file:border-0 file:bg-primary file:px-3 file:py-2 file:text-small file:font-medium file:text-primary-foreground"
              />
            )}
          </Field>

          {file ? (
            <p className="flex items-center gap-2 text-[0.8125rem] text-foreground-muted">
              <Icon name="file" size={15} />
              {file.name} · {formatBytes(file.size)} · {file.type || "unknown type"}
            </p>
          ) : null}

          {needsAltText ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id={altEnId}
                label="Alt text (English)"
                description="Describe what the image shows. Required for the content-health check to pass."
              >
                {({ describedBy }) => (
                  <TextInput
                    id={altEnId}
                    value={altEn}
                    aria-describedby={describedBy}
                    onChange={(event) => setAltEn(event.target.value)}
                  />
                )}
              </Field>

              <Field id={altKmId} label="Alt text (Khmer)">
                {({ describedBy }) => (
                  <TextInput
                    id={altKmId}
                    lang="km"
                    value={altKm}
                    aria-describedby={describedBy}
                    onChange={(event) => setAltKm(event.target.value)}
                  />
                )}
              </Field>
            </div>
          ) : null}

          <div>
            <Button
              type="submit"
              iconStart="upload"
              loading={isUploading}
              disabled={!file}
            >
              {isUploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
