import "server-only";

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * Local-folder media import.
 *
 * ── What this is, and what it deliberately is not ──────────────────────────
 * The owner has years of photographs sitting in dated folders on a laptop. This
 * scans an approved directory inside the development workspace, reports what is
 * there, and — only for files the owner explicitly selects — runs each one
 * through the *existing* upload pipeline.
 *
 * It is not a background job, not a watcher, and it never writes to the source
 * folder. The originals are read and left exactly as they were.
 *
 * ── Why it is development-only ─────────────────────────────────────────────
 * The site deploys to Netlify, where the function filesystem is read-only,
 * ephemeral and contains nothing but the deployment bundle. A "scan a folder"
 * feature there would either always report zero files or, worse, walk the
 * bundle. `importDirectory()` returns null in production and every entry point
 * checks it, so the route 404s rather than pretending.
 *
 * ── HEIC ───────────────────────────────────────────────────────────────────
 * iPhone photographs arrive as HEIC, which Safari renders and nothing else does.
 * `sharp` in this project is built with libheif, so HEIC is *decoded* here and
 * re-encoded to WebP like every other image — the browser never sees a HEIC file.
 * `sharpSupportsHeic()` reports the capability honestly rather than assuming it,
 * because a sharp rebuilt without libheif would otherwise fail one file at a time
 * with an opaque error.
 *
 * ── Privacy ────────────────────────────────────────────────────────────────
 * Two things happen to every imported image, both non-optional:
 *
 *  1. It is re-encoded through `processImage()`, which strips *all* metadata —
 *     including GPS. A photograph taken at a school must not publish that
 *     school's coordinates, and a photograph taken at a pupil's home must not
 *     publish theirs. The EXIF date is read here *before* that happens and kept
 *     as an ordinary column, because a date is useful and a coordinate is not.
 *
 *  2. The resulting `media_assets` row is created with
 *     `requires_privacy_review = true`. Nothing imported is ever publishable
 *     until a human has looked at it.
 */

/** Extensions the importer will look at. */
const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".heic",
  ".heif",
]);

/**
 * Video extensions.
 *
 * Recognised so the scan can *report* them, never to upload them. This CMS
 * references video rather than hosting it (see migration 0024), so a video found
 * in the folder is listed with an explanation instead of being silently ignored —
 * "the importer skipped 40 files" is a worse outcome than saying why.
 */
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"]);

/** Refuses to walk deeper than this. Guards against a symlink loop. */
const MAX_DEPTH = 4;

/** Refuses to report more than this in one scan, so the page stays usable. */
const MAX_FILES = 400;

/**
 * The approved import directory, or `null` when importing is unavailable.
 *
 * ── When it is available ───────────────────────────────────────────────────
 * Two ways, and the order matters:
 *
 *  1. `MEDIA_IMPORT_DIR` is set — an explicit opt-in, resolved relative to the
 *     project root. This is what makes the importer usable from a *local
 *     production build*, which is a legitimate thing to run: `next dev` is not
 *     the only way to work on your own machine, and gating purely on NODE_ENV
 *     denied a real use case for no security gain.
 *
 *  2. Otherwise, development only, at the documented default path.
 *
 * A hosted deployment has neither: nobody sets the variable in Netlify, and
 * NODE_ENV is `production` there. So the feature stays off by default in exactly
 * the place where its filesystem assumption does not hold — Netlify's function
 * filesystem is read-only, ephemeral, and contains only the deployment bundle.
 *
 * The path is resolved from `process.cwd()` and never from user input. The route
 * handler accepts a *relative path within the result*, which is then re-resolved
 * and checked to still be inside this directory; see
 * `resolveInsideImportDirectory()` for that boundary.
 */
export function importDirectory(): string | null {
  const configured = process.env.MEDIA_IMPORT_DIR?.trim();
  if (configured) return path.resolve(process.cwd(), configured);

  if (process.env.NODE_ENV === "production") return null;
  return path.join(process.cwd(), "imports", "portfolio-media");
}

