# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A bilingual (English/Khmer) portfolio **CMS** for Ron Raksmey: Next.js 16 App Router + React 19, Supabase (Postgres + Auth + Storage), Cloudflare R2, Tailwind v4. `legacy/` holds the pre-rebuild static site — kept for content reference only, excluded from lint and tests, never imported.

Hosting is deliberately not assumed. `netlify.toml` is committed and there is a
live Vercel deployment; `siteUrl()` resolves the origin from either platform's
env vars, and the serverless constraints that shape the code (read-only function
filesystem, 4.5 MB request bodies) hold on both.

`docs/AUDIT.md` records the v1 defects the rebuild exists to fix (leaked Telegram token, wrong canonical host, client-side i18n, unresolved content contradictions). Many comments in the code refer back to it; read it before "simplifying" something that looks defensive.

## Commands

```bash
npm run dev                    # next dev on :3000
npm run build && npm start
npm run verify                 # typecheck + lint + unit tests — run before finishing work

npm run typecheck              # tsc --noEmit
npm run lint / lint:fix

npm test                       # vitest run (unit)
npm run test:watch
npx vitest run tests/unit/validation.test.ts          # single file
npx vitest run -t "rejects protocol-relative"          # single test by name

npm run test:e2e               # playwright; builds + starts on :3100 itself
npm run test:e2e:install       # one-time: playwright chromium + system deps
npx playwright test tests/e2e/admin.spec.ts --project=chromium
E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test  # reuse a running server

npm run db:start / db:stop     # local Supabase (ports 553xx, not the defaults)
npm run db:reset               # reapply all migrations + seed.sql
npm run db:types               # regenerate src/lib/supabase/database.types.ts — do this after every migration
npm run db:diff / db:push      # author a migration from Studio edits / apply to the linked project
npm run test:rls               # psql suite in tests/integration/rls.sql; needs db:start + docker

node scripts/configure-r2-cors.mjs --origin https://…   # see "Direct-to-storage uploads"
```

Playwright projects: `chromium`, `mobile-390`, `mobile-320` (320px is the narrowest supported width).

## Architecture

### Two root layouts, no `src/app/layout.tsx`

`src/app/[locale]/layout.tsx` (public) and `src/app/admin/layout.tsx` (admin) are both root layouts owning their own `<html>`. The public one sets `lang` from the actual content locale — that is the whole reason for the split. Don't add `src/app/layout.tsx`; it would nest them and break this.

### Locale routing

Every public URL carries its locale (`/en/…`, `/km/…`). `src/middleware.ts` redirects unprefixed paths (307, cookie → `Accept-Language` → `en`) and persists the choice in the `portfolio_locale` cookie. Paths in `PASSTHROUGH_PREFIXES` (`/api`, `/admin`, legacy asset dirs, metadata routes) are never prefixed. All locale helpers live in [src/i18n/config.ts](src/i18n/config.ts); messages are statically imported catalogues in [src/i18n/messages/](src/i18n/messages/) — `km.ts` is typed against `en.ts`, and a unit test additionally rejects keys present but blank.

Content translations come from `*_translations` tables, resolved by `resolveTranslation()` in [src/lib/content/translation.ts](src/lib/content/translation.ts): requested → `en` → any → null, returning `isFallback` so the renderer can set `lang` on the fallback text rather than mislabel it.

### Three Supabase clients — pick deliberately

| Module | Runs as | Use for |
| --- | --- | --- |
| `createSupabaseServerClient()` ([server.ts](src/lib/supabase/server.ts)) | signed-in user / anon, RLS applies | all normal server reads and writes |
| `createSupabasePublicClient()` (same file) | anon, never writes cookies | public pages — cookie writes would opt them out of static rendering |
| `createSupabaseAdminClient()` ([admin.ts](src/lib/supabase/admin.ts)) | **service role, bypasses RLS** | only: audit-log inserts, signed URLs for private originals, admin-role lookups, contact-triage columns |

`eslint.config.mjs` bans importing `@/lib/supabase/admin` outside a closed allowlist (`src/app/api/**/route.ts`, `src/lib/actions/**`, `src/lib/audit/**`, `src/lib/auth/**`, `src/lib/analytics/**`). If a query "needs" the service role somewhere else, the RLS policy is the thing to fix.

