-- ═══════════════════════════════════════════════════════════════════════════
--  0016 — Full bilingual case studies for the three live platforms
--
--  Context
--    Migration 0015 published KruSmart, the PTEC Digital Library and PTEC
--    Storage with the thin content the seed could justify from a single HTTP
--    response. Since then each platform was researched properly against its own
--    public surface — headers, CSP allowlists, robots.txt, sitemap.xml,
--    llms.txt, the PWA manifests, the JSON-LD on real records, and (for
--    KruSmart) the module registry, tier rules and auth flow that the app ships
--    as public static JavaScript.
--
--    Every claim written here is traceable to one of those sources. The evidence
--    ledger lives in docs/PROJECT-RESEARCH-2026-07-31.md, one row per claim,
--    with its source and confidence.
--
--  What this adds
--    • The full case-study prose in English and Khmer.
--    • Structured project_features rows (10 / 11 / 7).
--    • project_metrics rows — verified only, each carrying the source that
--      establishes it. The CHECK constraint already refuses a verified metric
--      without a source note; nothing here needs to be argued into it.
--    • A corrected display order: Library, KruSmart, Storage.
--
--  What this deliberately does NOT do
--    • Invent responsibilities. `responsibilities` stays NULL on all six
--      translations. So do `lessons` and `research` — nobody outside the owner's
--      head can source those.
--    • Invent numbers. No user counts, no downloads, no adoption, no revenue,
--      no Lighthouse scores. The only figures present are counts the platforms
--      publish about themselves or that are countable from a public artefact,
--      and each is dated.
--    • Guess a technology. The technology links are unchanged from the seed;
--      each one is evidenced by a response header or a CSP entry.
--    • Clear `needs_review`. It stays true on all three. The review_note is
--      rewritten to name exactly what is still missing, which is a shorter list
--      than it was.
--    • Touch media. Screenshots are uploaded by scripts/import-project-media.mjs
--      — image binaries do not belong in a migration.
--
--  Idempotence and edit safety
--    Every statement is guarded on the project still being in its imported
--    state: `needs_review` is true AND the review note is still one this import
--    or the seed wrote (both start with "Verified from"). The moment an admin
--    reviews a project and clears that flag, this import stops touching it.
--    Re-running is safe: the guard still matches, and the writes are upserts or
--    guarded replaces.
--
--  Why this is a function rather than a flat script
--    `supabase db reset` applies migrations *before* seed.sql. On a fresh
--    database the projects table is therefore still empty while this migration
--    runs, and a flat script would silently import nothing. Packaging the
--    content as a callable function lets both paths apply exactly the same
--    content: this migration calls it for existing databases, and seed.sql
--    calls it again after inserting the project rows. One source of truth, no
--    thousand-line duplicate to drift out of sync.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Guard ───────────────────────────────────────────────────────────────────
-- One definition of "this row is still auto-imported and safe to overwrite", so
-- no statement in the import can drift from the others.
create or replace function public.is_unreviewed_project_import(p_slug text)
returns boolean
language sql
stable
set search_path = ''
as $guard$
  select exists (
    select 1
      from public.projects p
     where p.slug = p_slug
       and p.deleted_at is null
       and p.needs_review
       and (p.review_note is null or p.review_note like 'Verified from%')
  );
$guard$;

comment on function public.is_unreviewed_project_import is
  'True while a project still carries its auto-imported content. Clearing needs_review makes the content import skip the row for good.';

-- ── The import ──────────────────────────────────────────────────────────────
create or replace function public.import_project_case_studies()
returns void
language plpgsql
as $fn$
begin

-- ═══════════════════════════════════════════════════════════════════════════
--  1. Display order
--
--  Library first: it is the largest platform and the one KruSmart and Storage
--  are read against. Storage last: it is deliberately the least visible.
-- ═══════════════════════════════════════════════════════════════════════════

update public.projects p
   set sort_order = v.sort_order
  from (values
    ('ptec-digital-library', 1),
    ('krusmart',             2),
    ('ptec-storage',         3)
  ) as v(slug, sort_order)
 where p.slug = v.slug
   and public.is_unreviewed_project_import(p.slug);

