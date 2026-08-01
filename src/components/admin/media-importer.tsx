"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, Divider } from "@/components/ui/primitives";
import { EmptyState, Notice } from "@/components/ui/states";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { formatBytes } from "@/lib/media/validate";
import { cn } from "@/lib/utils/cn";

/**
 * The bulk import screen.
 *
 * ── The shape of the workflow ──────────────────────────────────────────────
 * Scan → choose → import → review. Nothing is imported by scanning, and nothing
 * is published by importing. Every imported file lands as a private, pending
 * media-library asset; making it public is a separate decision taken per
 * attachment on a journey story, where the privacy checklist lives.
 *
 * ── Why files are opt-in rather than opt-out ───────────────────────────────
 * The default selection is empty. A folder of classroom photographs is exactly
 * the case where "select all, then untick the bad ones" produces an accident, and
 * the whole feature exists precisely because these files need looking at.
 *
 * Duplicates and already-imported files are rendered non-selectable rather than
 * hidden — knowing that eleven files were skipped as duplicates is the useful
 * information; silently showing twenty-nine of forty is not.
 */

type ScannedFile = {
  relativePath: string;
  filename: string;
  folder: string;
  sizeBytes: number;
  extension: string;
  isHeic: boolean;
  checksum: string;
  width: number | null;
  height: number | null;
  capturedOn: string | null;
  suggestedStory: string | null;
  suggestedKind: string;
  suggestedFilename: string;
  duplicateOf: string | null;
  alreadyImported: boolean;
};

type ScanResponse = {
  ok: boolean;
  available?: boolean;
  directory?: string | null;
  files?: ScannedFile[];
  videos?: Array<{ relativePath: string; filename: string; sizeBytes: number }>;
  skipped?: Array<{ filename: string; reason: string }>;
  truncated?: boolean;
  heicSupported?: boolean;
};

type ImportResult = {
  relativePath: string;
  ok: boolean;
  filename?: string;
  error?: string;
};

/** One request per this many files, so a batch reports progress as it goes. */
const BATCH_SIZE = 10;

