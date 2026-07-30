# Internal Audit — Portfolio v1 (pre-redesign)

Audit date: 2026-07-29
Audited artefacts: repository at `Portfolio-Ron-Raksmey-main`, live site
`https://portfolio-ron-raksmey.netlify.app/`, and the three linked production
projects.

---

## 1. What the old codebase actually was

| Aspect | Finding |
| --- | --- |
| Framework | **None.** Hand-written static site. No `package.json`, no build step, no dependency manifest. |
| Files | `index.html` (1,336 lines, 79 KB), `css/style.css` (2,469 lines), `js/script.js` (363 lines) |
| Styling | Single global stylesheet, CSS custom properties (`--neon`, `--text-main`, `--border`, …) plus a large second `<style>` block inlined in `index.html` |
| Routing | None. Single page, in-page hash anchors (`#about`, `#journey`, `#skills`, `#projects`, `#testimonials`, `#contact`) |
| Theme system | `data-theme` attribute on `<html>`, persisted in `localStorage`, toggled in `js/script.js` |
| i18n | `data-km` attributes swapped via `innerHTML` by an inline `<script>`; language stored in `localStorage` |
| Serverless | 2 Netlify functions (CommonJS): `contact.js` (Telegram relay), `chat.js` (Gemini chatbot) |
| Secondary app | `ask-ron-bot-main/` — a separate static chat UI embedded via `<iframe>` |
| Deployment | Netlify, `publish = "."`, functions directory configured |
| Version control | **No git repository present** in the delivered folder |

### Content inventory extracted from `index.html`

Verified personal content that is worth migrating:

- Name: Ron Raksmey (រុន រស្មី)
- Location: Phnom Penh, Cambodia
- Year 2 Student Teacher (គរុនិស្សិត), Primary Education 12+4, **Phnom Penh
  Teacher Education College (PTEC)** — expected 2028, Mon–Fri
- Year 3 **Bachelor of Mathematics, Khemarak University** — expected 2027, Sat–Sun
- High school: **Cambodia Japan Friendship Middle and High School**, graduated 2023,
  BacII Science track, overall Grade "A"
- Teaching practicum: **Capital Practice Primary School**
  (សាលាបឋមសិក្សាអនុវត្តរាជធានី)
- Languages: Khmer (native), English (intermediate), French (A1)
- Email `raksmeyron97@gmail.com`, Telegram `@Ron_Raksmey`, Facebook `ronraksmey`
- CV asset: `CV/CV_Ron_Raksmey.pdf`
- 3 testimonials: Ron Saroeun (Web Developer, Wing Bank), Kem Deth (Web
  Developer), Hum Sanet (Course Representative, PTEC)

---

## 2. Contradictions found in the existing content

These must **not** be published as-is. They are migrated as drafts marked
*Needs review*.

1. **Institution conflict for the 3.79 GPA.** `index.html` credits the 3.79 GPA
   to *"RUPP"* / *"Royal University of Phnom Penh"* in the hero stats and the
   achievements carousel, while the education card and the AI chatbot prompt
   state the mathematics degree is at **Khemarak University**. The chatbot
   prompt (`netlify/functions/chat.js`) says *"3.79 GPA … as a Mathematics Major
   at RUPP"* and simultaneously *"Year 3 Bachelor of Mathematics student at
   Khemarak University"*. One of these is wrong; the codebase cannot resolve it.
2. **`2 Dual Degrees` stat.** Neither degree is completed (expected 2027 / 2028),
   so "2 degrees" is a claim about enrolment, not attainment.
3. **BacII "99.734 percentile".** No source in the repo. Presented as a hard
   number next to a decorative 99% progress bar.
4. **Practicum has no dates.** The timeline entry uses the literal string
   `Experience` where a date should be.
5. **Canonical URL points at the wrong host.** `<link rel="canonical">` and
   `og:url` both say `https://ron-raksmey.vercel.app`, but the site is served
   from `portfolio-ron-raksmey.netlify.app`.
6. **The old site never mentions the three software projects at all** —
   KruSmart, the PTEC Digital Library and PTEC Storage are absent except for a
   "Back to PTEC" header link. The developer half of the positioning is missing
   entirely.

