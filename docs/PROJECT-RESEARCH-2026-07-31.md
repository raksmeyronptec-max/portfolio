# Project research — KruSmart, PTEC Digital Library, PTEC Storage

**Internal document. Not rendered by the public site and not stored in the database.**
Research date: **2026-07-31**. Researcher: Claude (Opus 5), for Ron Raksmey.

This file records where every published claim came from, so the owner can check it,
correct it, or extend it later. Nothing here is a credential, a token, an internal
hostname or an infrastructure secret.

---

## 0. Scope note — the KruSmart test account

The brief said a KruSmart test account would be supplied separately in
`KRU_SMART_TEST_EMAIL` / `KRU_SMART_TEST_PASSWORD`. **No such credentials were
present** — not in the conversation, not in the process environment, not in
`.env.local`. No authenticated session was therefore opened, and no attempt was
made to guess, reset or otherwise obtain one.

This turned out to cost less than expected. KruSmart is a client-rendered
application that serves its module registry, tier logic and access-control rules
as **public static JavaScript** (`/core/app.js`, `/core/auth.js`,
`/core/access-control.js`). Those files are the authoritative definition of what
the product does, and reading them is better evidence than clicking through a UI.
What remains genuinely unavailable is listed in §5.

`.env.local` is git-ignored (`.gitignore` lines 20–26). No credential was written
to any file, migration, seed, screenshot, log or database column.

---

## 1. Evidence ledger

Confidence values: `verified` (observed directly), `strongly_supported`
(consistent evidence from two independent public sources), `needs_owner_confirmation`,
`not_publishable`. Only the first two are published.

### 1.1 KruSmart — https://www.krusmart.org/

| # | Observation | Source | Confidence | Published |
|---|---|---|---|---|
| K1 | Title `KruSmart - ជំនួយការគ្រូបង្រៀនឌីជីថល`; OG title `KruSmart (PTEC) - …` | `GET /` HTML `<title>`, `og:title` | verified | yes |
| K2 | Khmer-first UI; English glosses in parentheses (`អុីមែល (Email)`, `ចូលគណនី`) — **not** a bilingual site with a language switcher | `GET /` rendered text | verified | yes |
| K3 | Khmer web fonts Kantumruy Pro + Moul loaded from Google Fonts | `<link>` to `fonts.googleapis.com/css2?family=Kantumruy+Pro…&family=Moul` | verified | yes |
| K4 | Account gate: email/password, confirm-password, live password-strength meter, terms checkbox, arithmetic bot challenge (`? + ? =`), Google sign-in, 6-digit OTP verification modal | element ids `password-strength-bar`, `captcha-question`, `terms`, `google-login-btn`, `otp-modal`, `otp-inputs` | verified | yes |
| K5 | Firebase Auth + Cloud Firestore v11.6.1 | ESM imports of `gstatic.com/firebasejs/11.6.1/firebase-auth.js` and `…-firestore.js`; `/core/firebase-config.js` | verified | yes |
| K6 | Hosted on Netlify | `server: Netlify`, `x-nf-request-id`, `cache-status: "Netlify Edge"` | verified | yes |
| K7 | 26 feature modules registered in the app launcher, each with a route and icon | `/core/app.js` module array (full list in §2) | verified | yes |
| K8 | Tier model `free / trial / premium / admin / banned`, resolved from Firestore only, never localStorage | `/core/access-control.js` `resolveTier()` + inline comment | verified | yes |
| K9 | 9 modules gated behind an active trial or premium subscription | `/core/access-control.js` `LOCKED_FEATURES` set | verified | yes |
| K10 | Geofenced teacher check-in: browser geolocation + haversine distance against the school record on `schoolId` | inline `<script type="module">` in `/` — `calculateDistanceInMeters`, `checkInTeacher()` | verified | yes |
| K11 | OTP mail is sent through a **pool** of EmailJS accounts held in Firestore, with failover when one is exhausted | `/core/auth.js` — `emailjsSnap = await getDocs(collection(db,'artifacts','ptec-app',…))`, quota-exhausted error strings | verified | yes |
| K12 | Installable PWA | `/manifest.json` — `display: standalone`, 192/512 icons; in-app "ដំឡើងកម្មវិធី (App)" control | verified | yes |
| K13 | Light/dark theming with a pre-paint init script | `/assets/js/theme-init.js`, `theme.css`, `dark:` class pairs throughout | verified | yes |
| K14 | Skip-to-content link, `aria-hidden` on decorative icons, `role="dialog"`/`aria-modal` on the upgrade modal | `/` HTML; `/core/access-control.js` modal builder | verified | yes |
| K15 | KHQR payment service on Render (Cambodian QR payment standard) | CSP `connect-src … https://krusmart-khqr.onrender.com`; paid-upgrade control `ឡើងជា Premium (បង់ប្រាក់)` | verified | yes |
| K16 | Google Gemini API reachable from the client | CSP `connect-src … https://generativelanguage.googleapis.com` | verified | yes (as "integration allow-listed", not as a described feature) |
| K17 | Google Analytics and reCAPTCHA/gstatic allow-listed | CSP `script-src … googletagmanager.com`, `connect-src … google-analytics.com`, `www.google.com` | verified | yes |
| K18 | Security headers: HSTS w/ preload (2 y), `X-Frame-Options: SAMEORIGIN`, nosniff, `Referrer-Policy: strict-origin-when-cross-origin`, `object-src 'none'`, `base-uri 'self'`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` | response headers on `GET /` | verified | yes |
| K19 | **Ron Raksmey is credited in-product as the developer**: the account menu item "អំពីអ្នកអភិវឌ្ឍន៍" (About the developer) links to `https://portfolio-ron-raksmey.netlify.app/` | `/` HTML anchor | verified | yes — this is the authorship evidence |
| K20 | Role split beyond "developer" — design vs. backend vs. product ownership; whether anyone else contributed | — | needs_owner_confirmation | no |
| K21 | User counts, school counts, revenue, subscription numbers, launch date | — | not_publishable (unobservable) | no |