-- ═══════════════════════════════════════════════════════════════════════════
--  2. Case studies — English
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.project_translations (
  project_id, locale, title, summary, overview, problem, target_users, goals,
  my_role, constraints, ux_decisions, architecture, database_decisions,
  key_features, security_notes, accessibility_notes, seo_notes,
  performance_notes, challenges, solution, results, next_steps,
  seo_title, seo_description, translation_state
)
select p.id, 'en'::public.content_locale,
       t.title, t.summary, t.overview, t.problem, t.target_users, t.goals,
       t.my_role, t.constraints, t.ux_decisions, t.architecture,
       t.database_decisions, t.key_features, t.security_notes,
       t.accessibility_notes, t.seo_notes, t.performance_notes, t.challenges,
       t.solution, t.results, t.next_steps, t.seo_title, t.seo_description,
       'complete'::public.translation_state
  from public.projects p
  join (values

  -- ── PTEC Digital Library ──────────────────────────────────────────────────
  ('ptec-digital-library',
   'PTEC Digital Library',
   'A bilingual academic repository for Phnom Penh Teacher Education College — books, theses, publications and curated learning paths, readable online, installable as an app and searchable in Khmer and English.',
   -- overview
   'The PTEC Digital Library publishes the college''s teaching and research collection at library.ptec.edu.kh. It covers five kinds of resource — digital books, the physical library catalogue, student theses, academic publications and curated learning paths — and documents the physical library alongside them, so the on-site and online services read as one service rather than two.

Every public section exists twice, once in English and once under a /km prefix, with reciprocal hreflang and the English URL as canonical. The site installs as a Progressive Web App and keeps saved books readable offline.',
   -- problem
   'Academic material at a teacher-education college is scattered: print on shelves, syllabuses on personal drives, theses bound once and rarely opened again. A student who cannot find a text is in the same position as a student for whom it does not exist. And catalogue records that live only in a back-office system solve the librarian''s problem, not the reader''s.',
   -- target_users
   'Student teachers, lecturers and librarians at PTEC, and anyone researching Cambodian teacher education. The public sections are open without an account; a reader account adds a profile, saved lists and offline reading.',
   -- goals
   'The library states its own mission in the machine-readable guide it publishes at /llms.txt: to preserve, organise and share the college''s teaching and research materials, and to improve access to teacher-education resources, student research and catalogue information for the PTEC community and the wider public. The platform is built to serve that mission to three audiences at once — human readers, search engines and answer engines.',
   -- my_role
   'I build and maintain this platform as a full-stack developer. What follows describes the system as it runs today; the detailed breakdown of who did what across the project''s history is deliberately not asserted here.',
   -- constraints
   'Two constraints shape most of the visible decisions. The collection is mixed-rights — some items are the college''s own and freely readable, others are bibliographic landing pages for third-party journal articles whose full text sits behind a publisher paywall — so the platform cannot treat "has a record" and "can be downloaded" as the same thing. And readers are on phones and variable connections, which is why the site is installable, caches through a service worker, and treats "saved for offline" as a route of its own rather than a browser feature.',
   -- ux_decisions
   'The catalogue is organised by what a reader is looking for rather than by how the data is stored: Books, Theses, Publications, Learning Paths and the physical catalogue are separate entry points, each with its own listing and detail layout. A book page opens on its description, with reading and reviews as sibling tabs, so the first thing a reader sees is whether this is the right book. Learning paths exist because a list of a hundred books is not a curriculum — they order books and theses into a sequence around a real teacher-training topic. The language switcher sits in the header on every page, and the mobile bar keeps Home, Digital Library, Search, News and Profile within thumb reach.',
   -- architecture
   'A Next.js application deployed on Vercel. Pages are prerendered and revalidated on a 300-second window — visible on the response as x-nextjs-prerender and x-nextjs-stale-time — so a catalogue page is served from cache without going stale for long. Supabase provides the database and a realtime channel. File delivery is deliberately not the application''s job: covers and documents come from Cloudflare R2 and Vercel Blob, fronted by a separate storage host, so download traffic never competes with page rendering. Sign-in uses Google OAuth, and Cloudflare Turnstile guards the forms.',
   -- database_decisions
   'The record model separates a resource from its people and its subjects: authors and subjects have their own browsable pages rather than sitting as free text on the item, which is what makes "more by this author" and "more in this subject" possible at all. Academic identifiers — DOI, ORCID, ISSN — are validated before publication, so any identifier that reaches a public page is well formed. Rights live on the item too: each record carries its own licence and free-to-read flag, and the platform states plainly that it is the provider of most hosted books, not their publisher.',
   -- key_features
   'The features below are the ones a reader actually touches. Each is verifiable from the public site.',
   -- security_notes
   'The response headers are strict and deliberate: frame-ancestors ''none'' with X-Frame-Options DENY, object-src ''none'', form-action ''self'', base-uri ''self'', HSTS with preload, and a Content-Security-Policy that enumerates every permitted origin for scripts, images, fonts and network calls instead of relying on wildcards. Cross-Origin-Opener-Policy is same-origin-allow-popups — tight enough to isolate the page, loose enough for the Google sign-in popup to work — with Cross-Origin-Resource-Policy same-origin and X-Permitted-Cross-Domain-Policies none. robots.txt keeps the administrative, API, dashboard, authentication and private-list routes out of the index.',
   -- accessibility_notes
   'Every page opens with a skip-to-content link. Both language versions are marked at the document level and carry reciprocal hreflang, so assistive technology switches voice instead of reading Khmer through an English speech engine. Links that leave the site announce that they open in a new tab, and the persistent mobile bar keeps the primary destinations at a comfortable touch size.',
   -- seo_notes
   'Technical SEO is treated as a feature rather than an afterthought. Pages emit structured data — Library and EducationalOrganization for the institution, WebSite with a SearchAction, Book and ScholarlyArticle for individual records, BreadcrumbList for position, FAQPage on the home page. The sitemap lists both language versions of every URL with reciprocal hreflang annotations. Beyond conventional SEO the site publishes an llms.txt: a plain-text guide for answer engines stating the entity, the mission, the resource types, the current collection counts, the rights position and how to cite an item — and robots.txt grants a named allowlist to AI crawlers for the public sections while keeping admin, API and account routes out.',
   -- performance_notes
   'Catalogue pages are prerendered and revalidated on a 300-second window rather than rendered per request, so the common path is a cache hit. Cover images are served as pre-generated WebP derivatives from object storage rather than resized on demand. A service worker caches the shell and saved books, which is what makes the site usable on an intermittent connection rather than only on a fast one.',
   -- challenges
   'The hardest problem here is not technical. A library that hosts other people''s books has to be precise about what it is: PTEC is the provider of most hosted books, not their publisher, and some publications are citation-only landing pages for paywalled articles. The platform encodes that distinction on each record — its own licence and free-to-read flag — and states it explicitly in its public guidance, so neither a reader nor a crawler is misled about what can actually be downloaded.',
   -- solution
   'One bilingual site carrying the whole collection — digital and physical, the college''s own work and hosted material — with each item''s rights stated on the item. Readers browse and search without an account; an account adds saved lists and offline reading. Everything crawlable is described in structured data and in a machine-readable guide, so the collection is findable from outside the site as well as inside it.',
   -- results
   'The platform is live at library.ptec.edu.kh and serves the college''s collection publicly in Khmer and English. As of 31 July 2026 it publishes 114 digital resources, 7 active physical catalogue records and 4 learning paths — figures the site itself reports in its public llms.txt. It installs as an app, keeps saved books readable offline, and describes its public sections well enough that search and answer engines can cite individual records rather than only the home page.',
   -- next_steps
   'The thesis and publication collections are at an early stage next to the published books, so the immediate work is depth rather than new surface: more student research online, and more curated paths across the material that is already there.',
   'PTEC Digital Library — Bilingual Academic Repository',
   'A bilingual digital library for Phnom Penh Teacher Education College — books, theses, publications and learning paths, built with Next.js and Supabase.'),

  -- ── KruSmart ──────────────────────────────────────────────────────────────
  ('krusmart',
   'KruSmart — Digital Teacher Assistant',
   'A Khmer-first teaching assistant for Cambodian classrooms: 26 modules covering enrolment, attendance, scoring, ranking, reporting and parent communication, in one installable web app.',
   -- overview
   'KruSmart (ជំនួយការគ្រូបង្រៀនឌីជីថល) is a digital teacher assistant built for Cambodian classrooms. After signing in, a teacher gets a searchable launcher of 26 modules covering the paperwork a school year actually produces: enrolling students, taking attendance, entering homework and monthly scores, producing rankings and honour rolls, printing ID cards and certificates, keeping tracking books, inventories and cleaning rotas, and messaging guardians.

The interface is Khmer first. English appears only as a gloss in parentheses where the term genuinely is English — Email, Password, Check-in — rather than as a second language to switch into.',
   -- problem
   'A teacher''s records are the least glamorous and most load-bearing part of the job: the roster, the attendance register, the score sheet, the ranking, the report that goes home to parents. Kept in a paper book they cannot be searched, backed up or totalled. Kept in a spreadsheet they break on the first structural change and cannot be used from the phone that is actually in the teacher''s hand. Neither survives being shared.',
   -- target_users
   'Teachers in Cambodian schools, working mostly from a phone. An account carries a school reference, so a teacher''s data is scoped to their own classes.',
   -- goals
   'The product states its goal in its own metadata: to make managing student data, scores and attendance in Cambodia faster and easier. In practice that means covering the whole school year rather than one task — the modules that produce documents (rankings, honour rolls, ID cards, certificates, parent reports) matter as much as the modules that capture data.',
   -- my_role
   'KruSmart credits me as its developer from inside the product: the account menu''s "About the developer" entry links to my portfolio. I work on it as a product designer and developer. The detailed split of responsibilities is not asserted here beyond what the live product itself shows.',
   -- constraints
   'Two constraints run through the design. Teachers work in Khmer, so Khmer is the interface language and Khmer web typography — Kantumruy Pro and Moul — is loaded deliberately rather than left to a system fallback. And the app is used on a phone, often on mobile data, so it installs as a PWA and the launcher is a searchable grid rather than a deep menu tree.',
   -- ux_decisions
   'The first screen after sign-in is a searchable grid of modules, not a dashboard of numbers — a teacher opening the app already has a task in mind, and search reaches it in one step. Premium modules stay visible to free users and open an upgrade dialog rather than disappearing, so the product never hides what it can do. Sign-up is a single form with live feedback: a password-strength meter that updates as you type, an immediate confirm-password mismatch warning, an explicit terms checkbox and an arithmetic challenge in place of an opaque widget. Verification is a six-digit code in a modal rather than a round trip to an email client. Light and dark themes are resolved before first paint, so there is no flash of the wrong theme.',
   -- architecture
   'A client-rendered application on Netlify with Firebase behind it — Firebase Authentication for accounts, Cloud Firestore for data, imported as ES modules directly from Google''s CDN rather than bundled. There is no build step between source and browser: /core/app.js holds the module registry, /core/auth.js the sign-in flow, /core/access-control.js the subscription rules. Paid upgrades go through a separate KHQR service on Render — KHQR is Cambodia''s national QR payment standard — which keeps payment handling out of the application. Transactional email goes through EmailJS, and the Content-Security-Policy also allowlists Google Analytics, reCAPTCHA and the Google Gemini API.',
   -- database_decisions
   'Data lives in Cloud Firestore under a single application namespace, keyed by the signed-in teacher''s uid, with the school reference stored on the teacher record — that link is what scopes a teacher to their own classes and what the geofenced check-in measures against. Subscription state is stored on the user document and re-read from Firestore every time, never from local storage. The access-control module says so in its first line, and that is the right instinct: a tier cached in the browser is a tier the browser can edit.',
   -- key_features
   'Every feature below is registered in the application''s own module list or its access-control rules.',
   -- security_notes
   'Registration is guarded by an arithmetic bot challenge, a password-strength requirement and explicit terms acceptance, then confirmed by a six-digit code before the account is usable. Entitlements are resolved from the Firestore user document rather than from local storage, and a banned role is a first-class state alongside the subscription tiers. The response carries HSTS with preload, X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, a referrer policy, object-src ''none'', base-uri ''self'' and a Content-Security-Policy that pins every third-party origin the app may talk to. On the entry document, Permissions-Policy switches off camera, microphone and geolocation.',
   -- accessibility_notes
   'The page opens with a skip-to-content link written in both Khmer and English. Decorative icons are hidden from the accessibility tree, the upgrade dialog is a real dialog with role and modal semantics, and password fields carry visible show/hide controls labelled in Khmer. Dark mode is a genuine second theme rather than an inverted filter.',
   -- seo_notes
   'KruSmart is a signed-in product, so its public surface is one page and its SEO job is narrow: say what the product is, in Khmer, to people searching in Khmer. The entry document carries a Khmer title and description, Khmer and English keywords, Open Graph tags and a theme colour, and the PWA manifest gives the installed app its own name and icon.',
   -- performance_notes
   'The app ships no framework bundle: HTML, CSS and ES modules served from Netlify''s edge, with Firebase and the icon set pulled from CDNs. The sign-in module starts loading its email dependency in parallel with the first Firestore read rather than after it, and the theme is resolved before first paint. The result is a first screen that does not wait for a JavaScript framework to boot — which matters most on the mid-range phones the product is used on.',
   -- challenges
   'Transactional email is the interesting one. Verification codes have to arrive reliably from a free tier with a hard monthly quota, so the app does not depend on a single sender: it keeps a pool of EmailJS accounts in Firestore, tries them in turn, and fails over when one is exhausted — reporting a clear message to the teacher and the administrator when the whole pool is spent, rather than silently dropping the code.',
   -- solution
   'One installable Khmer app that covers the school year end to end. A free tier gives every teacher the core roster, scoring, analysis and reporting modules; a trial and a paid premium tier unlock the output-heavy ones — seating-plan attendance, monthly registers, printable rankings, honour rolls, ID cards and certificates. Upgrades are paid through KHQR, which is the payment method teachers already use.',
   -- results
   'KruSmart is live at krusmart.org and in daily use as a signed-in product. It currently registers 26 teacher-facing modules, of which 9 sit behind an active trial or subscription, across a five-state access model. It installs as an app on a phone and ships light and dark themes. Adoption figures are deliberately absent — none of them can be verified from outside the product.',
   null,
   'KruSmart — Khmer-First Digital Teaching Platform',
   'A Khmer-first teaching assistant for Cambodian classrooms: 26 modules for enrolment, attendance, scoring, reporting and parent communication.'),

  -- ── PTEC Storage ──────────────────────────────────────────────────────────
  ('ptec-storage',
   'PTEC Storage',
   'The file-delivery service behind the PTEC Digital Library — a separate origin, a deny-by-default policy, and a landing page that says only what it is.',
   -- overview
   'PTEC Storage is the file-delivery layer for library.ptec.edu.kh. Its landing page states that and nothing else: "File delivery service for library.ptec.edu.kh. There is nothing to see here." No catalogue, no navigation, nothing to browse — and a noindex directive so it stays out of search results.

That is the whole design. This is infrastructure, and the most useful thing infrastructure can do is stay out of the way.',
   -- problem
   'A digital library is only as good as its file delivery. Serving book scans and theses from the application itself ties download traffic to page traffic: one large file competes with every page render, and the caching strategy that suits a catalogue page — short revalidation, always current — is exactly the wrong one for a large PDF that never changes.',
   -- target_users
   'Directly, the library application. Indirectly, every reader of the PTEC Digital Library — none of whom ever sees this service by name.',
   -- goals
   'One job, done narrowly: deliver the library''s files over a separate origin, with caching and hardening tuned for static assets rather than for an application.',
   -- my_role
   'I work on this service as part of the PTEC Digital Library platform, on the infrastructure side. Its internal design — storage backend, topology and operational tooling — is intentionally not published here.',
   -- constraints
   'The service has no user interface to protect and no reason to be crawled. That is a constraint worth having: it allows the origin to be locked down far harder than an application ever could be.',
   -- ux_decisions
   'There is exactly one interface decision, and it is to have almost no interface. The landing page names the service, names the site it serves, and says there is nothing else here — which is more useful to someone who lands on it by accident than either a redirect or a 404 would be.',
   -- architecture
   'A separate origin from the library application, served through Cloudflare. The library treats it as two things at once and its Content-Security-Policy says so: storage-ptec.online and its subdomains are permitted image sources, and api.storage-ptec.online is a permitted connect-src origin. Splitting delivery from rendering lets the two be cached, scaled and hardened on their own terms.',
   null, -- database_decisions: not observable, not guessed
   -- key_features
   'This service is defined more by what it refuses than by what it offers.',
   -- security_notes
   'The policy is deny-by-default and the strictest of the three platforms: default-src ''none'', img-src ''self'', frame-ancestors ''none'', base-uri ''none'', form-action ''none'' — no scripts, no framing, no forms, no base-tag rewriting. Alongside it: HSTS, X-Content-Type-Options nosniff, X-Frame-Options DENY, and a Permissions-Policy that switches off camera, microphone, geolocation, payment and USB. Because there is no UI to protect, everything that is not file delivery is simply turned off. Network error reporting is configured, so failures are visible rather than silent.',
   -- accessibility_notes
   'The landing page is one heading and one sentence in a system font stack at default sizes — legible without CSS and trivial for a screen reader to read out. There is nothing else on it to make accessible.',
   -- seo_notes
   'Deliberately invisible: the landing page is marked noindex. A file host has no business competing with the library it serves for that library''s own search results.',
   -- performance_notes
   'Responses are cached publicly for five minutes and carry Last-Modified, so a repeat request revalidates cheaply instead of re-downloading. Accept-Ranges: bytes is advertised, which is what lets a reader resume an interrupted download or a viewer seek into a large PDF rather than fetching all of it first. Cloudflare fronts the origin, and HTTP/3 is advertised.',
   -- challenges
   'Separating file delivery from an application is easy to describe and easy to get wrong. The split only pays off if the second origin is genuinely independent — its own caching, its own policy, its own failure mode — rather than a proxy that inherits the first one''s constraints.',
   -- solution
   'A dedicated origin, fronted by Cloudflare, that does one thing: serve the library''s files. It is referenced by the library as both an asset host and an API origin, cached for static delivery, hardened to deny everything it does not need, and kept out of search results entirely.',
   -- results
   'The service is live, delivers the PTEC Digital Library''s assets from an origin of their own, and ships the most restrictive Content-Security-Policy of the three platforms in this portfolio. Volume figures are not published — none of them can be verified from outside.',
   null,
   'PTEC Storage — File Delivery for a Digital Library',
   'A dedicated Cloudflare-fronted file-delivery service for the PTEC Digital Library, hardened with a deny-by-default Content-Security-Policy.')

  ) as t(proj_slug, title, summary, overview, problem, target_users, goals,
         my_role, constraints, ux_decisions, architecture, database_decisions,
         key_features, security_notes, accessibility_notes, seo_notes,
         performance_notes, challenges, solution, results, next_steps,
         seo_title, seo_description)
    on t.proj_slug = p.slug
 where public.is_unreviewed_project_import(p.slug)
on conflict (project_id, locale) do update set
  title               = excluded.title,
  summary             = excluded.summary,
  overview            = excluded.overview,
  problem             = excluded.problem,
  target_users        = excluded.target_users,
  goals               = excluded.goals,
  my_role             = excluded.my_role,
  constraints         = excluded.constraints,
  ux_decisions        = excluded.ux_decisions,
  architecture        = excluded.architecture,
  database_decisions  = excluded.database_decisions,
  key_features        = excluded.key_features,
  security_notes      = excluded.security_notes,
  accessibility_notes = excluded.accessibility_notes,
  seo_notes           = excluded.seo_notes,
  performance_notes   = excluded.performance_notes,
  challenges          = excluded.challenges,
  solution            = excluded.solution,
  results             = excluded.results,
  next_steps          = excluded.next_steps,
  seo_title           = excluded.seo_title,
  seo_description     = excluded.seo_description,
  translation_state   = excluded.translation_state;