export function MediaImporter({ initialScan }: { initialScan: ScanResponse }) {
  const toast = useToast();

  /*
   * The first scan is done on the server, so there is no mount-time fetch and
   * the list is present in the first paint. Re-scanning is a button — a real
   * user event rather than an effect.
   */
  const [scan, setScan] = useState<ScanResponse>(initialScan);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<ImportResult[]>([]);

  const runScan = useCallback(async () => {
    setLoading(true);
    setResults([]);
    setSelected(new Set());

    try {
      const response = await fetch("/api/admin/media/import", { cache: "no-store" });

      if (response.status === 404) {
        setScan({ ...initialScan, available: false });
        return;
      }

      const data = (await response.json()) as ScanResponse;
      setScan(data);
    } catch {
      toast.show({
        tone: "error",
        title: "Could not read the folder",
        description: "The development server may have restarted. Try scanning again.",
        duration: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [initialScan, toast]);

  const files = scan.files ?? [];
  const importable = files.filter(
    (file) => !file.duplicateOf && !file.alreadyImported,
  );

  function toggle(relativePath: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(relativePath)) next.delete(relativePath);
      else next.add(relativePath);
      return next;
    });
  }

  function toggleFolder(folder: string) {
    const inFolder = importable.filter((file) => file.folder === folder);
    const allSelected = inFolder.every((file) => selected.has(file.relativePath));

    setSelected((current) => {
      const next = new Set(current);
      for (const file of inFolder) {
        if (allSelected) next.delete(file.relativePath);
        else next.add(file.relativePath);
      }
      return next;
    });
  }

  async function runImport() {
    const chosen = importable.filter((file) => selected.has(file.relativePath));
    if (chosen.length === 0) return;

    setImporting(true);
    setResults([]);
    setProgress({ done: 0, total: chosen.length });

    const collected: ImportResult[] = [];

    /*
     * Batched rather than one request for everything.
     *
     * Image processing is CPU-bound and a forty-file import would otherwise sit
     * behind one request with no feedback for minutes — and would risk the
     * function timeout. Ten at a time keeps each request well inside it and lets
     * the progress line move.
     */
    for (let index = 0; index < chosen.length; index += BATCH_SIZE) {
      const batch = chosen.slice(index, index + BATCH_SIZE);

      try {
        const response = await fetch("/api/admin/media/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: batch.map((file) => ({
              relativePath: file.relativePath,
              filename: file.suggestedFilename,
              kind: file.suggestedKind,
            })),
          }),
        });

        const data = (await response.json()) as { results?: ImportResult[] };
        collected.push(...(data.results ?? []));
      } catch {
        collected.push(
          ...batch.map((file) => ({
            relativePath: file.relativePath,
            ok: false,
            error: "The request failed.",
          })),
        );
      }

      setProgress({ done: Math.min(index + BATCH_SIZE, chosen.length), total: chosen.length });
      setResults([...collected]);
    }

    setImporting(false);
    setProgress(null);

    const succeeded = collected.filter((result) => result.ok).length;

    toast.show({
      tone: succeeded === collected.length ? "success" : "warning",
      title: `Imported ${succeeded} of ${collected.length}`,
      description:
        succeeded > 0
          ? "Every imported file is private and flagged for privacy review. Attach them to a journey story to describe and publish them."
          : "Nothing was imported. See the reasons below.",
      duration: 0,
    });

    // Re-scan so the imported files now show as already imported rather than
    // remaining selectable.
    void runScan();
  }

  // ── Unavailable ───────────────────────────────────────────────────────────
  if (!loading && scan.available === false) {
    return (
      <Notice tone="info" icon="folder" title="Importing is only available in development">
        <p>
          The importer reads a folder on the machine running the server. In production
          the filesystem holds only the deployment bundle, so there is nothing to scan.
        </p>
        <p className="mt-2">
          Run <code>npm run dev</code> locally, put your folders inside{" "}
          <code>imports/portfolio-media/</code> in the project root, and reload this
          page. To use a local production build instead, set{" "}
          <code>MEDIA_IMPORT_DIR</code> to that path. Your files are read and never
          modified.
        </p>
      </Notice>
    );
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-small text-foreground-muted">
        <Icon name="refresh" size={16} className="animate-spin" />
        Scanning the import folder…
      </p>
    );
  }

  const folders = [...new Set(files.map((file) => file.folder))];
  const resultsByPath = new Map(results.map((result) => [result.relativePath, result]));

  return (
    <div className="flex flex-col gap-6">
      {/* ── What happens ────────────────────────────────────────────────── */}
      <Notice tone="info" icon="shield" title="Nothing here becomes public">
        <p>
          Every imported file is re-encoded to WebP with all metadata removed —
          including GPS coordinates — and is registered as pending privacy review. It
          becomes visible on the site only when you attach it to a journey story,
          complete the checklist there and mark that attachment public.
        </p>
      </Notice>

      {scan.heicSupported === false ? (
        <Notice tone="warning" icon="alertTriangle" title="HEIC cannot be decoded">
          <p>
            This build of sharp has no HEIF support, so iPhone <code>.heic</code> files
            are skipped. Export them as JPEG first.
          </p>
        </Notice>
      ) : null}

      {scan.truncated ? (
        <Notice tone="warning" icon="alertCircle">
          <p>
            The scan stopped at 400 files. Import what is listed, then scan again for
            the rest.
          </p>
        </Notice>
      ) : null}

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" iconStart="refresh" onClick={() => void runScan()}>
          Scan again
        </Button>

        <Button
          iconStart="upload"
          disabled={selected.size === 0 || importing}
          loading={importing}
          onClick={() => void runImport()}
        >
          {importing
            ? `Importing ${progress?.done ?? 0} of ${progress?.total ?? 0}…`
            : `Import ${selected.size} selected`}
        </Button>

        <span className="text-[0.8125rem] text-foreground-subtle">
          {files.length} image{files.length === 1 ? "" : "s"} found ·{" "}
          {importable.length} importable
        </span>
      </div>

      {files.length === 0 ? (
        <EmptyState
          icon="folder"
          title="No images in the import folder"
          description={
            scan.directory
              ? `Put your folders inside ${scan.directory} and scan again. Sub-folders are read up to four levels deep.`
              : "Put your folders inside imports/portfolio-media/ and scan again."
          }
        />
      ) : (
        folders.map((folder) => {
          const inFolder = files.filter((file) => file.folder === folder);
          const suggestion = inFolder.find((file) => file.suggestedStory)?.suggestedStory;

          return (
            <section key={folder} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-small font-semibold">
                  <Icon name="folder" size={15} className="mr-1.5 inline align-[-0.15em]" />
                  {folder}
                </h2>

                <span className="text-[0.75rem] text-foreground-subtle">
                  {inFolder.length} file{inFolder.length === 1 ? "" : "s"}
                </span>

                {/*
                  The folder-name hint. A suggestion, never a public title — the
                  owner assigns the story on the journey page afterwards, and the
                  folder name is never written to a public field.
                */}
                {suggestion ? (
                  <Badge tone="info" icon="mapPin">
                    Looks like: {suggestion}
                  </Badge>
                ) : null}

                <button
                  type="button"
                  onClick={() => toggleFolder(folder)}
                  className={cn(
                    "ml-auto min-h-11 text-[0.8125rem] font-medium underline underline-offset-4",
                    "text-foreground-muted transition-colors hover:text-foreground",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
                  )}
                >
                  Select all in this folder
                </button>
              </div>

              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {inFolder.map((file) => {
                  const blocked = Boolean(file.duplicateOf) || file.alreadyImported;
                  const result = resultsByPath.get(file.relativePath);
                  const isSelected = selected.has(file.relativePath);

                  return (
                    <li key={file.relativePath}>
                      <Card
                        className={cn(
                          isSelected && "border-primary/60",
                          blocked && "opacity-60",
                        )}
                      >
                        <CardBody className="flex flex-col gap-2 p-3">
                          <label
                            className={cn(
                              "flex items-start gap-2.5",
                              blocked ? "cursor-not-allowed" : "cursor-pointer",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={blocked || importing}
                              onChange={() => toggle(file.relativePath)}
                              className="mt-0.5 size-5 shrink-0 rounded-(--radius-xs) border border-border-strong accent-(--primary)"
                            />

                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                              <code className="truncate text-[0.75rem] font-medium">
                                {file.filename}
                              </code>

                              <span className="text-[0.6875rem] text-foreground-subtle">
                                {formatBytes(file.sizeBytes)}
                                {file.width && file.height
                                  ? ` · ${file.width}×${file.height}`
                                  : ""}
                                {file.capturedOn ? ` · ${file.capturedOn}` : ""}
                              </span>
                            </span>
                          </label>

                          {/* The name it will be given publicly. */}
                          <p className="truncate text-[0.6875rem] text-foreground-subtle">
                            <Icon
                              name="arrowRight"
                              size={11}
                              className="mr-1 inline align-[-0.1em]"
                            />
                            {file.suggestedFilename}
                          </p>

                          <div className="flex flex-wrap gap-1.5">
                            {file.isHeic ? (
                              <Badge tone="neutral">HEIC → WebP</Badge>
                            ) : null}

                            {file.duplicateOf ? (
                              <Badge tone="warning" icon="copy">
                                Duplicate in this folder
                              </Badge>
                            ) : null}

                            {file.alreadyImported ? (
                              <Badge tone="neutral" icon="check">
                                Already imported
                              </Badge>
                            ) : null}

                            {result ? (
                              <Badge
                                tone={result.ok ? "success" : "danger"}
                                icon={result.ok ? "checkCircle" : "alertCircle"}
                              >
                                {result.ok ? "Imported" : (result.error ?? "Failed")}
                              </Badge>
                            ) : null}
                          </div>
                        </CardBody>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      {/* ── Videos ──────────────────────────────────────────────────────── */}
      {scan.videos && scan.videos.length > 0 ? (
        <>
          <Divider />
          <Notice tone="info" icon="file" title={`${scan.videos.length} video files found`}>
            <p>
              These are listed, not imported. This CMS references video rather than
              hosting it — there is no transcoder in the stack, the upload ceiling is
              10 MB, and serving camera originals from the site would be slow for
              everyone.
            </p>
            <p className="mt-2">
              Upload each one to YouTube or Vimeo, then add it to a journey story with
              its address and a poster frame. Set unlisted videos to unlisted there, and
              remember that an unlisted video linked from a public page is effectively
              public.
            </p>
            <ul className="mt-3 flex flex-col gap-1">
              {scan.videos.slice(0, 20).map((video) => (
                <li key={video.relativePath} className="text-[0.75rem]">
                  <code>{video.filename}</code>{" "}
                  <span className="text-foreground-subtle">
                    ({formatBytes(video.sizeBytes)})
                  </span>
                </li>
              ))}
              {scan.videos.length > 20 ? (
                <li className="text-[0.75rem] text-foreground-subtle">
                  …and {scan.videos.length - 20} more.
                </li>
              ) : null}
            </ul>
          </Notice>
        </>
      ) : null}

      {/* ── Skipped ─────────────────────────────────────────────────────── */}
      {scan.skipped && scan.skipped.length > 0 ? (
        <Notice tone="warning" icon="alertTriangle" title={`${scan.skipped.length} skipped`}>
          <ul className="flex flex-col gap-1">
            {scan.skipped.slice(0, 20).map((entry) => (
              <li key={entry.filename} className="text-[0.75rem]">
                <code>{entry.filename}</code> — {entry.reason}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}
    </div>
  );
}