> **K16 caution.** A CSP entry proves the origin is *allowed*, not that a feature
> ships. The case study says the policy allow-lists the Gemini API; it does not
> claim an AI feature exists. Same treatment for reCAPTCHA.

### 1.2 PTEC Digital Library — https://library.ptec.edu.kh/

| # | Observation | Source | Confidence | Published |
|---|---|---|---|---|
| L1 | Next.js on Vercel, prerendered with a 300 s stale window | `x-powered-by: Next.js`, `x-nextjs-prerender: 1`, `x-nextjs-stale-time: 300`, `server: Vercel` | verified | yes |
| L2 | Five public resource types: Books, Physical catalog, Theses, Publications, Learning Paths | `/llms.txt`; sitemap sections; primary nav | verified | yes |
| L3 | Collection snapshot on 2026-07-31: 114 digital resources = 112 e-books + 1 thesis + 1 publication; 7 active catalog records; 4 learning paths | `/llms.txt` "Current Public Collection Snapshot", published by the site itself | verified (as a self-published figure, dated) | yes — as a metric **with its source note** |
| L4 | 151 URLs in the sitemap; 113 book pages | `/sitemap.xml` | verified | yes |
| L5 | Fully bilingual EN/KM with `/km` prefix, reciprocal `hreflang`, EN canonical | `/sitemap.xml` `xhtml:link rel=alternate`; `x-matched-path: /en`; in-page switcher | verified | yes |
| L6 | Structured data: `Library`, `EducationalOrganization`, `WebSite` + `SearchAction`, `FAQPage`, `Book`, `ScholarlyArticle`, `Person`, `BreadcrumbList`, `ReadAction` | JSON-LD blocks on `/` and `/books/pisa-d` | verified | yes |
| L7 | Publishes an `llms.txt` with entity, mission, rights, provider-vs-publisher and citation guidance; `robots.txt` grants a named allow-list to AI crawlers while blocking `/admin/`, `/api/`, `/dashboard/`, `/auth/`, `/profile`, `/lists`, `/offline-books` | `/llms.txt`, `/robots.txt` | verified | yes |
| L8 | Installable PWA: `manifest.webmanifest` (standalone, maskable icons, three shortcuts) + a 95 KB service worker at `/sw.js`; "Saved for offline" is a first-class route (`/offline-books`) | manifest JSON; `GET /sw.js` → 200, 95 157 bytes | verified | yes |
| L9 | In-browser reading: book pages expose Details / **Read** / Reviews tabs and a download counter | `/books/pisa-d` rendered text | verified | yes |
| L10 | Covers served from a Cloudflare R2 public bucket with pre-optimised derivatives — path shape `books/<subject>/<slug>/cover.png-opt.webp` | `image` value in the `Book` JSON-LD (`pub-….r2.dev`) | verified | yes (described generically — the bucket id is not published) |
| L11 | Supabase (Postgres + realtime), Vercel Blob, Cloudflare R2, Cloudflare Turnstile, Google OAuth, Vercel Analytics | CSP `connect-src` (`*.supabase.co`, `wss://*.supabase.co`, `*.public.blob.vercel-storage.com`, `*.r2.dev`, `*.r2.cloudflarestorage.com`, `accounts.google.com`, `challenges.cloudflare.com`), `script-src va.vercel-scripts.com` | verified | yes |
| L12 | Library ↔ Storage integration: `storage-ptec.online` and `*.storage-ptec.online` are image hosts, `api.storage-ptec.online` is an API origin | library CSP `img-src` and `connect-src` | verified | yes |
| L13 | Hardened headers: `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `object-src 'none'`, `form-action 'self'`, `base-uri 'self'`, HSTS preload, COOP `same-origin-allow-popups`, CORP `same-origin`, `X-Permitted-Cross-Domain-Policies: none`, extended `Permissions-Policy` incl. `browsing-topics=()` | response headers | verified | yes |
| L14 | Physical-library documentation: rules, timings, collection, committee, team, "Our Journey" (library established 2017) | `/about/*` routes | verified | yes |
| L15 | Accounts: `/auth/login`, `/auth/signup`, `/profile`, private `/lists`, `/dashboard/` | nav links + robots disallow list | verified | yes (as "reader accounts exist"; the dashboard itself was not opened) |
| L16 | "Ask the library assistant" affordance in the mobile bar | `/` and `/books/*` rendered text | verified | yes (named, not described — behaviour not exercised) |
| L17 | Admin CMS internals: book/thesis/publication/path management screens, roles, audit logs, RLS policies, storage rules | — | needs_owner_confirmation | no — `/admin/` is disallowed and was **not** accessed |
| L18 | Ron Raksmey's role and its boundaries | owner-provided only | needs_owner_confirmation | partial — see §4 |
| L19 | Reader counts, download totals, uptime, Lighthouse scores | — | not_publishable | no |

> One incidental find: `/theses/research` is authored by រុន រស្មី. That is Ron
> Raksmey as a **thesis author**, not as the platform's developer. The two are not
> conflated anywhere in the published content.

### 1.3 PTEC Storage — https://storage-ptec.online/

| # | Observation | Source | Confidence | Published |
|---|---|---|---|---|
| S1 | Landing page states verbatim: "File delivery service for **library.ptec.edu.kh**. There is nothing to see here." | `GET /` HTML | verified | yes |
| S2 | `<meta name="robots" content="noindex">` — deliberately kept out of search results | `GET /` HTML | verified | yes |
| S3 | Served by Cloudflare (`server: cloudflare`, `cf-ray`, NEL/`report-to` reporting configured, HTTP/3 advertised) | response headers | verified | yes |
| S4 | Deny-by-default CSP: `default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` — the strictest of the three | response headers | verified | yes |
| S5 | `Cache-Control: public, max-age=300` + `Last-Modified` + `Accept-Ranges: bytes` (range requests, i.e. resumable/seekable file delivery) | response headers | verified | yes |
| S6 | `api.storage-ptec.online` exists as a distinct origin, serves the same placeholder at `/`, and is referenced by the Library's `connect-src` | `GET https://api.storage-ptec.online/` (root only); library CSP | verified | yes |
| S7 | Same hardening as the apex: HSTS, nosniff, `X-Frame-Options: DENY`, `Permissions-Policy` incl. `payment=()`, `usb=()` | response headers | verified | yes |
| S8 | Storage backend, topology, Zima OS or on-premise hardware, bucket layout, upload pipeline, admin file manager, quotas, backup design | — | needs_owner_confirmation | **no** — nothing about internal infrastructure is published |
| S9 | Bytes served, file counts, cache hit ratio | — | not_publishable | no |

> **No path enumeration was performed** on either storage origin. Only `/` was
> requested on each. Guessing object paths on a file host is exactly the
> unauthorized probing the brief rules out.

---

## 2. KruSmart module registry (verbatim from `/core/app.js`)

26 modules; ★ = in `LOCKED_FEATURES` (needs trial or premium).

| Route | Khmer label | English gloss |
|---|---|---|
| `/students/enrollment` | បញ្ចូលព័ត៌មានសិស្ស | Student enrolment |
| `/students/list` | បញ្ជីឈ្មោះសិស្ស | Class roster |
| `/students/age-list` | វិភាគអាយុ និងកម្ពស់ | Age and height analysis |
| `/students/codes` | លេខកូដសិស្ស (ឪពុកម្តាយ) | Student access codes for parents |
| `/students/id-cards` ★ | បោះពុម្ពកាតសិស្ស | Student ID card printing |
| `/attendance/table-layout` ★ | ចុះវត្តមានតាមប្លង់តុ | Attendance by seating plan |
| `/attendance/monthly` ★ | បញ្ជីវត្តមានប្រចាំខែ | Monthly attendance register |
| `/homework/enter-score` ★ | បញ្ចូលពិន្ទុកិច្ចការផ្ទះ | Homework scoring |
| `/homework/send` | បញ្ជូនកិច្ចការផ្ទះទៅអាណាព្យាបាល | Send homework to guardians |
| `/scores/enter-monthly` ★ | បញ្ចូលពិន្ទុ | Monthly score entry |
| `/scores/subjects` | តារាងពិន្ទុសរុប | Subject score table |
| `/ranking/print` ★ | តារាងចំណាត់ថ្នាក់ | Printable class ranking |
| `/ranking/honor-roll` ★ | តារាងកិត្តិយស | Honour roll |
| `/analysis/by-student` | វិភាគទិន្នន័យសរុប | Per-student analysis |
| `/analysis/by-subject` | វិភាគតាមមុខវិជ្ជា | Per-subject analysis |
| `/class-admin` | រដ្ឋបាលថ្នាក់រៀន | Class administration |
| `/reports/annual` | បញ្ជីបូកសរុបលទ្ធផលប្រចាំឆ្នាំ | Annual results summary |
| `/reports/parent` | របាយការណ៍មាតាបិតា | Parent report |
| `/tracking/tracking-book` ★ | សៀវភៅតាមដាន | Progress tracking book |
| `/tracking/record-book` | សៀវភៅសិក្ខាគារិក | Trainee record book |
| `/certificate` ★ | ទាញយកវិញ្ញាបនបត្រ | Certificate generation |
| `/notifications` | ផ្ញើសារទៅអាណាព្យាបាល | Guardian notifications |
| `/cleaning-schedule` | កាលវិភាគសម្អាតថ្នាក់ | Classroom cleaning rota |
| `/inventory` | បញ្ជីសារពើភ័ណ្ឌ | Classroom inventory |
| `/decoration-materials` | សម្ភារៈតុបតែងថ្នាក់ | Classroom display materials |
| `/profile` | ព័ត៌មានគណនី | Account profile |

---

## 3. Field mapping — research → existing schema

No new tables were created. The schema from migration `…090300_projects.sql`
already models everything the brief asked for; several names in the brief differ
from the column names actually in use, so this is the translation table.

| Researched information | Existing database field | Action |
|---|---|---|
| Project name | `project_translations.title` (per locale) | update |
| Slug | `projects.slug` | unchanged |
| Publication state | `projects.status` (`publication_status` enum) | already `published` |
| Lifecycle state | `projects.project_status` (`project_status` enum) | already `live` |
| Featured / order | `projects.featured`, `projects.sort_order` | reordered (§3.1) |
| Live URL | `projects.live_url` | unchanged |
| Repository URL | `projects.repository_url` | left NULL — none of the three is public |
| Role / organization | `projects.role_*`, `projects.organization_*` | unchanged (owner-supplied) |
| Year | `projects.year_label` | left NULL — not evidenced |
| Eyebrow / card description | *no such columns* → `project_translations.summary` | mapped, not invented |
| Short summary | `project_translations.summary` | update |
| Overview / problem / target users / goals | `project_translations.{overview,problem,target_users,goals}` | insert |
| My role / responsibilities | `project_translations.{my_role,responsibilities}` | `my_role` insert; `responsibilities` **left NULL** |
| Constraints / research | `project_translations.{constraints,research}` | insert where evidenced |
| UX / architecture / database | `project_translations.{ux_decisions,architecture,database_decisions}` | insert |
| Security / accessibility / SEO / performance | `project_translations.{security_notes,accessibility_notes,seo_notes,performance_notes}` | insert |
| Key-features intro | `project_translations.key_features` | insert |
| Challenges / solution / results / lessons / next steps | `project_translations.{challenges,solution,results,lessons,next_steps}` | insert |
| SEO title / description | `project_translations.{seo_title,seo_description}` | update (≤70 / 50–160 chars, DB-enforced) |
| Open Graph title / description | *no such columns* — `buildPageMetadata()` derives OG from `seo_title`/`seo_description` | no schema change needed |
| Canonical URL, hreflang, sitemap | generated by `lib/seo/metadata.ts`, `app/sitemap.ts` | no data needed |
| Structured data | generated by `lib/seo/jsonld.ts` (`SoftwareApplication` when `live_url` is set, else `CreativeWork`, + `BreadcrumbList`) | no data needed |
| Features (structured) | `project_features` — `title_en/km`, `description_en/km`, `icon`, `sort_order` | insert (bilingual columns, **not** one row per locale) |
| Feature `category` / `evidence_status` | *no such columns* | not added — encoded in ordering + this document |
| Technologies | `technologies` + `project_technologies` | upsert |
| Categories | `project_categories` + `project_category_links` | unchanged |
| Metrics | `project_metrics` — `is_verified` requires a `source_note` (CHECK) | insert |
| Screenshots | `media_assets` + `project_media` + `projects.cover_media_id` | upload + link |
| Internal research notes | this file + `projects.review_note` | not a public column |

### 3.1 Display order

Changed to the order the brief recommends, which is also the strongest narrative:

1. `ptec-digital-library` — the largest, most complete platform
2. `krusmart` — the product with the deepest feature surface
3. `ptec-storage` — the infrastructure that supports #1

---

## 4. Role and contribution — what is published and what is not

The only *independent* evidence of authorship is **K19**: KruSmart's own account
menu links "About the developer" to Ron Raksmey's portfolio. Everything else rests
on the owner's statement that these are his projects.

Published, therefore:

- `projects.role_*` — kept exactly as the owner already seeded it.
- `project_translations.my_role` — a short paragraph that states the role at the
  level already asserted, and no further. It does not claim solo authorship, does
  not claim a team, and does not enumerate responsibilities.

**Deliberately left NULL: `responsibilities`.** Writing "I designed the schema, ran
the deployment, wrote the RLS policies…" would be invention. `needs_review` stays
`true` on all three rows and each `review_note` now names precisely what is missing.

---

## 5. Still unavailable / needs owner confirmation

| Project | Field | Why |
|---|---|---|
| all three | `responsibilities` | no evidence; owner to write |
| all three | `team_size`, `duration_label_*`, `started_at`, `completed_at`, `year_label` | not observable from outside |
| all three | `repository_url` | no public repository found |
| all three | adoption, users, downloads, revenue | unobservable; may never be published without a source |
| KruSmart | authenticated UI screenshots; per-module behaviour | no test account was supplied |
| KruSmart | whether the Gemini and reCAPTCHA integrations are user-facing features | CSP proves allow-listing only |
| Library | admin CMS, roles, audit logging, RLS design, search implementation | `/admin/` is robots-disallowed and was not accessed |
| Library | whether the 2026-07-31 collection snapshot should keep being shown as it grows | the metric is dated in its source note; refresh or retire it |
| Storage | backend, topology, Zima OS / on-prem, upload pipeline, backup design | not published in any form |

To fill these in: open `/admin/projects`, pick the project, complete the fields,
then clear `needs_review` and its note.

---

## 6. Reproducing the evidence

```bash
# headers + CSP for all three
for u in https://www.krusmart.org/ https://library.ptec.edu.kh/ https://storage-ptec.online/; do
  curl -sS -D - -o /dev/null -L "$u"
done

# KruSmart module registry, tier rules, auth flow
curl -sS https://www.krusmart.org/core/app.js
curl -sS https://www.krusmart.org/core/access-control.js
curl -sS https://www.krusmart.org/manifest.json

# Library self-description, routes, PWA
curl -sS https://library.ptec.edu.kh/llms.txt
curl -sS https://library.ptec.edu.kh/robots.txt
curl -sS https://library.ptec.edu.kh/sitemap.xml
curl -sS https://library.ptec.edu.kh/manifest.webmanifest
curl -sSI https://library.ptec.edu.kh/sw.js

# Storage — root only, no path enumeration
curl -sS https://storage-ptec.online/
```

Re-run the media capture with `node scripts/import-project-media.mjs` (see §12 of
that script's header for the privacy rules it enforces).