-- ═══════════════════════════════════════════════════════════════════════════
--  3. Case studies — Khmer
--
--  Written as Khmer, not translated word-for-word from the English. Established
--  technical terms stay in English (Next.js, Supabase, PWA, SEO, API, CSP,
--  Firebase, Firestore, KHQR, Cloudflare) because that is how they are used in
--  practice; where a term needs unpacking, the Khmer explains it rather than
--  inventing a calque nobody uses.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.project_translations (
  project_id, locale, title, summary, overview, problem, target_users, goals,
  my_role, constraints, ux_decisions, architecture, database_decisions,
  key_features, security_notes, accessibility_notes, seo_notes,
  performance_notes, challenges, solution, results, next_steps,
  seo_title, seo_description, translation_state
)
select p.id, 'km'::public.content_locale,
       t.title, t.summary, t.overview, t.problem, t.target_users, t.goals,
       t.my_role, t.constraints, t.ux_decisions, t.architecture,
       t.database_decisions, t.key_features, t.security_notes,
       t.accessibility_notes, t.seo_notes, t.performance_notes, t.challenges,
       t.solution, t.results, t.next_steps, t.seo_title, t.seo_description,
       'complete'::public.translation_state
  from public.projects p
  join (values

  -- ── បណ្ណាល័យឌីជីថល PTEC ───────────────────────────────────────────────────
  ('ptec-digital-library',
   'បណ្ណាល័យឌីជីថល PTEC',
   'ឃ្លាំងឯកសារសិក្សាពីរភាសាសម្រាប់វិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ — សៀវភៅ និក្ខេបបទ ស្នាដៃស្រាវជ្រាវ និងផ្លូវសិក្សាដែលបានរៀបចំ អាចអានតាមអ៊ីនធឺណិត ដំឡើងជាកម្មវិធី និងស្វែងរកបានទាំងភាសាខ្មែរ និងអង់គ្លេស។',
   -- overview
   'បណ្ណាល័យឌីជីថល PTEC បង្ហាញឯកសារបង្រៀន និងស្រាវជ្រាវរបស់វិទ្យាស្ថាននៅ library.ptec.edu.kh។ វាគ្របដណ្តប់ឯកសារប្រាំប្រភេទ — សៀវភៅឌីជីថល កាតាឡុកបណ្ណាល័យរូបវន្ត និក្ខេបបទនិស្សិត ស្នាដៃស្រាវជ្រាវ និងផ្លូវសិក្សាដែលបានរៀបចំ — ហើយក៏ចងក្រងព័ត៌មានអំពីបណ្ណាល័យរូបវន្តទៀតផង ដូច្នេះសេវាតាមអ៊ីនធឺណិត និងសេវានៅនឹងកន្លែងក្លាយជាសេវាតែមួយ។

គ្រប់ផ្នែកសាធារណៈមានទាំងភាសាអង់គ្លេស និងភាសាខ្មែរនៅក្រោម /km ដោយមាន hreflang យោងគ្នាទៅវិញទៅមក ហើយ URL អង់គ្លេសជា canonical។ គេហទំព័រអាចដំឡើងជា PWA និងរក្សាសៀវភៅដែលបានរក្សាទុកឱ្យអានបានពេលគ្មានអ៊ីនធឺណិត។',
   -- problem
   'ឯកសារសិក្សានៅវិទ្យាស្ថានបណ្តុះបណ្តាលគ្រូខ្ចាត់ខ្ចាយ៖ សៀវភៅបោះពុម្ពនៅលើធ្នើ កម្មវិធីសិក្សានៅក្នុងឧបករណ៍ផ្ទាល់ខ្លួន និក្ខេបបទដែលចងក្រងម្តងហើយកម្រត្រូវបានបើកមើលម្តងទៀត។ និស្សិតដែលរកឯកសារមិនឃើញ ស្ថិតក្នុងស្ថានភាពដូចគ្នានឹងឯកសារនោះមិនមានដែរ។ ហើយកំណត់ត្រាកាតាឡុកដែលមានតែក្នុងប្រព័ន្ធខាងក្នុង ដោះស្រាយបញ្ហារបស់បណ្ណារក្ស មិនមែនរបស់អ្នកអានទេ។',
   -- target_users
   'គរុនិស្សិត សាស្ត្រាចារ្យ និងបណ្ណារក្សនៅ PTEC ព្រមទាំងអ្នកស្រាវជ្រាវអំពីការបណ្តុះបណ្តាលគ្រូនៅកម្ពុជា។ ផ្នែកសាធារណៈបើកចំហដោយមិនចាំបាច់មានគណនី។ គណនីអ្នកអានបន្ថែមប្រវត្តិរូប បញ្ជីរក្សាទុក និងការអានពេលគ្មានអ៊ីនធឺណិត។',
   -- goals
   'បណ្ណាល័យប្រកាសបេសកកម្មរបស់ខ្លួននៅក្នុងឯកសារ /llms.txt ដែលអាចអានដោយម៉ាស៊ីន៖ រក្សាទុក រៀបចំ និងចែករំលែកឯកសារបង្រៀន និងស្រាវជ្រាវរបស់វិទ្យាស្ថាន និងបង្កើនលទ្ធភាពទទួលបានឯកសារបណ្តុះបណ្តាលគ្រូ ស្នាដៃស្រាវជ្រាវនិស្សិត និងព័ត៌មានកាតាឡុក សម្រាប់សហគមន៍ PTEC និងសាធារណជនទូទៅ។ វេទិកានេះត្រូវបានបង្កើតឡើងដើម្បីបម្រើបេសកកម្មនោះដល់អ្នកទស្សនាបីប្រភេទក្នុងពេលតែមួយ — អ្នកអានជាមនុស្ស ម៉ាស៊ីនស្វែងរក និងប្រព័ន្ធ AI ដែលឆ្លើយសំណួរ។',
   -- my_role
   'ខ្ញុំបង្កើត និងថែទាំវេទិកានេះក្នុងនាមជាអ្នកអភិវឌ្ឍពេញលេញ (full-stack)។ អត្ថបទខាងក្រោមរៀបរាប់អំពីប្រព័ន្ធដូចដែលវាដំណើរការសព្វថ្ងៃ។ ការបែងចែកលម្អិតថានរណាធ្វើអ្វីពេញមួយដំណើរការគម្រោង មិនត្រូវបានអះអាងនៅទីនេះទេ។',
   -- constraints
   'កត្តាកំណត់ពីរបានកំណត់ការសម្រេចចិត្តភាគច្រើនដែលមើលឃើញ។ ទីមួយ ឯកសារសម្រាំងមានសិទ្ធិចម្រុះ — ខ្លះជាស្នាដៃរបស់វិទ្យាស្ថានផ្ទាល់ ដែលអានបានដោយសេរី ខ្លះទៀតគ្រាន់តែជាទំព័រព័ត៌មានគន្ថនិទ្ទេសសម្រាប់អត្ថបទទស្សនាវដ្តីរបស់ភាគីទីបី ដែលអត្ថបទពេញស្ថិតនៅក្រោយរបាំងបង់ប្រាក់ — ដូច្នេះប្រព័ន្ធមិនអាចចាត់ទុក «មានកំណត់ត្រា» និង «ទាញយកបាន» ជារឿងតែមួយឡើយ។ ទីពីរ អ្នកអានប្រើទូរស័ព្ទ និងអ៊ីនធឺណិតមិនស្ថិតស្ថេរ ដែលជាហេតុផលឱ្យគេហទំព័រអាចដំឡើងបាន ប្រើ service worker សម្រាប់ cache និងចាត់ទុក «រក្សាទុកសម្រាប់អានក្រៅបណ្តាញ» ជាទំព័រដាច់ដោយឡែក។',
   -- ux_decisions
   'កាតាឡុកត្រូវបានរៀបចំតាមអ្វីដែលអ្នកអានកំពុងស្វែងរក មិនមែនតាមរបៀបដែលទិន្នន័យត្រូវបានរក្សាទុកទេ៖ សៀវភៅ និក្ខេបបទ ស្នាដៃស្រាវជ្រាវ ផ្លូវសិក្សា និងកាតាឡុករូបវន្ត សុទ្ធតែជាច្រកចូលដាច់ដោយឡែក។ ទំព័រសៀវភៅបើកចេញជាមួយការពិពណ៌នាមុនគេ ដោយមានផ្ទាំងអាន និងផ្ទាំងមតិយោបល់នៅជាប់គ្នា ដូច្នេះអ្វីដែលអ្នកអានឃើញមុនគេគឺថាតើនេះជាសៀវភៅត្រឹមត្រូវឬអត់។ ផ្លូវសិក្សាមានវត្តមានព្រោះបញ្ជីសៀវភៅរាប់រយក្បាលមិនមែនជាកម្មវិធីសិក្សាទេ — វារៀបសៀវភៅ និងនិក្ខេបបទជាលំដាប់ជុំវិញប្រធានបទបណ្តុះបណ្តាលគ្រូជាក់ស្តែង។ ប៊ូតុងប្តូរភាសាស្ថិតនៅលើក្បាលទំព័រគ្រប់ទំព័រ ហើយរបារខាងក្រោមលើទូរស័ព្ទរក្សា ទំព័រដើម បណ្ណាល័យឌីជីថល ស្វែងរក ព័ត៌មាន និងប្រវត្តិរូប ឱ្យនៅជិតមេដៃ។',
   -- architecture
   'កម្មវិធី Next.js ដាក់ដំណើរការលើ Vercel។ ទំព័រត្រូវបានបង្កើតជាមុន (prerender) និងធ្វើបច្ចុប្បន្នភាពក្នុងរយៈពេល ៣០០ វិនាទី — មើលឃើញលើ header ជា x-nextjs-prerender និង x-nextjs-stale-time — ដូច្នេះទំព័រកាតាឡុកបម្រើពី cache ដោយមិនចាស់យូរពេក។ Supabase ផ្តល់មូលដ្ឋានទិន្នន័យ និងឆានែល realtime។ ការបញ្ជូនឯកសារមិនមែនជាការងាររបស់កម្មវិធីទេ៖ គម្របសៀវភៅ និងឯកសារមកពី Cloudflare R2 និង Vercel Blob ដោយមានម៉ាស៊ីនផ្ទុកដាច់ដោយឡែកនៅខាងមុខ ដូច្នេះចរាចរណ៍ទាញយកមិនប្រកួតជាមួយការបង្ហាញទំព័រ។ ការចូលគណនីប្រើ Google OAuth ហើយ Cloudflare Turnstile ការពារទម្រង់បំពេញ។',
   -- database_decisions
   'គំរូកំណត់ត្រាបែងចែកឯកសារចេញពីអ្នកនិពន្ធ និងប្រធានបទរបស់វា៖ អ្នកនិពន្ធ និងប្រធានបទមានទំព័ររុករករៀងៗខ្លួន មិនមែនត្រឹមអត្ថបទសេរីនៅលើកំណត់ត្រាទេ ដែលនេះជាហេតុធ្វើឱ្យ «ស្នាដៃផ្សេងទៀតរបស់អ្នកនិពន្ធនេះ» និង «ឯកសារផ្សេងទៀតក្នុងប្រធានបទនេះ» អាចធ្វើទៅបាន។ លេខសម្គាល់សិក្សា — DOI, ORCID, ISSN — ត្រូវបានផ្ទៀងផ្ទាត់មុនបោះផ្សាយ ដូច្នេះលេខសម្គាល់ណាដែលឡើងដល់ទំព័រសាធារណៈ គឺមានទម្រង់ត្រឹមត្រូវ។ សិទ្ធិក៏ស្ថិតនៅលើកំណត់ត្រាដែរ៖ ធាតុនីមួយៗមានអាជ្ញាបណ្ណ និងស្ថានភាពអានដោយសេរីរបស់ខ្លួន ហើយវេទិកាបញ្ជាក់ច្បាស់ថាខ្លួនជា «អ្នកផ្តល់» សៀវភៅភាគច្រើន មិនមែនជា «អ្នកបោះពុម្ពផ្សាយ» ទេ។',
   -- key_features
   'មុខងារខាងក្រោមគឺជាមុខងារដែលអ្នកអានប្រើពិតប្រាកដ។ មុខងារនីមួយៗអាចផ្ទៀងផ្ទាត់បានពីគេហទំព័រសាធារណៈ។',
   -- security_notes
   'ក្បាលឆ្លើយតបត្រូវបានកំណត់តឹងរឹងដោយចេតនា៖ frame-ancestors ''none'' ជាមួយ X-Frame-Options DENY, object-src ''none'', form-action ''self'', base-uri ''self'', HSTS ជាមួយ preload និង Content-Security-Policy ដែលរាយបញ្ជីដើមកំណើតដែលអនុញ្ញាតទាំងអស់ ជាជាងពឹងលើ wildcard។ Cross-Origin-Opener-Policy គឺ same-origin-allow-popups — តឹងល្មមដើម្បីញែកទំព័រចេញ ប៉ុន្តែនៅតែអនុញ្ញាតឱ្យ popup ចូលគណនី Google ដំណើរការ — រួមជាមួយ Cross-Origin-Resource-Policy same-origin និង X-Permitted-Cross-Domain-Policies none។ robots.txt រារាំងទំព័ររដ្ឋបាល API ផ្ទាំងគ្រប់គ្រង ការផ្ទៀងផ្ទាត់គណនី និងបញ្ជីឯកជន មិនឱ្យចូលក្នុងលិបិក្រម។',
   -- accessibility_notes
   'គ្រប់ទំព័របើកចេញជាមួយតំណ «រំលងទៅមាតិកា»។ ភាសាទាំងពីរត្រូវបានសម្គាល់នៅកម្រិតឯកសារ និងមាន hreflang យោងគ្នាទៅវិញទៅមក ដូច្នេះឧបករណ៍ជំនួយប្តូរសំឡេងអានបានត្រឹមត្រូវ ជាជាងអានភាសាខ្មែរដោយសំឡេងអង់គ្លេស។ តំណដែលចេញក្រៅគេហទំព័រប្រកាសថាបើកក្នុងផ្ទាំងថ្មី ហើយរបារខាងក្រោមលើទូរស័ព្ទរក្សាទំហំប៉ះស្រួល។',
   -- seo_notes
   'SEO បច្ចេកទេសត្រូវបានចាត់ទុកជាមុខងារមួយ មិនមែនជារឿងបន្ថែមក្រោយទេ។ ទំព័រនានាបញ្ចេញ structured data — Library និង EducationalOrganization សម្រាប់ស្ថាប័ន, WebSite ជាមួយ SearchAction, Book និង ScholarlyArticle សម្រាប់កំណត់ត្រានីមួយៗ, BreadcrumbList សម្រាប់ទីតាំង និង FAQPage នៅទំព័រដើម។ Sitemap រាយភាសាទាំងពីរនៃ URL គ្រប់ទំព័រ ជាមួយ hreflang យោងគ្នា។ លើសពី SEO ធម្មតា គេហទំព័របោះផ្សាយ llms.txt៖ ជាឯកសារអត្ថបទសម្រាប់ប្រព័ន្ធ AI ដែលបញ្ជាក់អត្តសញ្ញាណស្ថាប័ន បេសកកម្ម ប្រភេទឯកសារ ចំនួនឯកសារបច្ចុប្បន្ន ជំហរស្តីពីសិទ្ធិ និងវិធីដកស្រង់ — ហើយ robots.txt អនុញ្ញាតឱ្យ crawler AI ជាក់លាក់ចូលផ្នែកសាធារណៈ ដោយបិទផ្នែករដ្ឋបាល API និងគណនី។',
   -- performance_notes
   'ទំព័រកាតាឡុកត្រូវបានបង្កើតជាមុន និងធ្វើបច្ចុប្បន្នភាពរៀងរាល់ ៣០០ វិនាទី ជាជាងបង្កើតឡើងវិញរាល់សំណើ ដូច្នេះផ្លូវធម្មតាគឺជា cache hit។ រូបភាពគម្របត្រូវបានបម្រើជា WebP ដែលបង្កើតទុកជាមុនពីកន្លែងផ្ទុកវត្ថុ ជាជាងបំលែងទំហំតាមសំណើ។ Service worker ធ្វើ cache លើសំបកកម្មវិធី និងសៀវភៅដែលរក្សាទុក ដែលជាហេតុធ្វើឱ្យគេហទំព័រនៅប្រើបានពេលអ៊ីនធឺណិតដាច់ៗ មិនមែនតែពេលអ៊ីនធឺណិតលឿនទេ។',
   -- challenges
   'បញ្ហាពិបាកបំផុតនៅទីនេះមិនមែនជាបញ្ហាបច្ចេកទេសទេ។ បណ្ណាល័យដែលផ្ទុកសៀវភៅរបស់អ្នកដទៃ ត្រូវច្បាស់លាស់ថាខ្លួនជាអ្វី៖ PTEC ជាអ្នកផ្តល់សៀវភៅភាគច្រើន មិនមែនជាអ្នកបោះពុម្ពផ្សាយ ហើយស្នាដៃខ្លះគ្រាន់តែជាទំព័រដកស្រង់សម្រាប់អត្ថបទដែលត្រូវបង់ប្រាក់។ វេទិកាដាក់ភាពខុសគ្នានេះនៅលើកំណត់ត្រានីមួយៗ — អាជ្ញាបណ្ណ និងស្ថានភាពអានដោយសេរីរបស់វា — និងបញ្ជាក់ជាសាធារណៈ ដូច្នេះទាំងអ្នកអាន ទាំង crawler មិនត្រូវបានយល់ច្រឡំអំពីអ្វីដែលអាចទាញយកបានឡើយ។',
   -- solution
   'គេហទំព័រពីរភាសាតែមួយដែលផ្ទុកឯកសារសម្រាំងទាំងមូល — ទាំងឌីជីថល និងរូបវន្ត ទាំងស្នាដៃរបស់វិទ្យាស្ថាន និងឯកសារដែលផ្ទុកជូន — ដោយបញ្ជាក់សិទ្ធិនៅលើធាតុនីមួយៗ។ អ្នកអានរុករក និងស្វែងរកបានដោយមិនចាំបាច់មានគណនី។ គណនីបន្ថែមបញ្ជីរក្សាទុក និងការអានក្រៅបណ្តាញ។ អ្វីៗដែល crawler អាចចូលបាន ត្រូវបានពិពណ៌នាក្នុង structured data និងឯកសារសម្រាប់ម៉ាស៊ីន ដូច្នេះឯកសារសម្រាំងអាចរកឃើញពីខាងក្រៅគេហទំព័រផងដែរ។',
   -- results
   'វេទិកាដំណើរការនៅ library.ptec.edu.kh ហើយបម្រើឯកសារសម្រាំងរបស់វិទ្យាស្ថានជាសាធារណៈ ទាំងភាសាខ្មែរ និងអង់គ្លេស។ គិតត្រឹមថ្ងៃទី ៣១ ខែកក្កដា ឆ្នាំ ២០២៦ វាបានបោះផ្សាយឯកសារឌីជីថល ១១៤ កំណត់ត្រាកាតាឡុករូបវន្តសកម្ម ៧ និងផ្លូវសិក្សា ៤ — ជាតួលេខដែលគេហទំព័រខ្លួនឯងរាយការណ៍នៅក្នុង llms.txt សាធារណៈរបស់វា។ វាដំឡើងជាកម្មវិធីបាន រក្សាសៀវភៅឱ្យអានបានពេលគ្មានអ៊ីនធឺណិត និងពិពណ៌នាផ្នែកសាធារណៈបានល្អគ្រប់គ្រាន់ ដើម្បីឱ្យម៉ាស៊ីនស្វែងរក និងប្រព័ន្ធ AI អាចដកស្រង់កំណត់ត្រានីមួយៗ មិនមែនតែទំព័រដើមទេ។',
   -- next_steps
   'ឯកសារសម្រាំងផ្នែកនិក្ខេបបទ និងស្នាដៃស្រាវជ្រាវនៅតូចបើធៀបនឹងសៀវភៅដែលបានបោះផ្សាយ ដូច្នេះការងារជាបន្ទាន់គឺជម្រៅ មិនមែនផ្ទៃទូលាយថ្មីទេ៖ បន្ថែមស្នាដៃស្រាវជ្រាវនិស្សិតតាមអ៊ីនធឺណិត និងបង្កើតផ្លូវសិក្សាបន្ថែមលើឯកសារដែលមានស្រាប់។',
   'បណ្ណាល័យឌីជីថល PTEC — ឃ្លាំងឯកសារសិក្សាពីរភាសា',
   'បណ្ណាល័យឌីជីថលពីរភាសាសម្រាប់វិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ — សៀវភៅ និក្ខេបបទ ស្នាដៃស្រាវជ្រាវ និងផ្លូវសិក្សា បង្កើតដោយ Next.js និង Supabase។'),

  -- ── KruSmart ──────────────────────────────────────────────────────────────
  ('krusmart',
   'KruSmart — ជំនួយការគ្រូបង្រៀនឌីជីថល',
   'ជំនួយការគ្រូបង្រៀនភាសាខ្មែរជាចម្បងសម្រាប់ថ្នាក់រៀនកម្ពុជា៖ មុខងារ ២៦ គ្របដណ្តប់ការចុះឈ្មោះសិស្ស វត្តមាន ពិន្ទុ ចំណាត់ថ្នាក់ របាយការណ៍ និងការទំនាក់ទំនងជាមួយអាណាព្យាបាល ក្នុងកម្មវិធីវេបតែមួយ។',
   -- overview
   'KruSmart (ជំនួយការគ្រូបង្រៀនឌីជីថល) គឺជាជំនួយការគ្រូបង្រៀនឌីជីថលដែលបង្កើតឡើងសម្រាប់ថ្នាក់រៀននៅកម្ពុជា។ បន្ទាប់ពីចូលគណនី គ្រូទទួលបានផ្ទាំងមុខងារ ២៦ ដែលអាចស្វែងរកបាន គ្របដណ្តប់លើឯកសារកត់ត្រាដែលឆ្នាំសិក្សាមួយបង្កើតឡើងជាក់ស្តែង៖ ការចុះឈ្មោះសិស្ស ការស្រង់វត្តមាន ការបញ្ចូលពិន្ទុកិច្ចការផ្ទះ និងពិន្ទុប្រចាំខែ ការបង្កើតតារាងចំណាត់ថ្នាក់ និងតារាងកិត្តិយស ការបោះពុម្ពកាតសិស្ស និងវិញ្ញាបនបត្រ សៀវភៅតាមដាន បញ្ជីសារពើភ័ណ្ឌ កាលវិភាគសម្អាតថ្នាក់ និងការផ្ញើសារទៅអាណាព្យាបាល។

ផ្ទាំងប្រើប្រាស់ជាភាសាខ្មែរជាចម្បង។ ភាសាអង់គ្លេសលេចឡើងតែជាពាក្យពន្យល់ក្នុងវង់ក្រចកនៅកន្លែងដែលពាក្យនោះជាភាសាអង់គ្លេសពិត — Email, Password, Check-in — មិនមែនជាភាសាទីពីរដែលអាចប្តូរចូលទេ។',
   -- problem
   'កំណត់ត្រារបស់គ្រូគឺជាផ្នែកដែលមិនសូវគេនិយាយដល់ ប៉ុន្តែទ្រទ្រង់ការងារច្រើនជាងគេ៖ បញ្ជីឈ្មោះ បញ្ជីវត្តមាន សន្លឹកពិន្ទុ តារាងចំណាត់ថ្នាក់ និងរបាយការណ៍ដែលផ្ញើទៅឪពុកម្តាយ។ ប្រសិនបើកត់ក្នុងសៀវភៅ វាមិនអាចស្វែងរក បម្រុងទុក ឬបូកសរុបបានទេ។ ប្រសិនបើកត់ក្នុងឯកសារ Excel វាខូចនៅពេលមានការផ្លាស់ប្តូររចនាសម្ព័ន្ធដំបូង ហើយប្រើពីទូរស័ព្ទដែលនៅក្នុងដៃគ្រូមិនបានស្រួលទេ។ ទាំងពីរមិនអាចចែករំលែកបានល្អឡើយ។',
   -- target_users
   'គ្រូបង្រៀននៅសាលារៀនកម្ពុជា ដែលភាគច្រើនធ្វើការពីទូរស័ព្ទ។ គណនីនីមួយៗភ្ជាប់នឹងសាលារៀន ដូច្នេះទិន្នន័យរបស់គ្រូត្រូវបានកំណត់ត្រឹមថ្នាក់របស់គាត់ផ្ទាល់។',
   -- goals
   'ផលិតផលបញ្ជាក់គោលដៅរបស់ខ្លួននៅក្នុង metadata ផ្ទាល់៖ ធ្វើឱ្យការគ្រប់គ្រងទិន្នន័យសិស្ស ពិន្ទុ និងវត្តមាននៅកម្ពុជាកាន់តែរហ័ស និងងាយស្រួល។ ជាក់ស្តែងនេះមានន័យថាគ្របដណ្តប់ឆ្នាំសិក្សាទាំងមូល មិនមែនតែការងារមួយទេ — មុខងារដែលបង្កើតឯកសារ (តារាងចំណាត់ថ្នាក់ តារាងកិត្តិយស កាតសិស្ស វិញ្ញាបនបត្រ របាយការណ៍មាតាបិតា) មានសារៈសំខាន់ស្មើនឹងមុខងារដែលបញ្ចូលទិន្នន័យ។',
   -- my_role
   'KruSmart ផ្តល់កិត្តិយសដល់ខ្ញុំជាអ្នកអភិវឌ្ឍពីក្នុងផលិតផលផ្ទាល់៖ ធាតុ «អំពីអ្នកអភិវឌ្ឍន៍» ក្នុងម៉ឺនុយគណនីភ្ជាប់ទៅ portfolio របស់ខ្ញុំ។ ខ្ញុំធ្វើការលើវាក្នុងនាមជាអ្នករចនាផលិតផល និងអ្នកអភិវឌ្ឍ។ ការបែងចែកលម្អិតនៃទំនួលខុសត្រូវ មិនត្រូវបានអះអាងនៅទីនេះលើសពីអ្វីដែលផលិតផលបង្ហាញឡើយ។',
   -- constraints
   'កត្តាកំណត់ពីរជ្រាបពេញការរចនា។ គ្រូធ្វើការជាភាសាខ្មែរ ដូច្នេះភាសាខ្មែរជាភាសាផ្ទាំងប្រើប្រាស់ ហើយពុម្ពអក្សរខ្មែរសម្រាប់វេប — Kantumruy Pro និង Moul — ត្រូវបានផ្ទុកដោយចេតនា មិនមែនទុកឱ្យប្រព័ន្ធជ្រើសរើសដោយខ្លួនឯងទេ។ ហើយកម្មវិធីត្រូវបានប្រើលើទូរស័ព្ទ ជាញឹកញាប់លើទិន្នន័យចល័ត ដូច្នេះវាដំឡើងជា PWA បាន ហើយផ្ទាំងមុខងារជាក្រឡាដែលស្វែងរកបាន មិនមែនជាម៉ឺនុយជាន់ៗគ្នាទេ។',
   -- ux_decisions
   'អេក្រង់ដំបូងបន្ទាប់ពីចូលគណនីគឺជាក្រឡាមុខងារដែលស្វែងរកបាន មិនមែនផ្ទាំងលេខស្ថិតិទេ — គ្រូដែលបើកកម្មវិធីមានការងារក្នុងគំនិតរួចហើយ ហើយការស្វែងរកនាំទៅដល់ក្នុងជំហានតែមួយ។ មុខងារ Premium នៅតែបង្ហាញដល់អ្នកប្រើឥតគិតថ្លៃ ហើយបើកប្រអប់ណែនាំដំឡើងកម្រិត ជាជាងបាត់ទៅ ដូច្នេះផលិតផលមិនលាក់សមត្ថភាពរបស់ខ្លួនឡើយ។ ការចុះឈ្មោះជាទម្រង់តែមួយដែលមានការឆ្លើយតបភ្លាមៗ៖ របារកម្រិតសុវត្ថិភាពពាក្យសម្ងាត់ដែលប្តូរតាមការវាយ ការព្រមានភ្លាមៗពេលពាក្យសម្ងាត់មិនត្រូវគ្នា ប្រអប់ធីកយល់ព្រមលក្ខខណ្ឌ និងសំណួរគណិតវិទ្យាជំនួសឱ្យ widget ដែលមើលមិនយល់។ ការផ្ទៀងផ្ទាត់ជាលេខកូដ ៦ ខ្ទង់ក្នុងប្រអប់ ជាជាងឱ្យទៅបើកកម្មវិធីអ៊ីមែល។ ទម្រង់ភ្លឺ និងងងឹតត្រូវបានកំណត់មុនការគូរអេក្រង់ដំបូង ដូច្នេះគ្មានការភ្លឹបភ្លែតនៃទម្រង់ខុសទេ។',
   -- architecture
   'កម្មវិធីដែលបង្ហាញនៅផ្នែកអតិថិជន ដាក់ដំណើរការលើ Netlify ដោយមាន Firebase នៅខាងក្រោយ — Firebase Authentication សម្រាប់គណនី និង Cloud Firestore សម្រាប់ទិន្នន័យ ដែលនាំចូលជា ES module ដោយផ្ទាល់ពី CDN របស់ Google ជាជាងបញ្ចូលក្នុងកញ្ចប់។ គ្មានជំហាន build រវាងកូដ និង browser ទេ៖ /core/app.js ផ្ទុកបញ្ជីមុខងារ /core/auth.js ផ្ទុកលំហូរចូលគណនី និង /core/access-control.js ផ្ទុកច្បាប់ជាវប្រើប្រាស់។ ការបង់ប្រាក់ដំឡើងកម្រិតឆ្លងកាត់សេវា KHQR ដាច់ដោយឡែកលើ Render — KHQR ជាស្តង់ដារបង់ប្រាក់តាម QR ជាតិរបស់កម្ពុជា — ដែលរក្សាដំណើរការបង់ប្រាក់នៅក្រៅកម្មវិធី។ អ៊ីមែលប្រតិបត្តិការឆ្លងកាត់ EmailJS ហើយ CSP ក៏អនុញ្ញាត Google Analytics, reCAPTCHA និង Google Gemini API ផងដែរ។',
   -- database_decisions
   'ទិន្នន័យស្ថិតនៅក្នុង Cloud Firestore ក្រោម namespace កម្មវិធីតែមួយ កំណត់តាម uid របស់គ្រូដែលបានចូលគណនី ដោយមានឯកសារយោងសាលារៀនរក្សាទុកនៅលើកំណត់ត្រាគ្រូ — តំណនោះជាអ្វីដែលកំណត់គ្រូឱ្យនៅត្រឹមថ្នាក់របស់ខ្លួន និងជាអ្វីដែលការចុះវត្តមានតាមទីតាំងយកទៅប្រៀបធៀប។ ស្ថានភាពជាវប្រើប្រាស់រក្សាទុកនៅលើកំណត់ត្រាអ្នកប្រើ ហើយអានពី Firestore ជារៀងរាល់ដង មិនមែនពី local storage ទេ។ ម៉ូឌុលគ្រប់គ្រងសិទ្ធិសរសេរបញ្ជាក់រឿងនេះនៅបន្ទាត់ដំបូង ហើយនោះជាការគិតត្រឹមត្រូវ៖ កម្រិតសិទ្ធិដែល cache ក្នុង browser គឺជាកម្រិតសិទ្ធិដែល browser អាចកែបាន។',
   -- key_features
   'មុខងារខាងក្រោមនីមួយៗត្រូវបានចុះបញ្ជីក្នុងបញ្ជីមុខងាររបស់កម្មវិធីផ្ទាល់ ឬក្នុងច្បាប់គ្រប់គ្រងសិទ្ធិរបស់វា។',
   -- security_notes
   'ការចុះឈ្មោះត្រូវបានការពារដោយសំណួរគណិតវិទ្យាប្រឆាំង Bot តម្រូវការកម្រិតសុវត្ថិភាពពាក្យសម្ងាត់ និងការយល់ព្រមលក្ខខណ្ឌយ៉ាងច្បាស់ បន្ទាប់មកបញ្ជាក់ដោយលេខកូដ ៦ ខ្ទង់មុនពេលគណនីអាចប្រើបាន។ សិទ្ធិប្រើប្រាស់ត្រូវបានកំណត់ពីកំណត់ត្រាអ្នកប្រើក្នុង Firestore មិនមែនពី local storage ទេ ហើយស្ថានភាព «ហាមឃាត់» គឺជាស្ថានភាពពេញលេញមួយក្បែរកម្រិតជាវប្រើប្រាស់។ ការឆ្លើយតបមាន HSTS ជាមួយ preload, X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, Referrer-Policy, object-src ''none'', base-uri ''self'' និង Content-Security-Policy ដែលកំណត់ដើមកំណើតភាគីទីបីទាំងអស់ដែលកម្មវិធីអាចទាក់ទង។ នៅលើឯកសារចូលដំបូង Permissions-Policy បិទកាមេរ៉ា មីក្រូហ្វូន និងទីតាំង។',
   -- accessibility_notes
   'ទំព័របើកចេញជាមួយតំណ «រំលងទៅមាតិកា (Skip to content)» សរសេរទាំងភាសាខ្មែរ និងអង់គ្លេស។ រូបតំណាងតុបតែងត្រូវបានលាក់ពីមែកធាងភាពងាយស្រួល ប្រអប់ដំឡើងកម្រិតជាប្រអប់ពិតដែលមានតួនាទី dialog និង modal ហើយវាលពាក្យសម្ងាត់មានប៊ូតុងបង្ហាញ/លាក់ដាក់ស្លាកជាភាសាខ្មែរ។ ទម្រង់ងងឹតជាទម្រង់ទីពីរពិតប្រាកដ មិនមែនជាតម្រងបញ្ច្រាសពណ៌ទេ។',
   -- seo_notes
   'KruSmart ជាផលិតផលដែលត្រូវចូលគណនី ដូច្នេះផ្ទៃសាធារណៈរបស់វាមានតែមួយទំព័រ ហើយការងារ SEO របស់វាតូចចង្អៀត៖ បញ្ជាក់ថាផលិតផលនេះជាអ្វី ជាភាសាខ្មែរ ដល់អ្នកដែលស្វែងរកជាភាសាខ្មែរ។ ឯកសារចូលដំបូងមានចំណងជើង និងការពិពណ៌នាជាភាសាខ្មែរ ពាក្យគន្លឹះទាំងខ្មែរ និងអង់គ្លេស ស្លាក Open Graph និងពណ៌ស្បែក ហើយ manifest PWA ផ្តល់ឈ្មោះ និងរូបតំណាងដាច់ដោយឡែកដល់កម្មវិធីដែលដំឡើងរួច។',
   -- performance_notes
   'កម្មវិធីមិនផ្ទុកកញ្ចប់ framework ណាមួយទេ៖ មានតែ HTML, CSS និង ES module បម្រើពី edge របស់ Netlify ដោយ Firebase និងសំណុំរូបតំណាងទាញពី CDN។ ម៉ូឌុលចូលគណនីចាប់ផ្តើមទាញយកផ្នែកអ៊ីមែលស្របគ្នាជាមួយការអាន Firestore ដំបូង ជាជាងបន្ទាប់ពីវា ហើយទម្រង់ពណ៌ត្រូវបានកំណត់មុនការគូរអេក្រង់ដំបូង។ លទ្ធផលគឺអេក្រង់ដំបូងដែលមិនរង់ចាំ framework JavaScript ចាប់ផ្តើម — ដែលសំខាន់បំផុតលើទូរស័ព្ទកម្រិតមធ្យមដែលផលិតផលនេះត្រូវបានប្រើ។',
   -- challenges
   'អ៊ីមែលប្រតិបត្តិការជាបញ្ហាគួរឱ្យចាប់អារម្មណ៍។ លេខកូដផ្ទៀងផ្ទាត់ត្រូវតែទៅដល់ដោយទុកចិត្តបាន ទាំងដែលប្រើគម្រោងឥតគិតថ្លៃដែលមានកូតាប្រចាំខែច្បាស់លាស់ ដូច្នេះកម្មវិធីមិនពឹងលើអ្នកផ្ញើតែមួយទេ៖ វារក្សាបណ្តុំគណនី EmailJS ក្នុង Firestore សាកល្បងម្តងមួយៗ ហើយប្តូរទៅគណនីបន្ទាប់ពេលមួយអស់កូតា — ព្រមទាំងរាយការណ៍សារច្បាស់លាស់ដល់គ្រូ និងអ្នកគ្រប់គ្រងពេលបណ្តុំទាំងមូលអស់ ជាជាងទម្លាក់លេខកូដដោយស្ងាត់ស្ងៀម។',
   -- solution
   'កម្មវិធីភាសាខ្មែរតែមួយដែលដំឡើងបាន និងគ្របដណ្តប់ឆ្នាំសិក្សាពីដើមដល់ចប់។ កម្រិតឥតគិតថ្លៃផ្តល់ឱ្យគ្រូគ្រប់រូបនូវមុខងារបញ្ជីឈ្មោះ ពិន្ទុ ការវិភាគ និងរបាយការណ៍សំខាន់ៗ។ កម្រិតសាកល្បង និងកម្រិត Premium បង់ប្រាក់បើកមុខងារដែលបង្កើតឯកសារច្រើន — វត្តមានតាមប្លង់តុ បញ្ជីវត្តមានប្រចាំខែ តារាងចំណាត់ថ្នាក់សម្រាប់បោះពុម្ព តារាងកិត្តិយស កាតសិស្ស និងវិញ្ញាបនបត្រ។ ការដំឡើងកម្រិតបង់ប្រាក់តាម KHQR ដែលជាមធ្យោបាយបង់ប្រាក់ដែលគ្រូប្រើស្រាប់។',
   -- results
   'KruSmart ដំណើរការនៅ krusmart.org ហើយត្រូវបានប្រើប្រាស់ជាផលិតផលដែលត្រូវចូលគណនី។ បច្ចុប្បន្នវាចុះបញ្ជីមុខងារសម្រាប់គ្រូចំនួន ២៦ ក្នុងនោះ ៩ ស្ថិតនៅក្រោយការជាវសាកល្បង ឬបង់ប្រាក់ ក្នុងគំរូសិទ្ធិចំនួន ៥ ស្ថានភាព។ វាដំឡើងជាកម្មវិធីលើទូរស័ព្ទបាន និងមានទម្រង់ភ្លឺ និងងងឹត។ តួលេខអ្នកប្រើប្រាស់មិនត្រូវបានបង្ហាញដោយចេតនា — គ្មានតួលេខណាមួយអាចផ្ទៀងផ្ទាត់ពីខាងក្រៅផលិតផលបានទេ។',
   null,
   'KruSmart — វេទិកាបង្រៀនឌីជីថលភាសាខ្មែរ',
   'ជំនួយការគ្រូបង្រៀនភាសាខ្មែរជាចម្បងសម្រាប់ថ្នាក់រៀនកម្ពុជា៖ មុខងារ ២៦ សម្រាប់ការចុះឈ្មោះសិស្ស វត្តមាន ពិន្ទុ និងរបាយការណ៍។'),

  -- ── PTEC Storage ──────────────────────────────────────────────────────────
  ('ptec-storage',
   'PTEC Storage',
   'សេវាបញ្ជូនឯកសារនៅខាងក្រោយបណ្ណាល័យឌីជីថល PTEC — ដើមកំណើតដាច់ដោយឡែក គោលនយោបាយបដិសេធជាមុន និងទំព័រដើមដែលនិយាយតែថាវាជាអ្វី។',
   -- overview
   'PTEC Storage គឺជាស្រទាប់បញ្ជូនឯកសារសម្រាប់ library.ptec.edu.kh។ ទំព័រដើមរបស់វាបញ្ជាក់តែប៉ុណ្ណឹង៖ «សេវាបញ្ជូនឯកសារសម្រាប់ library.ptec.edu.kh។ គ្មានអ្វីត្រូវមើលនៅទីនេះទេ។» គ្មានកាតាឡុក គ្មានផ្ទាំងរុករក គ្មានខ្លឹមសារសម្រាប់មើល — ហើយមានការកំណត់ noindex ដូច្នេះវាមិនលេចក្នុងលទ្ធផលស្វែងរកទេ។

នេះជាការរចនាទាំងមូល។ វាជាមូលដ្ឋានរចនាសម្ព័ន្ធ ហើយអ្វីដែលមូលដ្ឋានរចនាសម្ព័ន្ធធ្វើបានល្អបំផុតគឺនៅឱ្យផុតផ្លូវ។',
   -- problem
   'បណ្ណាល័យឌីជីថលមានតម្លៃស្មើនឹងសមត្ថភាពបញ្ជូនឯកសាររបស់វា។ ការបញ្ជូនឯកសារស្កេន និងនិក្ខេបបទចេញពីកម្មវិធីដោយផ្ទាល់ ចងចរាចរណ៍ទាញយកជាមួយចរាចរណ៍ទំព័រ៖ ឯកសារធំមួយប្រកួតជាមួយការបង្ហាញទំព័រគ្រប់ទំព័រ ហើយយុទ្ធសាស្ត្រ cache ដែលសមនឹងទំព័រកាតាឡុក — ធ្វើបច្ចុប្បន្នភាពញឹកញាប់ ថ្មីជានិច្ច — គឺជាយុទ្ធសាស្ត្រខុសសម្រាប់ឯកសារ PDF ធំដែលមិនដែលផ្លាស់ប្តូរ។',
   -- target_users
   'ដោយផ្ទាល់ គឺកម្មវិធីបណ្ណាល័យ។ ដោយប្រយោល គឺអ្នកអានបណ្ណាល័យឌីជីថល PTEC ទាំងអស់ — ដែលគ្មាននរណាម្នាក់ដឹងឈ្មោះសេវានេះឡើយ។',
   -- goals
   'ការងារតែមួយ ធ្វើឱ្យតូចចង្អៀត៖ បញ្ជូនឯកសាររបស់បណ្ណាល័យតាមដើមកំណើតដាច់ដោយឡែក ដោយកំណត់ cache និងសុវត្ថិភាពសម្រាប់ឯកសារឋិតិវន្ត មិនមែនសម្រាប់កម្មវិធីទេ។',
   -- my_role
   'ខ្ញុំធ្វើការលើសេវានេះជាផ្នែកមួយនៃវេទិកាបណ្ណាល័យឌីជីថល PTEC នៅផ្នែកមូលដ្ឋានរចនាសម្ព័ន្ធ។ ការរចនាខាងក្នុងរបស់វា — ប្រព័ន្ធផ្ទុក រចនាសម្ព័ន្ធបណ្តាញ និងឧបករណ៍ប្រតិបត្តិការ — មិនត្រូវបានបង្ហាញនៅទីនេះដោយចេតនា។',
   -- constraints
   'សេវានេះគ្មានផ្ទាំងប្រើប្រាស់ដែលត្រូវការពារ និងគ្មានហេតុផលឱ្យ crawler ចូល។ នេះជាកត្តាកំណត់ដែលមានប្រយោជន៍៖ វាអនុញ្ញាតឱ្យដើមកំណើតនេះត្រូវបានចាក់សោតឹងរឹងជាងកម្មវិធីធម្មតាឆ្ងាយណាស់។',
   -- ux_decisions
   'មានការសម្រេចចិត្តរចនាតែមួយគត់ គឺការមិនមានផ្ទាំងប្រើប្រាស់ស្ទើរតែទាំងស្រុង។ ទំព័រដើមប្រាប់ឈ្មោះសេវា ប្រាប់ឈ្មោះគេហទំព័រដែលវាបម្រើ ហើយប្រាប់ថាគ្មានអ្វីផ្សេងទៀតនៅទីនេះទេ — ដែលមានប្រយោជន៍ជាងការបញ្ជូនបន្តទៅទីផ្សេង ឬទំព័រ 404 សម្រាប់អ្នកដែលចូលមកដោយចៃដន្យ។',
   -- architecture
   'ដើមកំណើតដាច់ដោយឡែកពីកម្មវិធីបណ្ណាល័យ បម្រើឆ្លងកាត់ Cloudflare។ បណ្ណាល័យចាត់ទុកវាជាពីរតួនាទីក្នុងពេលតែមួយ ហើយ Content-Security-Policy របស់វាបញ្ជាក់រឿងនេះ៖ storage-ptec.online និងដែនរងរបស់វាជាប្រភពរូបភាពដែលអនុញ្ញាត ហើយ api.storage-ptec.online ជាដើមកំណើត connect-src ដែលអនុញ្ញាត។ ការបែងចែកការបញ្ជូនចេញពីការបង្ហាញ អនុញ្ញាតឱ្យទាំងពីរត្រូវបាន cache ពង្រីក និងពង្រឹងសុវត្ថិភាពតាមលក្ខខណ្ឌរៀងៗខ្លួន។',
   null, -- database_decisions
   -- key_features
   'សេវានេះត្រូវបានកំណត់អត្តសញ្ញាណដោយអ្វីដែលវាបដិសេធ ច្រើនជាងអ្វីដែលវាផ្តល់។',
   -- security_notes
   'គោលនយោបាយគឺបដិសេធជាមុន និងតឹងរឹងបំផុតក្នុងចំណោមវេទិកាទាំងបី៖ default-src ''none'', img-src ''self'', frame-ancestors ''none'', base-uri ''none'', form-action ''none'' — គ្មាន script គ្មានការដាក់ក្នុងស៊ុម គ្មានទម្រង់បំពេញ គ្មានការសរសេរ base-tag ឡើងវិញ។ ក្បែរនោះ៖ HSTS, X-Content-Type-Options nosniff, X-Frame-Options DENY និង Permissions-Policy ដែលបិទកាមេរ៉ា មីក្រូហ្វូន ទីតាំង ការបង់ប្រាក់ និង USB។ ដោយគ្មានផ្ទាំងប្រើប្រាស់ត្រូវការពារ អ្វីៗទាំងអស់ដែលមិនមែនការបញ្ជូនឯកសារត្រូវបានបិទ។ ការរាយការណ៍កំហុសបណ្តាញត្រូវបានកំណត់ ដូច្នេះបញ្ហាមើលឃើញ មិនស្ងាត់ស្ងៀមទេ។',
   -- accessibility_notes
   'ទំព័រដើមមានចំណងជើងមួយ និងប្រយោគមួយ ក្នុងពុម្ពអក្សរប្រព័ន្ធ ទំហំធម្មតា — អានបានទោះគ្មាន CSS ហើយងាយស្រួលសម្រាប់កម្មវិធីអានអេក្រង់។ គ្មានអ្វីផ្សេងទៀតនៅលើទំព័រនោះដែលត្រូវធ្វើឱ្យងាយស្រួលទេ។',
   -- seo_notes
   'មិនបង្ហាញខ្លួនដោយចេតនា៖ ទំព័រដើមកំណត់ជា noindex។ ម៉ាស៊ីនផ្ទុកឯកសារមិនគួរប្រកួតជាមួយបណ្ណាល័យដែលវាបម្រើ ក្នុងលទ្ធផលស្វែងរករបស់បណ្ណាល័យនោះទេ។',
   -- performance_notes
   'ការឆ្លើយតបត្រូវបាន cache ជាសាធារណៈរយៈពេលប្រាំនាទី និងមាន Last-Modified ដូច្នេះសំណើម្តងទៀតផ្ទៀងផ្ទាត់ដោយថ្លៃតិច ជាជាងទាញយកឡើងវិញ។ Accept-Ranges: bytes ត្រូវបានប្រកាស ដែលអនុញ្ញាតឱ្យអ្នកអានបន្តការទាញយកដែលដាច់ ឬឱ្យកម្មវិធីមើលលោតទៅផ្នែកណាមួយក្នុងឯកសារ PDF ធំ ដោយមិនចាំបាច់ទាញយកទាំងអស់ជាមុន។ Cloudflare នៅខាងមុខដើមកំណើត ហើយ HTTP/3 ត្រូវបានប្រកាស។',
   -- challenges
   'ការបែងចែកការបញ្ជូនឯកសារចេញពីកម្មវិធី ងាយពណ៌នា ប៉ុន្តែងាយធ្វើខុសដែរ។ ការបែងចែកនេះមានតម្លៃលុះត្រាតែដើមកំណើតទីពីរឯករាជ្យពិតប្រាកដ — មាន cache ផ្ទាល់ខ្លួន គោលនយោបាយផ្ទាល់ខ្លួន និងរបៀបបរាជ័យផ្ទាល់ខ្លួន — មិនមែនគ្រាន់តែជា proxy ដែលទទួលកត្តាកំណត់របស់ដើមកំណើតទីមួយទេ។',
   -- solution
   'ដើមកំណើតដាច់ដោយឡែក នៅខាងក្រោយ Cloudflare ដែលធ្វើការងារតែមួយ៖ បញ្ជូនឯកសាររបស់បណ្ណាល័យ។ វាត្រូវបានយោងដោយបណ្ណាល័យទាំងជាម៉ាស៊ីនផ្ទុករូបភាព និងជាដើមកំណើត API ត្រូវបាន cache សម្រាប់ការបញ្ជូនឋិតិវន្ត ពង្រឹងសុវត្ថិភាពដើម្បីបដិសេធអ្វីៗដែលវាមិនត្រូវការ និងរក្សាឱ្យនៅក្រៅលទ្ធផលស្វែងរកទាំងស្រុង។',
   -- results
   'សេវានេះដំណើរការ បញ្ជូនឯកសាររបស់បណ្ណាល័យឌីជីថល PTEC ពីដើមកំណើតរបស់វាផ្ទាល់ និងប្រើ Content-Security-Policy តឹងរឹងបំផុតក្នុងចំណោមវេទិកាទាំងបីក្នុង portfolio នេះ។ តួលេខបរិមាណមិនត្រូវបានបង្ហាញទេ — គ្មានតួលេខណាមួយអាចផ្ទៀងផ្ទាត់ពីខាងក្រៅបានឡើយ។',
   null,
   'PTEC Storage — ការបញ្ជូនឯកសារសម្រាប់បណ្ណាល័យឌីជីថល',
   'សេវាបញ្ជូនឯកសារដាច់ដោយឡែកនៅខាងក្រោយ Cloudflare សម្រាប់បណ្ណាល័យឌីជីថល PTEC ជាមួយ CSP បែបបដិសេធជាមុន។')

  ) as t(proj_slug, title, summary, overview, problem, target_users, goals,
         my_role, constraints, ux_decisions, architecture, database_decisions,
         key_features, security_notes, accessibility_notes, seo_notes,
         performance_notes, challenges, solution, results, next_steps,
         seo_title, seo_description)
    on t.proj_slug = p.slug
 where public.is_unreviewed_project_import(p.slug)