### Security boundary is the database

RLS is the enforcement layer; middleware and guards are UX. Concretely:

- Middleware's `/admin` redirect only saves a render — every admin page re-verifies via [src/lib/auth/guards.ts](src/lib/auth/guards.ts).
- Guards always use `getUser()` (validates with the auth server), never `getSession()` (decodes a client-controlled cookie).
- Public queries in `src/lib/data/*.ts` deliberately do **not** filter on `status`/`deleted_at` — RLS does, so a forgotten `.eq()` cannot leak a draft.
- Roles are `owner > editor > viewer`, with named predicates in [src/lib/auth/roles.ts](src/lib/auth/roles.ts). The UI uses them to decide what to *show*; guards and RLS decide what is *allowed*.
- `safeInternalPath()` constrains every `?next=` redirect target to `/admin…`.

### Server Actions

Everything under `src/lib/actions/` is `"use server"` and returns `ActionResult<T>` — a discriminated union, never a throw, because thrown errors lose field-level detail behind an opaque boundary. Error `code`s are *codes*, localised client-side. `fromPostgresError()` maps PG error codes onto them; notably `23514` (check_violation) surfaces as `publish_blocked` with the migration-authored message, which is how "privacy review required" reaches the admin.

**A `"use server"` module may export nothing but async functions.** Exporting a schema or label object makes every action in that file throw at runtime only — build, types and lint all pass. [tests/unit/use-server-exports.test.ts](tests/unit/use-server-exports.test.ts) is the guard; put shared constants in `src/lib/validation/` instead.

After any content mutation call `revalidatePublicContent()` from [src/lib/actions/result.ts](src/lib/actions/result.ts) so every locale variant and the sitemap refresh.

Layer split: `src/lib/validation/` (zod schemas + publish blockers, isomorphic) → `src/lib/actions/` (writes) → `src/lib/data/` (reads; `admin*.ts` files are the admin-side reads, the rest are public).

### Journey: stories, media and relations

`journey_entries` is the third content type with its own `*_translations` table
(migrations 0023–0025). A *story* is one dated thing that happened — fieldwork, an
award, an exchange — carrying its own photographs and video and pointing at the
Experience/Education/Certificate/Project records it evidences.

Four things are worth knowing before touching it:

- **`journey_media` is a join, not a library.** It holds no bytes and no paths;
  one physical `media_assets` row can appear in several stories with a different
  caption in each. Captions and alt text on the attachment override the asset's
  own; blank counts as absent. Same shape as `experience_media`, deliberately.
- **Publication is gated three times.** A CHECK constraint
  (`journey_media_public_requires_review`), the RLS read policy, and
  `journeyMediaSchema`. Public requires `privacy_status = 'approved'` **and**
  `consent_status IN ('not_required','confirmed')`. The privacy vocabulary shared
  with experience photos lives in [src/lib/validation/media-privacy.ts](src/lib/validation/media-privacy.ts) — one definition, because two copies drift.
- **Video is referenced, never hosted.** There is no transcoder in this stack and
  the upload ceiling is 10 MB, so `journey_media` stores an external URL plus a
  poster drawn from the media library. The embed URL is *re-derived from the URL
  at render time* rather than trusted from `video_provider`, so a row edited in
  Supabase Studio cannot put an arbitrary origin in an iframe. Only YouTube and
  Vimeo are framed; everything else renders as an outbound link.
- **`date_precision` exists so the CMS cannot fabricate.** `unknown` is a
  first-class answer and the timeline files those stories under "Date to be
  confirmed" rather than inventing a year. `period_label_*` beats both.

`journey_relations` uses four nullable FKs with a CHECK that exactly one is set,
rather than a `(type, id)` pair — the pair cannot have a foreign key, which is
the thing that makes a dangling relation impossible.

### Publications: books, editions and three file levels

`publications` is the fourth content type (migrations 0025–0028). A *publication*
is an authored work — a mathematics book, an exercise collection, lecture notes —
with editions, a table of contents, a licence, a citation and files.

Five things are worth knowing before touching it:

