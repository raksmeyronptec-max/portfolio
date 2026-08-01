import "server-only";

import { PDFDocument } from "pdf-lib";

/**
 * Server-side PDF operations.
 *
 * Two of them, both narrow and both deliberately server-only:
 *
 *  · `readPdfPageCount()` — so the admin never has to count a book by hand, and
 *    so `page_count` is a measured fact rather than a typed one.
 *  · `extractFirstPages()` — so a `first_pages` preview policy is *true*.
 *
 * ── Why the second one has to exist ────────────────────────────────────────
 * A preview policy that says "the first five pages" and then streams the whole
 * book is not a preview policy, it is a label. Without real truncation the only
 * honest options would be to drop the setting or to lie in the UI, and the
 * setting is the one the owner will reach for on a book they are willing to
 * show but not give away.
 *
 * ── Why pdf-lib, and what it is not asked to do ────────────────────────────
 * It parses and re-serialises the document object graph. It does not render,
 * rasterise or execute anything, and no JavaScript embedded in a PDF is ever
 * evaluated — pdf-lib has no interpreter. `PDFDocument.create()` starts a fresh
 * document and `copyPages` brings across only the page trees, so the output
 * carries no `/OpenAction`, no `/AA`, no embedded files and no attachments from
 * the source. That is a side benefit rather than a security claim: the input is
 * the owner's own uploaded file, not a stranger's.
 *
 * Both functions return `null` rather than throwing on a malformed document.
 * Failing a preview is a degraded page; failing a request is a 500.
 */

/** Hard ceiling, matching the CHECK on `preview_page_limit` in migration 0026. */
const MAX_PREVIEW_PAGES = 25;

/**
 * How many pages a PDF has.
 *
 * `updateMetadata: false` keeps pdf-lib from touching the ModDate on a document
 * we are only measuring.
 */
export async function readPdfPageCount(bytes: Uint8Array): Promise<number | null> {
  try {
    const document = await PDFDocument.load(bytes, {
      updateMetadata: false,
      // A book's page tree is the only thing being read. Ignoring encryption
      // errors would mean silently reporting a page count for a document we
      // could not actually open.
      ignoreEncryption: false,
    });
    return document.getPageCount();
  } catch {
    return null;
  }
}

/**
 * A new PDF containing only the first `limit` pages.
 *
 * Returns `null` when the document cannot be read, and the original byte count
 * is never assumed — a five-page book asked for ten pages yields five, not an
 * error.
 *
 * Metadata is deliberately reset rather than copied. The source document's
 * `Producer` and `Creator` fields routinely name the author's machine and their
 * LaTeX distribution's absolute install path, and this file is the one that
 * gets served to strangers.
 */
export async function extractFirstPages(
  bytes: Uint8Array,
  limit: number,
): Promise<Uint8Array | null> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), MAX_PREVIEW_PAGES));

  try {
    const source = await PDFDocument.load(bytes, { updateMetadata: false });
    const total = source.getPageCount();
    if (total === 0) return null;

    const take = Math.min(safeLimit, total);

    const extract = await PDFDocument.create();
    const pages = await extract.copyPages(
      source,
      Array.from({ length: take }, (_, index) => index),
    );
    for (const page of pages) extract.addPage(page);

    /*
     * Blank, not copied. See the note above: a LaTeX `Producer` string is
     * typically something like "LuaTeX-1.15.0" but the `Creator` and any XMP
     * block can carry `/Users/…/Library/TinyTeX/…`, and this document is the one
     * that leaves the building.
     */
    extract.setTitle("");
    extract.setAuthor("");
    extract.setSubject("");
    extract.setKeywords([]);
    extract.setProducer("");
    extract.setCreator("");

    return await extract.save({ useObjectStreams: true });
  } catch {
    return null;
  }
}