on conflict (project_id, locale) do update set
  title               = excluded.title,
  summary             = excluded.summary,
  overview            = excluded.overview,
  problem             = excluded.problem,
  target_users        = excluded.target_users,
  goals               = excluded.goals,
  my_role             = excluded.my_role,
  constraints         = excluded.constraints,
  ux_decisions        = excluded.ux_decisions,
  architecture        = excluded.architecture,
  database_decisions  = excluded.database_decisions,
  key_features        = excluded.key_features,
  security_notes      = excluded.security_notes,
  accessibility_notes = excluded.accessibility_notes,
  seo_notes           = excluded.seo_notes,
  performance_notes   = excluded.performance_notes,
  challenges          = excluded.challenges,
  solution            = excluded.solution,
  results             = excluded.results,
  next_steps          = excluded.next_steps,
  seo_title           = excluded.seo_title,
  seo_description     = excluded.seo_description,
  translation_state   = excluded.translation_state;

-- ═══════════════════════════════════════════════════════════════════════════
--  4. Structured features
--
--  `project_features` carries both languages on one row (title_en/title_km),
--  so there is one row per feature, not one per locale. Replace-in-place rather
--  than upsert: the table has no natural key, and the guard means we are only
--  ever replacing rows this import wrote.
-- ═══════════════════════════════════════════════════════════════════════════