---

## 3. Security concerns

| Severity | Finding |
| --- | --- |
| **Critical** | **Live Telegram bot token committed in plaintext.** `netlify/functions/contact.js` line ~150 hardcodes `BOT_TOKEN = "<redacted-bot-token>"` and `CHAT_ID = "<redacted-chat-id>"`, directly contradicting the file's own header comment claiming the token is "stored in Netlify env vars, never shipped to the browser". **This token must be revoked and rotated via @BotFather.** It is treated as compromised. |
| High | **Third party's private mobile number published.** `+855-88-916-2788` is rendered in the References section for Ron Saroeun. |
| Medium | `Access-Control-Allow-Origin: "*"` on both functions, so any origin can drive the Telegram relay and the Gemini endpoint. |
| Medium | Rate limiting is per-instance in-memory (`const ipHistory = {}`), which resets on every serverless cold start and is not shared across concurrent instances. |
| Medium | No spam protection on the contact form beyond rate limiting — no honeypot, no challenge. |
| Low | No security headers at all: no CSP, no `X-Frame-Options`, no `X-Content-Type-Options`, no `Referrer-Policy`. Notably, Ron's *other* projects do set these correctly. |
| Low | `applyLanguage()` assigns translations with `el.innerHTML = el.getAttribute('data-km')`, an `innerHTML` sink fed from the DOM. Not currently exploitable (values are author-controlled), but it is an unnecessary sink. |

---

## 4. Accessibility issues

- **Skip link target is wrong.** `<a href="#about" class="skip-link">` skips to
  the About section, silently jumping past the entire hero.
- **No `<main>` element and no landmarks.** Content is a flat list of
  `<section>`s inside `<body>`. The availability banner uses
  `role="banner"`, which duplicates the `<header>` landmark.
- **Language switching never updates `lang`.** `<html lang="en">` is static; the
  Khmer version is served with `lang="en"`, so screen readers use the wrong
  voice for all Khmer content.
- **Decorative percentages are announced.** Skill bars are plain `<div>`s with
  `95%` text and no `role="meter"` / `aria-*`, so they are read as meaningless
  numbers.
- **The carousel is not keyboard operable.** `#pjTrack` cards are shown/hidden
  with `.pj-hidden` (opacity/transform) rather than being removed from the a11y
  tree, so off-screen cards stay focusable and readable while invisible.
- **The mobile menu has no focus trap, no Escape handler and no scroll lock.**
- **The chat popup `<iframe>` is always in the DOM** and remains reachable when
  visually hidden.
- **Star ratings are cosmetic.** `aria-label="5 stars"` on invented ratings for
  personal references.
- **Contrast risks.** Repeated `opacity: 0.55` and `opacity: 0.7` on body text
  over tinted backgrounds; `#22ff6e` neon on light theme is very likely below
  4.5:1 for text.
- **Motion is unconditional.** The full-viewport animated canvas
  (45 particles + scrolling grid, `requestAnimationFrame` forever), floating
  photo, pulse glows and the typing effect all ignore
  `prefers-reduced-motion`.
- `aria-live="polite"` wraps the typing effect, so the tagline is re-announced
  on every character.

---

## 5. Performance issues

- **Permanent `requestAnimationFrame` loop** painting a full-viewport canvas
  grid + 45 shadowed glyphs, with `shadowBlur` on every glyph every frame. This
  never idles and runs on mobile.
- **Four font families loaded in one blocking request** (Battambang, Syne, DM
  Sans, JetBrains Mono) with 11 weights total.
- **Unoptimised raster images.** JPG/PNG only, no AVIF/WebP, no responsive
  `srcset`. The hero portrait is not preloaded.
- **`onerror` fallbacks fetch from `images.unsplash.com`**, adding a third-party
  origin on the error path.
- **The chat iframe loads eagerly** on first paint, pulling a second HTML
  document plus its own CSS/JS even if never opened.
- **CLS sources:** typing effect on an unreserved line, `data-km` swaps that
  change text length with no reserved space, dismissible banner above the hero
  that reflows content.