- **Files live on the edition, not the publication.** A new edition means a new
  PDF, so `publication_versions` owns `pdf_media_id` / `original_media_id` /
  `source_archive_media_id`, and `publications.active_version_id` says which one
  is current. `publication_media` carries only the cover, sample pages and
  gallery. Producing a redacted edition never overwrites the archival original —
  they are two different `media_assets` rows on the same version.
- **All three file levels are private, including the one readers download.**
  This reads backwards until you follow the request path: `pdf_download_policy`
  has values (`signed`, `on_request`, `contact_author`) that cannot be true of an
  object anybody can fetch by URL. So access is decided by
  `/api/publications/[slug]/download`, which checks the policy first, and the
  buckets stay shut. Same shape as the resume. `publication-previews` is the only
  public bucket and holds images only.
- **`preview_policy` is separate from `pdf_download_policy`,** because "you may
  read five pages here" and "you may keep a copy" are different permissions.
  `first_pages` serves a genuinely truncated PDF, rebuilt by
  `extractFirstPages()` in [src/lib/media/pdf.ts](src/lib/media/pdf.ts) — streaming
  the whole file and opening the viewer on page one would put the entire book in
  the browser cache, which is the thing the policy exists to prevent.
- **Anonymous readers have no grant on `publication_versions` at all.** The
  private file references are columns, and RLS cannot filter a column, so the
  boundary is the `public_publication_versions` view: it projects the three ids
  away into booleans. It is a *definer-rights* view, so its `WHERE` clause
  carries the row predicate that the table's policy carries — the two must stay
  in step, and `tests/integration/rls.sql` asserts both.
- **Publication is gated three times.** `needs_review`, an approved
  `privacy_status`, and an English title — enforced by
  `enforce_publication_publish_rules()`, mirrored in `publicationSchema`. The
  privacy decision moves only through `reviewPublicationPrivacy()` (owner-only),
  never through the edit form: approving a book PDF means somebody opened it and
  read to the end, and it must not be a side effect of fixing a subtitle.
  Migration 0028 added a fourth condition: the *active edition* must itself be
  `published`. The gate reads `publication_versions` and the public page reads
  `public_publication_versions`, and the two disagreeing meant a published book
  rendered with no download button, silently.

Nothing here fabricates. `buildCitation()` omits every element it does not know
rather than emitting "n.d." or an inferred publisher; `buildBibTeX()` returns
`null` below the threshold for a valid entry; ISBN and DOI are never generated.
`containsLocalPath()` refuses public production notes containing `/Users/…`.

### Media import (development only)

`/admin/media/import` scans `imports/portfolio-media/` and runs selected files
through the ordinary upload pipeline: HEIC decoded via sharp's libheif, **all
metadata stripped including GPS**, re-encoded to WebP with derivatives, semantic
public filename, `requires_privacy_review = true`.

Enabled when `MEDIA_IMPORT_DIR` is set, or in development at the default path;
off everywhere else, because Netlify's function filesystem is read-only and holds
only the bundle. The folder is git-ignored — it contains photographs of real
pupils. Video files are listed but never uploaded.

### Storage: two providers at once

[src/lib/storage/](src/lib/storage/) abstracts Supabase Storage and Cloudflare R2. New uploads go to R2 **when R2 env vars are set** — configuring it *is* the intent to use it. The provider is recorded per row on `media_assets`, so a half-migrated library is a legal state and nothing needed migrating.

R2 has no per-object ACLs, so privacy is physical: two buckets, `R2_BUCKET_NAME` (public) and `R2_PRIVATE_BUCKET_NAME` (**must never get a custom domain or public dev URL**). The four *logical* bucket names in [buckets.ts](src/lib/storage/buckets.ts) are a stable vocabulary stored in `media_assets.bucket_id` — don't rename them. Which media kinds are private is decided once in [src/lib/media/kinds.ts](src/lib/media/kinds.ts); certificate originals and resume PDFs are private and are streamed through route handlers, never linked directly.

Uploads go through `POST /api/admin/media/upload` (a route handler, not an action — Server Actions cap bodies at ~2 MB); size limits live in `SIZE_LIMITS` in [src/lib/media/validate.ts](src/lib/media/validate.ts), read through `uploadLimitFor(kind)` so the form and the route cannot disagree.