delete from public.project_features f
 using public.projects p
 where f.project_id = p.id
   and p.slug in ('ptec-digital-library', 'krusmart', 'ptec-storage')
   and public.is_unreviewed_project_import(p.slug);

insert into public.project_features
  (project_id, title_en, title_km, description_en, description_km, icon, sort_order)
select p.id, f.title_en, f.title_km, f.description_en, f.description_km, f.icon, f.sort_order
  from public.projects p
  join (values

  -- ── PTEC Digital Library ──────────────────────────────────────────────────
  ('ptec-digital-library',
   'Five resource types in one catalogue',
   'ឯកសារប្រាំប្រភេទក្នុងកាតាឡុកតែមួយ',
   'Digital books, the physical library catalogue, student theses, academic publications and curated learning paths, each with its own listing and record layout.',
   'សៀវភៅឌីជីថល កាតាឡុកបណ្ណាល័យរូបវន្ត និក្ខេបបទនិស្សិត ស្នាដៃស្រាវជ្រាវ និងផ្លូវសិក្សាដែលបានរៀបចំ ដែលនីមួយៗមានទំព័របញ្ជី និងទម្រង់កំណត់ត្រារៀងៗខ្លួន។',
   'library', 1),

  ('ptec-digital-library',
   'Search, subject and author browsing',
   'ការស្វែងរក តាមប្រធានបទ និងតាមអ្នកនិពន្ធ',
   'A dedicated search route plus browsable subject and author pages, so a reader can move sideways from a record instead of starting over.',
   'ទំព័រស្វែងរកដាច់ដោយឡែក ព្រមទាំងទំព័រប្រធានបទ និងអ្នកនិពន្ធដែលរុករកបាន ដូច្នេះអ្នកអានអាចរើទៅឯកសារជាប់ពាក់ព័ន្ធ ដោយមិនចាំបាច់ចាប់ផ្តើមឡើងវិញ។',
   'search', 2),

  ('ptec-digital-library',
   'Read in the browser, download when permitted',
   'អានក្នុង browser ទាញយកពេលមានសិទ្ធិ',
   'Book records open on their description with reading and reviews as sibling tabs, and each record states its own licence and free-to-read status.',
   'កំណត់ត្រាសៀវភៅបើកចេញជាមួយការពិពណ៌នា ដោយមានផ្ទាំងអាន និងផ្ទាំងមតិយោបល់នៅជាប់គ្នា ហើយកំណត់ត្រានីមួយៗបញ្ជាក់អាជ្ញាបណ្ណ និងស្ថានភាពអានដោយសេរីរបស់ខ្លួន។',
   'book', 3),

  ('ptec-digital-library',
   'Curated learning paths',
   'ផ្លូវសិក្សាដែលបានរៀបចំ',
   'Ordered sequences of books and theses built around a real teacher-training topic, because a long list of books is not a curriculum.',
   'លំដាប់សៀវភៅ និងនិក្ខេបបទដែលរៀបចំជុំវិញប្រធានបទបណ្តុះបណ្តាលគ្រូជាក់ស្តែង ព្រោះបញ្ជីសៀវភៅវែងមិនមែនជាកម្មវិធីសិក្សាទេ។',
   'layers', 4),

  ('ptec-digital-library',
   'Installable app with offline reading',
   'កម្មវិធីដំឡើងបាន អានពេលគ្មានអ៊ីនធឺណិត',
   'A Progressive Web App with a service worker, install shortcuts to Books, Theses and saved items, and "Saved for offline" as a route of its own.',
   'PWA ជាមួយ service worker ផ្លូវកាត់ដំឡើងទៅសៀវភៅ និក្ខេបបទ និងឯកសាររក្សាទុក ព្រមទាំង «រក្សាទុកសម្រាប់អានក្រៅបណ្តាញ» ជាទំព័រដាច់ដោយឡែក។',
   'wifiOff', 5),

  ('ptec-digital-library',
   'Complete Khmer and English parity',
   'ភាសាខ្មែរ និងអង់គ្លេសស្មើគ្នាពេញលេញ',
   'Every public section exists in both languages under a /km prefix, with reciprocal hreflang in the sitemap and the English URL as canonical.',
   'គ្រប់ផ្នែកសាធារណៈមានទាំងពីរភាសាក្រោម /km ដោយមាន hreflang យោងគ្នាក្នុង sitemap ហើយ URL អង់គ្លេសជា canonical។',
   'languages', 6),

  ('ptec-digital-library',
   'Structured data and an llms.txt',
   'Structured data និង llms.txt',
   'Library, EducationalOrganization, WebSite, Book, ScholarlyArticle, FAQPage and BreadcrumbList schemas, plus a plain-text guide written for answer engines.',
   'Schema បែប Library, EducationalOrganization, WebSite, Book, ScholarlyArticle, FAQPage និង BreadcrumbList ព្រមទាំងឯកសារអត្ថបទសម្រាប់ប្រព័ន្ធ AI ដែលឆ្លើយសំណួរ។',
   'globe', 7),

  ('ptec-digital-library',
   'The physical library, documented',
   'បណ្ណាល័យរូបវន្ត ចងក្រងជាឯកសារ',
   'Rules, opening times, the collection, the committee, the team and the library''s history since 2017 — so the on-site service is part of the same site.',
   'បទបញ្ជា ម៉ោងបើក ឯកសារសម្រាំង គណៈកម្មការ ក្រុមការងារ និងប្រវត្តិបណ្ណាល័យតាំងពីឆ្នាំ ២០១៧ — ដូច្នេះសេវានៅនឹងកន្លែងជាផ្នែកនៃគេហទំព័រតែមួយ។',
   'mapPin', 8),

  ('ptec-digital-library',
   'Reader accounts and saved lists',
   'គណនីអ្នកអាន និងបញ្ជីរក្សាទុក',
   'Google sign-in with Cloudflare Turnstile on the forms; an account adds a profile, private lists and offline items on top of the open catalogue.',
   'ការចូលគណនីតាម Google ជាមួយ Cloudflare Turnstile លើទម្រង់បំពេញ។ គណនីបន្ថែមប្រវត្តិរូប បញ្ជីឯកជន និងឯកសារក្រៅបណ្តាញ លើកាតាឡុកបើកចំហ។',
   'user', 9),

  ('ptec-digital-library',
   'Hardened response headers',
   'ក្បាលឆ្លើយតបដែលពង្រឹងសុវត្ថិភាព',
   'A Content-Security-Policy that enumerates every permitted origin, frame-ancestors none, form-action self, HSTS with preload, and admin routes kept out of the index.',
   'Content-Security-Policy ដែលរាយបញ្ជីដើមកំណើតដែលអនុញ្ញាតទាំងអស់, frame-ancestors none, form-action self, HSTS ជាមួយ preload និងទំព័ររដ្ឋបាលដែលមិនចូលក្នុងលិបិក្រម។',
   'shield', 10),

  -- ── KruSmart ──────────────────────────────────────────────────────────────
  ('krusmart',
   'Searchable launcher of 26 modules',
   'ផ្ទាំងមុខងារ ២៦ ដែលស្វែងរកបាន',
   'The first screen after sign-in is a searchable grid of every module, not a dashboard — a teacher opening the app already knows what they came to do.',
   'អេក្រង់ដំបូងបន្ទាប់ពីចូលគណនីគឺជាក្រឡាមុខងារទាំងអស់ដែលស្វែងរកបាន មិនមែនផ្ទាំងស្ថិតិទេ — គ្រូដែលបើកកម្មវិធីដឹងរួចហើយថាមកធ្វើអ្វី។',
   'layoutDashboard', 1),

  ('krusmart',
   'Student enrolment and class rosters',
   'ការចុះឈ្មោះសិស្ស និងបញ្ជីថ្នាក់',
   'Enrolment forms, the class roster, age and height analysis, and per-student access codes that guardians can use.',
   'ទម្រង់ចុះឈ្មោះ បញ្ជីឈ្មោះថ្នាក់ ការវិភាគអាយុ និងកម្ពស់ ព្រមទាំងលេខកូដសម្រាប់សិស្សម្នាក់ៗដែលអាណាព្យាបាលអាចប្រើបាន។',
   'users', 2),

  ('krusmart',
   'Attendance, including seating-plan mode',
   'វត្តមាន រួមទាំងតាមប្លង់តុ',
   'A monthly attendance register and an attendance mode laid out as the classroom''s seating plan, so marking follows what the teacher is looking at.',
   'បញ្ជីវត្តមានប្រចាំខែ និងរបៀបស្រង់វត្តមានដែលរៀបតាមប្លង់តុក្នុងថ្នាក់ ដូច្នេះការគូសវត្តមានដើរតាមអ្វីដែលគ្រូកំពុងមើល។',
   'checkCircle', 3),

  ('krusmart',
   'Homework and monthly score entry',
   'ការបញ្ចូលពិន្ទុកិច្ចការផ្ទះ និងប្រចាំខែ',
   'Score entry for homework and for the monthly assessment, feeding a consolidated subject score table.',
   'ការបញ្ចូលពិន្ទុសម្រាប់កិច្ចការផ្ទះ និងការវាយតម្លៃប្រចាំខែ ដែលបញ្ចូលទៅតារាងពិន្ទុតាមមុខវិជ្ជាបូកសរុប។',
   'edit', 4),

  ('krusmart',
   'Per-student and per-subject analysis',
   'ការវិភាគតាមសិស្ស និងតាមមុខវិជ្ជា',
   'Two analysis views over the same scores — one following a student across subjects, one following a subject across the class.',
   'ទិដ្ឋភាពវិភាគពីរលើពិន្ទុដូចគ្នា — មួយតាមដានសិស្សម្នាក់ឆ្លងកាត់មុខវិជ្ជា មួយទៀតតាមដានមុខវិជ្ជាមួយឆ្លងកាត់ថ្នាក់។',
   'barChart', 5),

  ('krusmart',
   'Rankings, honour rolls and printable documents',
   'ចំណាត់ថ្នាក់ តារាងកិត្តិយស និងឯកសារបោះពុម្ព',
   'Printable class rankings, honour rolls, student ID cards and certificates — the paperwork a school year has to produce, generated rather than retyped.',
   'តារាងចំណាត់ថ្នាក់សម្រាប់បោះពុម្ព តារាងកិត្តិយស កាតសិស្ស និងវិញ្ញាបនបត្រ — ជាឯកសារដែលឆ្នាំសិក្សាត្រូវតែបង្កើត ដោយបង្កើតស្វ័យប្រវត្តិ មិនមែនវាយឡើងវិញទេ។',
   'award', 6),

  ('krusmart',
   'Parent reports and guardian messaging',
   'របាយការណ៍មាតាបិតា និងសារទៅអាណាព្យាបាល',
   'Parent-facing reports, homework sent to guardians, notifications, and access codes that let a guardian look up their own child.',
   'របាយការណ៍សម្រាប់មាតាបិតា ការបញ្ជូនកិច្ចការផ្ទះទៅអាណាព្យាបាល ការជូនដំណឹង និងលេខកូដដែលអនុញ្ញាតឱ្យអាណាព្យាបាលមើលព័ត៌មានកូនខ្លួន។',
   'send', 7),

  ('krusmart',
   'Geofenced teacher check-in',
   'ការចុះវត្តមានគ្រូតាមទីតាំង',
   'Check-in compares the teacher''s current position against the school on their account record, using a great-circle distance calculation in the browser.',
   'ការចុះវត្តមានប្រៀបធៀបទីតាំងបច្ចុប្បន្នរបស់គ្រូជាមួយសាលារៀនក្នុងកំណត់ត្រាគណនី ដោយប្រើការគណនាចម្ងាយលើផ្ទៃផែនដីនៅក្នុង browser។',
   'mapPin', 8),

  ('krusmart',
   'Five-state access model',
   'គំរូសិទ្ធិប្រើប្រាស់ ៥ ស្ថានភាព',
   'Free, trial, premium, admin and banned — resolved from the user''s database record on every read, never from local storage, with 9 modules gated behind an active subscription.',
   'ឥតគិតថ្លៃ សាកល្បង Premium អ្នកគ្រប់គ្រង និងហាមឃាត់ — កំណត់ពីកំណត់ត្រាអ្នកប្រើក្នុងមូលដ្ឋានទិន្នន័យរាល់ដង មិនមែនពី local storage ទេ ដោយមានមុខងារ ៩ ស្ថិតក្រោយការជាវសកម្ម។',
   'lock', 9),

  ('krusmart',
   'Account security and verified sign-up',
   'សុវត្ថិភាពគណនី និងការចុះឈ្មោះដែលផ្ទៀងផ្ទាត់',
   'A password-strength meter, an arithmetic bot challenge, explicit terms acceptance, Google sign-in, and a six-digit code before the account can be used.',
   'របារកម្រិតសុវត្ថិភាពពាក្យសម្ងាត់ សំណួរគណិតវិទ្យាប្រឆាំង Bot ការយល់ព្រមលក្ខខណ្ឌយ៉ាងច្បាស់ ការចូលតាម Google និងលេខកូដ ៦ ខ្ទង់មុនពេលគណនីអាចប្រើបាន។',
   'shield', 10),

  ('krusmart',
   'Installable, Khmer-first, light and dark',
   'ដំឡើងបាន ភាសាខ្មែរជាចម្បង ភ្លឺ និងងងឹត',
   'A PWA manifest with its own name and icons, Khmer web typography loaded deliberately, and a theme resolved before first paint.',
   'Manifest PWA ដែលមានឈ្មោះ និងរូបតំណាងផ្ទាល់ខ្លួន ពុម្ពអក្សរខ្មែរសម្រាប់វេបដែលផ្ទុកដោយចេតនា និងទម្រង់ពណ៌ដែលកំណត់មុនការគូរអេក្រង់ដំបូង។',
   'download', 11),

  -- ── PTEC Storage ──────────────────────────────────────────────────────────
  ('ptec-storage',
   'A delivery origin of its own',
   'ដើមកំណើតបញ្ជូនផ្ទាល់ខ្លួន',
   'Files are served from a host separate from the library application, so download traffic and page rendering never compete for the same resources.',
   'ឯកសារត្រូវបានបម្រើពីម៉ាស៊ីនដាច់ដោយឡែកពីកម្មវិធីបណ្ណាល័យ ដូច្នេះចរាចរណ៍ទាញយក និងការបង្ហាញទំព័រមិនប្រកួតគ្នាលើធនធានតែមួយឡើយ។',
   'layers', 1),

  ('ptec-storage',
   'Deny-by-default security policy',
   'គោលនយោបាយសុវត្ថិភាពបដិសេធជាមុន',
   'default-src none, img-src self, frame-ancestors none, base-uri none, form-action none — the strictest policy of the three platforms.',
   'default-src none, img-src self, frame-ancestors none, base-uri none, form-action none — ជាគោលនយោបាយតឹងរឹងបំផុតក្នុងចំណោមវេទិកាទាំងបី។',
   'shield', 2),

  ('ptec-storage',
   'Public caching with cheap revalidation',
   'Cache សាធារណៈ និងការផ្ទៀងផ្ទាត់ថ្លៃតិច',
   'Responses are cached publicly for five minutes and carry Last-Modified, so a repeat request revalidates instead of re-downloading.',
   'ការឆ្លើយតបត្រូវបាន cache ជាសាធារណៈរយៈពេលប្រាំនាទី និងមាន Last-Modified ដូច្នេះសំណើម្តងទៀតផ្ទៀងផ្ទាត់ជាជាងទាញយកឡើងវិញ។',
   'clock', 3),

  ('ptec-storage',
   'Range requests for large files',
   'សំណើតាមចន្លោះសម្រាប់ឯកសារធំ',
   'Accept-Ranges is advertised, so an interrupted download resumes and a viewer can seek into a large PDF without fetching all of it first.',
   'Accept-Ranges ត្រូវបានប្រកាស ដូច្នេះការទាញយកដែលដាច់អាចបន្តបាន ហើយកម្មវិធីមើលអាចលោតទៅផ្នែកណាមួយក្នុង PDF ធំដោយមិនចាំបាច់ទាញយកទាំងអស់ជាមុន។',
   'download', 4),

  ('ptec-storage',
   'Served from the Cloudflare edge',
   'បម្រើពី edge របស់ Cloudflare',
   'The origin sits behind Cloudflare with HTTP/3 advertised, which keeps delivery close to readers on Cambodian networks.',
   'ដើមកំណើតស្ថិតនៅខាងក្រោយ Cloudflare ជាមួយ HTTP/3 ដែលរក្សាការបញ្ជូនឱ្យនៅជិតអ្នកអានលើបណ្តាញនៅកម្ពុជា។',
   'globe', 5),

  ('ptec-storage',
   'Deliberately not indexed',
   'មិនចូលលិបិក្រមដោយចេតនា',
   'The landing page is marked noindex: a file host should not compete with the library it serves for that library''s own search results.',
   'ទំព័រដើមកំណត់ជា noindex៖ ម៉ាស៊ីនផ្ទុកឯកសារមិនគួរប្រកួតជាមួយបណ្ណាល័យដែលវាបម្រើក្នុងលទ្ធផលស្វែងរករបស់បណ្ណាល័យនោះទេ។',
   'eyeOff', 6),

  ('ptec-storage',
   'Network error reporting',
   'ការរាយការណ៍កំហុសបណ្តាញ',
   'Reporting endpoints are configured, so delivery failures are observable rather than silent — which matters most for a service nobody looks at.',
   'ចំណុចរាយការណ៍ត្រូវបានកំណត់ ដូច្នេះការបរាជ័យក្នុងការបញ្ជូនអាចមើលឃើញ មិនស្ងាត់ស្ងៀម — ដែលសំខាន់បំផុតសម្រាប់សេវាដែលគ្មាននរណាមើល។',
   'alertCircle', 7)

  ) as f(proj_slug, title_en, title_km, description_en, description_km, icon, sort_order)
    on f.proj_slug = p.slug
 where public.is_unreviewed_project_import(p.slug);