- 79 KB of un-minified HTML and 2,469 lines of un-minified CSS, no bundling.

---

## 6. SEO issues

- **Canonical and `og:url` point to the wrong domain** (`ron-raksmey.vercel.app`).
- **`og:image` is a relative path** (`image/MyPF.jpg`); Open Graph requires an
  absolute URL, so social previews have no image.
- **One URL for the whole site.** No indexable page for any project,
  certificate, or the resume — nothing to rank on beyond the homepage.
- **No `sitemap.xml`, no `robots.txt`.**
- **No hreflang and no distinct URL per language**, so the Khmer content is
  invisible to search engines: it only exists after a client-side click.
- **No structured data** — no `Person`, no `ProfilePage`, nothing.
- No Twitter card tags. `og:image:width`/`height` absent.
- The `<title>` and description market only "Primary School Educator", omitting
  the entire software-engineering identity.
- **Heading hierarchy is broken:** `h4` used for the "Education" and "Languages"
  sub-blocks with no intervening `h3` in that container.

---

## 7. UX problems

- Single scrolling page; nothing is linkable, shareable, or bookmarkable.
- The achievements carousel shows one card at a time, hides two behind
  transforms, and requires clicking through to see three items that would fit in
  a grid.
- Percentage bars imply precision that cannot be justified ("Patience 95%").
- The "Back to PTEC" button in the primary nav sends visitors *off* the
  portfolio from the top-left of the header.
- The availability banner competes with the hero for first attention.
- Chat launcher, back-to-top button and chat panel all stack in the
  bottom-right corner.
- Khmer translations are injected as full HTML strings duplicated inside
  `data-km` attributes, so every copy edit must be made twice, in an attribute.
- The contact form claims success on HTTP 200 from the relay, which is honest,
  but the failure copy tells users to "email me directly" without an inline
  mailto link.

---

## 8. Content gaps

- No case studies. Three real, deployed systems exist and none are described.
- No certificate library — BacII, transcripts and awards are only referenced in
  prose.
- No résumé page (only a raw PDF download).
- No dedicated About / Experience / Education pages.
- No verifiable dates on the practicum.
- Testimonials have no organisation/relationship metadata and no consent record.

---

## 9. Technical debt

- Content, layout and behaviour are welded together in one HTML file; there is
  no source of truth for any datum.
- Bilingual copy is stored twice per element, in markup attributes.
- Three separate style layers (external CSS, a 250-line inline `<style>`, and
  hundreds of inline `style="…"` attributes).
- Four inline `<script>` IIFEs in `index.html` in addition to `js/script.js`,
  with a global `window.applyLanguage` used for cross-script coupling.
- `js/script.js` executes at import time with no null-guards on
  `getElementById` (e.g. `form.querySelector` on line 224), so any markup change
  breaks the whole script.
- The embedded chatbot duplicates the design system in
  `ask-ron-bot-main/css/style.css` (503 lines).
- The Gemini system prompt hardcodes biography and GPA claims, giving a **third**
  copy of the same facts that drifts from the other two.
- `data/Structure.txt` describes a folder layout that does not match reality.

---

## 10. Current strengths worth preserving

- **Genuinely bilingual intent.** Khmer copy already exists and is good quality;
  it becomes the seed for the `*_translations` tables.
- **Server-side contact relay.** The instinct to keep the Telegram call
  server-side is right — only the implementation leaked the token.
- **Server-side rate limiting with cooldown + hourly cap** and a countdown UI
  that reflects the server's `secondsLeft`.
- **Real dark/light theming** via `data-theme` and CSS variables, persisted.
- **Sensible image hints** already present: `loading="lazy"`, `decoding="async"`,
  explicit `width`/`height` on carousel images.
- **A shared SVG sprite** (`<symbol>` + `<use>`) instead of an icon font.
- A skip link, `aria-expanded` on the menu button, `aria-label`s on icon buttons
  and a `<noscript>` fallback — the author was already thinking about a11y.
- `IntersectionObserver` for reveal and scrollspy rather than scroll handlers.
- `rel="noopener noreferrer"` used consistently on external links.

## 11. Reuse / replace decisions