**Two ceilings, not one.** 10 MB for every kind (migration 0019 made that uniform,
and `media_assets_size_limit` is the database backstop), except the three
publication file kinds at 25 MB. The storage buckets permit 25 MB.

### Direct-to-storage uploads

`POST /api/admin/media/direct-upload` is a second upload path, for
`publication_pdf` / `publication_original` / `publication_source` only. It exists
because every serverless platform caps the request body it will accept (4.5 MB),
and a typeset mathematics book is larger — the platform rejected the request
before any of our code ran, with a non-JSON response, so the uploader could
report only "Upload failed" and no server log existed.

It is two steps, and the server keeps everything that matters:

- `?step=sign` checks the permission, pins the kind to a bucket and a visibility,
  **chooses the object key itself**, and signs a short-lived URL for that one key.
  The browser cannot pick where its bytes land.
- `?step=register` reads the object back and runs the same magic-byte validation,
  checksum and duplicate check the ordinary route runs — against the bytes that
  actually arrived. Anything that fails is deleted from the bucket before
  returning.

Images must never be routed here: they would skip `processImage()` and be stored
as unstripped camera originals, GPS and all. The route enforces that with
`PUBLICATION_FILE_KINDS`.

**The PUT is cross-origin, so the R2 bucket needs a CORS policy.** A bucket
without one answers `NoSuchCORSConfiguration`, the preflight fails, and the
browser reports only "Failed to fetch". Apply it with
`node scripts/configure-r2-cors.mjs --origin <site>` and **re-run it for every new
origin** — a custom domain or a preview deployment is not covered by the previous
policy. [docs/R2-CORS.md](docs/R2-CORS.md) explains what the policy grants and why
it is not `*`.

### Contact and analytics

`POST /api/contact` is a direct rewrite of the v1 Netlify function and each
difference is deliberate (the route's header lists all five). The load-bearing
ones: the database write is the source of truth and the Telegram notification is
best-effort on top, so an outage cannot lose an enquiry; the response reports
whether a notification actually went out, and the UI wording differs accordingly;
rate limiting is evaluated in Postgres against stored messages, because v1's
module-level counter reset on every cold start. Missing `TELEGRAM_*` env vars are
a supported state — the form still works and simply does not claim delivery.

`trackEvent()` ([src/lib/analytics/track.ts](src/lib/analytics/track.ts)) is
fire-and-forget, honours Do Not Track and Global Privacy Control, and attaches no
identifier — the server derives a rotating hash from request headers in
[visitor.ts](src/lib/analytics/visitor.ts).

### Audit log

`writeAuditLog()` ([src/lib/audit/log.ts](src/lib/audit/log.ts)) uses the service role because no client role has INSERT/UPDATE/DELETE on `audit_logs` — the trail is append-only by grant, not by convention. Never log a secret; never log a raw IP (use the salted daily-rotating `rateLimitHash`/`visitorHash`).

### Config and headers

[next.config.ts](next.config.ts) is the source of truth for CSP and security headers, deriving `img-src`/`connect-src` from the Supabase and R2 origins at build time — new remote hosts must be added there *and* to `images.remotePatterns`. `netlify.toml` repeats the essentials because Netlify serves `public/` directly. `siteUrl()` in [src/lib/supabase/env.ts](src/lib/supabase/env.ts) is the single origin for canonicals, hreflang, sitemap, OG and JSON-LD.

Missing Supabase config is a supported state: the site degrades to documented empty states instead of crashing (`isSupabaseConfigured()`).

## Conventions

- Path alias `@/*` → `src/*`.
- Server-only modules start with `import "server-only"`; unit tests stub it via [tests/stubs/server-only.ts](tests/stubs/server-only.ts), so a passing test does not prove the boundary — `next build` does.
- `react/no-danger` is an error. Interpolation goes through `interpolate()` in [src/i18n/dictionary.ts](src/i18n/dictionary.ts), which substitutes and nothing else.
- Migrations are timestamped SQL in `supabase/migrations/`, append-only; regenerate `database.types.ts` after each one.
- Comments here explain *why* (usually citing a v1 defect or a failure mode). Match that when touching these files.