-- ═══════════════════════════════════════════════════════════════════════════
--  5. Metrics
--
--  Only figures that can be pointed at. `is_verified` is true, which the CHECK
--  constraint permits only because every row states its source, and the source
--  is rendered next to the number on the public page. Nothing here is an
--  outcome claim — no users, no downloads, no time saved.
-- ═══════════════════════════════════════════════════════════════════════════

delete from public.project_metrics m
 using public.projects p
 where m.project_id = p.id
   and p.slug in ('ptec-digital-library', 'krusmart', 'ptec-storage')
   and public.is_unreviewed_project_import(p.slug);

insert into public.project_metrics
  (project_id, label_en, label_km, value, unit, metric_type, source_note,
   measured_at, is_verified, sort_order)
select p.id, m.label_en, m.label_km, m.value, m.unit, m.metric_type,
       m.source_note, m.measured_at::date, true, m.sort_order
  from public.projects p
  join (values

  ('ptec-digital-library', 'Published digital resources', 'ឯកសារឌីជីថលដែលបានបោះផ្សាយ',
   '114', null, 'scale',
   'Reported by the platform itself in its public llms.txt: 112 e-books, 1 thesis, 1 publication.',
   '2026-07-31', 1),

  ('ptec-digital-library', 'Public resource types', 'ប្រភេទឯកសារសាធារណៈ',
   '5', null, 'scale',
   'Books, physical catalogue, theses, publications and learning paths — the five public sections listed in the sitemap and llms.txt.',
   '2026-07-31', 2),

  ('ptec-digital-library', 'Indexable URLs', 'URL ដែលចូលលិបិក្រមបាន',
   '151', null, 'seo',
   'Counted from the published sitemap.xml, each URL carrying reciprocal English/Khmer hreflang.',
   '2026-07-31', 3),

  ('ptec-digital-library', 'Interface languages', 'ភាសាផ្ទាំងប្រើប្រាស់',
   '2', null, 'scale',
   'English and Khmer, with every public section available under both a canonical and a /km URL.',
   '2026-07-31', 4),

  ('ptec-digital-library', 'Page revalidation window', 'រយៈពេលធ្វើបច្ចុប្បន្នភាពទំព័រ',
   '300', 's', 'performance',
   'Read from the x-nextjs-stale-time response header on a prerendered catalogue page.',
   '2026-07-31', 5),

  ('krusmart', 'Teacher-facing modules', 'មុខងារសម្រាប់គ្រូ',
   '26', null, 'scale',
   'Counted from the application''s own module registry in /core/app.js.',
   '2026-07-31', 1),

  ('krusmart', 'Modules behind a subscription', 'មុខងារក្រោយការជាវ',
   '9', null, 'scale',
   'Counted from the LOCKED_FEATURES set in /core/access-control.js.',
   '2026-07-31', 2),

  ('krusmart', 'Access states', 'ស្ថានភាពសិទ្ធិប្រើប្រាស់',
   '5', null, 'scale',
   'free, trial, premium, admin and banned — the states returned by resolveTier() in /core/access-control.js.',
   '2026-07-31', 3),

  ('ptec-storage', 'Public cache lifetime', 'រយៈពេល cache សាធារណៈ',
   '300', 's', 'performance',
   'Read from the Cache-Control response header on the delivery origin.',
   '2026-07-31', 1),

  ('ptec-storage', 'Fetch directives set to none', 'Fetch directive កំណត់ជា none',
   '4', null, 'deployment',
   'default-src, frame-ancestors, base-uri and form-action are all ''none'' in the origin''s Content-Security-Policy.',
   '2026-07-31', 2)

  ) as m(proj_slug, label_en, label_km, value, unit, metric_type, source_note,
         measured_at, sort_order)
    on m.proj_slug = p.slug
 where public.is_unreviewed_project_import(p.slug);