/** True when the folder exists and can be read. */
export async function importDirectoryExists(): Promise<boolean> {
  const root = importDirectory();
  if (!root) return false;

  try {
    const info = await stat(root);
    return info.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Re-resolve a scanned relative path and prove it is still inside the import
 * directory.
 *
 * The importer's one real attack surface: the client sends back a path string,
 * and a naive `path.join(root, given)` accepts `../../../etc/passwd`. Resolving
 * and then checking the prefix — with a trailing separator, so `/imports-evil`
 * does not pass as a child of `/imports` — is what closes it.
 *
 * Returns null for anything outside, which callers treat as "file not found".
 */
export function resolveInsideImportDirectory(relativePath: string): string | null {
  const root = importDirectory();
  if (!root) return null;

  const resolved = path.resolve(root, relativePath);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (!resolved.startsWith(rootWithSep)) return null;
  return resolved;
}

export type ScannedFile = {
  /** Path relative to the import root. The id used by the client. */
  relativePath: string;
  filename: string;
  /** Immediate parent folder, which is what drives the suggestions. */
  folder: string;
  sizeBytes: number;
  extension: string;
  isHeic: boolean;
  /** SHA-256 of the file's bytes, for duplicate detection. */
  checksum: string;
  width: number | null;
  height: number | null;
  /** Capture date from EXIF, if the file carried one. */
  capturedOn: string | null;
  /** Suggested journey story slug, derived from the folder name. */
  suggestedStory: string | null;
  /** Suggested media kind. */
  suggestedKind: "journey_photo" | "experience_photo" | "video_poster";
  /** Semantic public filename replacing the camera name. */
  suggestedFilename: string;
  /** Another file in this scan with identical bytes. */
  duplicateOf: string | null;
  /** Already in the media library, matched by checksum. */
  alreadyImported: boolean;
};

export type ScanResult = {
  available: boolean;
  directory: string | null;
  files: ScannedFile[];
  /** Video files found — reported, never uploaded. */
  videos: Array<{ relativePath: string; filename: string; sizeBytes: number }>;
  /** Files skipped, with the reason. */
  skipped: Array<{ filename: string; reason: string }>;
  truncated: boolean;
  heicSupported: boolean;
};

/** Whether this build of sharp can decode HEIC. */
export function sharpSupportsHeic(): boolean {
  try {
    return Boolean(sharp.format.heif?.input?.buffer);
  } catch {
    return false;
  }
}

/**
 * Folder-name → journey story suggestions.
 *
 * Hints only. Section 9 of the brief is explicit that a folder name is never a
 * public title — these map a messy local folder onto a *slug the owner can then
 * change*, and nothing here is written to a public field without them confirming
 * it.
 *
 * Matched against the lowercased folder name with word-ish boundaries, so
 * `2024-ptom-kakoh` matches `ptom` but `symptom` does not.
 */
const FOLDER_HINTS: Array<{ pattern: RegExp; storySlug: string }> = [
  { pattern: /\bptom\b|\bplp\b|kakoh/, storySlug: "ptom-plp-fieldwork-kakoh-primary-school" },
  { pattern: /korea|korean/, storySlug: "experience-exchange-with-korean-teachers" },
  { pattern: /science[\s_-]*fair|sciencefair/, storySlug: "science-fair-activities" },
  { pattern: /\bai\b|artificial[\s_-]*intelligence/, storySlug: "how-to-use-ai-presentation" },
  { pattern: /\brupp\b/, storySlug: "my-learning-journey-at-rupp" },
  { pattern: /\bptec\b/, storySlug: "my-teacher-education-journey-at-ptec" },
  { pattern: /award|outstanding|grade[\s_-]*a\b/, storySlug: "outstanding-student-and-grade-a-recognition" },
];

function suggestStory(folder: string): string | null {
  const needle = folder.toLowerCase();
  for (const hint of FOLDER_HINTS) {
    if (hint.pattern.test(needle)) return hint.storySlug;
  }
  return null;
}

/**
 * A semantic public filename, replacing `IMG_4477.HEIC`.
 *
 * Built from the folder name plus a short checksum prefix. The checksum makes it
 * collision-safe without a counter — two photographs from the same folder cannot
 * produce the same name, and re-importing the same bytes produces the same name,
 * which is what makes the operation idempotent from the storage layer's point of
 * view.
 *
 * The original filename is kept on the row as `original_filename`, so the link
 * back to the owner's own folder is never lost.
 */
export function semanticFilename(
  folder: string,
  checksum: string,
  capturedOn: string | null,
): string {
  const base = folder
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const year = capturedOn?.slice(0, 4);
  const parts = [base || "journey", year, checksum.slice(0, 8)].filter(Boolean);

  return `${parts.join("-")}.webp`;
}

/**
 * Read the capture date from EXIF, as `YYYY-MM-DD`.
 *
 * EXIF dates are `YYYY:MM:DD HH:MM:SS` with no timezone. Only the date part is
 * kept — a time without a zone is not a fact, and nothing in this CMS displays
 * one. A date in the future or before 1990 is discarded as a wrong camera clock
 * rather than recorded as evidence.
 */
async function readCaptureDate(buffer: Buffer): Promise<string | null> {
  try {
    const metadata = await sharp(buffer, { failOn: "none" }).metadata();
    const exif = metadata.exif;
    if (!exif) return null;

    // Scanning the raw EXIF block for the ASCII date rather than adding an EXIF
    // parser dependency for one field. The format is fixed-width and unambiguous.
    const text = exif.toString("latin1");
    const match = text.match(/(\d{4}):(\d{2}):(\d{2}) \d{2}:\d{2}:\d{2}/);
    if (!match) return null;

    const [, year, month, day] = match;
    const iso = `${year}-${month}-${day}`;

    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return null;
    if (parsed > new Date()) return null;
    if (Number(year) < 1990) return null;

    return iso;
  } catch {
    return null;
  }
}

/**
 * Walk the import directory.
 *
 * `existingChecksums` comes from `media_assets` so already-imported files are
 * flagged rather than silently offered again — re-importing the same photograph
 * is the single easiest way to end up with two rows pointing at the same picture
 * and two divergent sets of alt text.
 */
export async function scanImportDirectory(
  existingChecksums: Set<string>,
): Promise<ScanResult> {
  const root = importDirectory();
  const heicSupported = sharpSupportsHeic();

  if (!root || !(await importDirectoryExists())) {
    return {
      available: false,
      directory: root,
      files: [],
      videos: [],
      skipped: [],
      truncated: false,
      heicSupported,
    };
  }

  /*
   * Captured after the guard above so the nested `walk` closure has a non-null
   * root. TypeScript's narrowing of `root` does not survive into the closure,
   * and re-checking inside the recursion would be noise.
   */
  const rootDir = root;

  const files: ScannedFile[] = [];
  const videos: ScanResult["videos"] = [];
  const skipped: ScanResult["skipped"] = [];
  const seenChecksums = new Map<string, string>();
  let truncated = false;

  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || truncated) return;

    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (truncated) return;

      // Dotfiles and macOS resource forks are noise, not content.
      if (entry.name.startsWith(".")) continue;

      const full = path.join(directory, entry.name);

      // `isDirectory()` is false for a symlink, so a symlink loop cannot be
      // followed — `withFileTypes` reports the link itself, not its target.
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
        continue;
      }

      if (!entry.isFile()) continue;

      const extension = path.extname(entry.name).toLowerCase();
      const relativePath = path.relative(rootDir, full);

      if (VIDEO_EXTENSIONS.has(extension)) {
        try {
          const info = await stat(full);
          videos.push({
            relativePath,
            filename: entry.name,
            sizeBytes: info.size,
          });
        } catch {
          /* ignore */
        }
        continue;
      }

      if (!IMAGE_EXTENSIONS.has(extension)) continue;

      if (files.length >= MAX_FILES) {
        truncated = true;
        return;
      }

      const isHeic = extension === ".heic" || extension === ".heif";

      if (isHeic && !heicSupported) {
        skipped.push({
          filename: entry.name,
          reason:
            "HEIC, and this build of sharp cannot decode it. Convert to JPEG before importing.",
        });
        continue;
      }

      let buffer: Buffer;
      try {
        buffer = await readFile(full);
      } catch {
        skipped.push({ filename: entry.name, reason: "Could not be read." });
        continue;
      }

      const checksum = createHash("sha256").update(buffer).digest("hex");

      let width: number | null = null;
      let height: number | null = null;
      try {
        const metadata = await sharp(buffer, { failOn: "none" }).metadata();
        width = metadata.width ?? null;
        height = metadata.height ?? null;
      } catch {
        skipped.push({
          filename: entry.name,
          reason: "Not a readable image, or the file is corrupt.",
        });
        continue;
      }

      const capturedOn = await readCaptureDate(buffer);
      const folder = path.basename(directory);

      const duplicateOf = seenChecksums.get(checksum) ?? null;
      if (!duplicateOf) seenChecksums.set(checksum, relativePath);

      files.push({
        relativePath,
        filename: entry.name,
        folder,
        sizeBytes: buffer.byteLength,
        extension,
        isHeic,
        checksum,
        width,
        height,
        capturedOn,
        suggestedStory: suggestStory(folder),
        suggestedKind: "journey_photo",
        suggestedFilename: semanticFilename(folder, checksum, capturedOn),
        duplicateOf,
        alreadyImported: existingChecksums.has(checksum),
      });
    }
  }

  await walk(rootDir, 0);

  // Folder, then filename. A camera's own ordering within a folder is the
  // chronological one, and reordering it would scramble a day's shoot.
  files.sort((a, b) =>
    a.folder === b.folder
      ? a.filename.localeCompare(b.filename)
      : a.folder.localeCompare(b.folder),
  );

  return {
    available: true,
    directory: root,
    files,
    videos,
    skipped,
    truncated,
    heicSupported,
  };
}