**Reused (ported):** Khmer + English copy, theme-toggle concept, the icon-sprite
approach (now a typed React icon set), server-side contact validation and rate
limiting, image loading hints, `IntersectionObserver` reveal (now
motion-gated), the CV PDF and all photographs.

**Replaced:** the single-file architecture (→ App Router routes), `data-km`
attribute i18n (→ dictionaries + translation tables), skill percentage bars
(→ evidence-based capability groups linked to projects), the achievements
carousel (→ filterable grid + case-study pages), the animated canvas
background (→ removed), the star ratings (→ removed), hardcoded content
(→ Supabase), the leaked-token function (→ route handler reading env vars),
and the iframe chatbot (→ lazy-mounted on demand, out of first paint).

---

## 12. Verified facts about the three linked projects

Gathered from live HTTP responses and rendered markup on 2026-07-29. Response
headers and Content-Security-Policy allowlists are used as evidence of the
platforms actually in use, so nothing here is guessed.

### KruSmart — `https://www.krusmart.org/`
- Title: `KruSmart (PTEC) - ជំនួយការគ្រូបង្រៀនឌីជីថល` ("Digital Teacher Assistant")
- Khmer-first interface; landing page is an account gate
- Registration form observed: email, password, confirm-password, live
  password-strength meter, terms-of-use acceptance, and an arithmetic
  bot-protection challenge (`? + ? =`)
- `server: Netlify`, `content-type: text/html; charset=UTF-8` (no framework header)
- CSP `connect-src` evidences: Firebase (`*.firebaseio.com`,
  `*.firebaseapp.com`), Google Generative Language API, EmailJS,
  Google Analytics, reCAPTCHA, and a separate service at
  `krusmart-khqr.onrender.com` (KHQR)
- Sets `Strict-Transport-Security` (preload), `X-Frame-Options: SAMEORIGIN`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`

### PTEC Digital Library — `https://library.ptec.edu.kh/`
- Title: `Free Digital Library for Teacher Education`
- Khmer name: បណ្ណាល័យវិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ
- Sections observed: Books, Theses, Publications, Learning Paths, Physical
  Library, News & Events, About, Our Journey, Contact, Library Rules, Library
  Timings, Library Collection, Library Committee, Library Team, Privacy Policy
- `x-powered-by: Next.js`, `server: Vercel`, `x-nextjs-prerender: 1`,
  `x-nextjs-stale-time: 300` → prerendered with a 300s revalidation window
- CSP evidences: Supabase (`*.supabase.co` + `wss://*.supabase.co`),
  Cloudflare R2 (`*.r2.dev`, `*.r2.cloudflarestorage.com`), Vercel Blob,
  Cloudflare Turnstile, Google OAuth, Vercel Analytics, Open Library covers,
  and `api.storage-ptec.online`
- Hardened headers: `frame-ancestors 'none'`, `object-src 'none'`,
  `form-action 'self'`, `X-Frame-Options: DENY`, HSTS preload
- Public contact data on page: St. 271, Sangkat Teuk Laork 3, Khan Toul Kork,
  Phnom Penh; (+855) 92 788 990; info@ptec.edu.kh; Mon–Fri 07:00–17:00,
  Sat 08:00–16:00, Sun closed

### PTEC Storage — `https://storage-ptec.online/`
- Title: `PTEC Library Storage`
- Body text: "File delivery service for library.ptec.edu.kh. There is nothing to
  see here." → deliberately contentless infrastructure endpoint
- `server: cloudflare`, `cf-cache-status: DYNAMIC`
- Maximally restrictive CSP: `default-src 'none'`, `img-src 'self'`,
  `frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'none'`
- Referenced from the Library's CSP as both `*.storage-ptec.online` (images) and
  `api.storage-ptec.online` (XHR), confirming it serves the Library's files

### Deliberately left blank for the admin to confirm

Every seeded project record carries `needs_review = true` and empty values for
fields that cannot be verified from outside: team size, duration, exact
responsibilities, user counts, performance scores, adoption numbers, repository
URLs, and launch dates. The admin UI surfaces these as *Needs confirmation*
and the publish action warns before they go live.