-- ═══════════════════════════════════════════════════════════════════════════
--  6. Review notes
--
--  `needs_review` stays true. What changes is the note: the earlier one listed
--  everything, because almost everything was unverified. This one lists only
--  what is genuinely still open, so the admin dashboard points at real work.
-- ═══════════════════════════════════════════════════════════════════════════

update public.projects p
   set review_note = v.note
  from (values
    ('ptec-digital-library',
     'Verified from public evidence on 2026-07-31 — headers, CSP, robots.txt, sitemap.xml, llms.txt, the PWA manifest and the JSON-LD on live records. See docs/PROJECT-RESEARCH-2026-07-31.md. STILL OPEN, please confirm before clearing this flag: your specific responsibilities (the `responsibilities` field is deliberately empty), team size, project duration and start date, whether a repository URL can be published, and what you learned from the project. The admin CMS, roles, RLS design and search implementation are not described anywhere because /admin/ was not accessed. The 114/7/4 collection metrics are dated 2026-07-31 — refresh or retire them as the collection grows.'),
    ('krusmart',
     'Verified from public evidence on 2026-07-31 — headers, CSP, the PWA manifest, and the module registry, tier rules and sign-in flow the app serves publicly at /core/app.js, /core/access-control.js and /core/auth.js. Authorship is evidenced in-product: the account menu links "About the developer" to your portfolio. See docs/PROJECT-RESEARCH-2026-07-31.md. STILL OPEN, please confirm before clearing this flag: your specific responsibilities (`responsibilities` is deliberately empty), team size, duration, launch date, and whether the Gemini and reCAPTCHA integrations are user-facing features — the CSP proves only that their origins are allowlisted. No authenticated session was ever opened: no test credentials were supplied. Nothing about adoption, schools or revenue is published.'),
    ('ptec-storage',
     'Verified from public evidence on 2026-07-31 — the landing page, response headers, the deny-by-default CSP, and the Library''s own CSP, which references this host as both an image source and an API origin. Only "/" was requested; no path enumeration was performed. See docs/PROJECT-RESEARCH-2026-07-31.md. STILL OPEN, please confirm before clearing this flag: your specific responsibilities (`responsibilities` is deliberately empty), the storage backend and topology, whether Zima OS or on-premise hardware is involved, the upload and backup design, and whether any of that should be public at all. Nothing about internal infrastructure is currently published, which is the safe default.')
  ) as v(slug, note)
 where p.slug = v.slug
   and public.is_unreviewed_project_import(p.slug);

end;
$fn$;

comment on function public.import_project_case_studies is
  'Applies the researched bilingual case-study content for the three live platforms. Idempotent, and skips any project whose needs_review flag has been cleared. Called by migration 0016 and again by seed.sql after the project rows exist.';

-- ── Who may run it ──────────────────────────────────────────────────────────
-- It writes content, so nothing reachable from the browser should be able to
-- call it. The default EXECUTE grant to PUBLIC is revoked; the migration runner
-- and the service role keep it.
revoke all on function public.import_project_case_studies() from public;
revoke all on function public.import_project_case_studies() from anon, authenticated;
grant execute on function public.import_project_case_studies() to service_role;

-- ── Apply to this database ──────────────────────────────────────────────────
-- On an existing database the three projects are already present, so this fills
-- them in now. On a fresh `db reset` the table is still empty at this point and
-- the call is a no-op — seed.sql calls it again once the rows exist.
select public.import_project_case_studies();
