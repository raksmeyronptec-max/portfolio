# R2 CORS, and why a book upload needs it

A publication file is uploaded **straight from the browser to R2**, not through
the application. The reason is a hard platform limit: a serverless function
accepts a request body of at most 4.5 MB on Vercel, and a typeset mathematics
book is routinely larger than that. The upload was being rejected by the
platform before any of our code ran, with a response that was not JSON — so the
uploader could report only "Upload failed", with nothing in any server log,
because the request never reached a server of ours.

`/api/admin/media/direct-upload` therefore signs a short-lived URL for a key the
*server* chooses, the browser PUTs to it, and the server then reads the object
back to validate its magic bytes and register the row. An object that fails
validation is deleted.

That PUT is a cross-origin request, so the bucket must carry a CORS policy.
A bucket with none answers `NoSuchCORSConfiguration`, the preflight fails, and
the browser again reports only "Failed to fetch".

## Applying it

```bash
node scripts/configure-r2-cors.mjs --origin https://your-site.example
node scripts/configure-r2-cors.mjs --show     # inspect the current policy
```

Local development origins are always included. Re-running replaces the policy,
so add every origin you need in one command.

**Run this again whenever the site gets a new origin** — a custom domain, or a
different deployment. A Vercel preview deployment has its own hostname and will
not be covered.

## What the policy grants

`PUT` and `HEAD`, from the named origins only. Deliberately not:

- **`GET`** — reads still go through the application. A CORS policy is not an
  access grant, but there is no reason to widen it past what the uploader uses.
- **`*`** — a wildcard origin would let any site on the internet drive an upload
  with a URL it had somehow obtained.

CORS decides which *origins may make the request*. It does not decide who may
obtain a presigned URL in the first place — that is
`/api/admin/media/direct-upload`, which checks the session and the `uploadMedia`
permission before signing anything, and which pins the object key so the browser
cannot choose where its bytes land.

## Also required

`R2_ACCOUNT_ID` must be set wherever the site is built. `next.config.ts` derives
the S3 API origin from it and adds it to `connect-src`; without that the browser
blocks the PUT under the site's own Content Security Policy, before CORS is even
reached. It is added to `connect-src` and nothing else — nothing is ever
*rendered* from the S3 endpoint, and the private bucket must stay unreadable
from the browser.


# Public access — a separate setting, and a silent one

CORS decides who may *upload*. It says nothing about who may *read*, and R2
buckets are private by default.

Public reads need the bucket's **r2.dev development URL enabled**, or a custom
domain attached. Neither is visible from the S3 API, so nothing in this codebase
can detect it while uploading. With it off, every symptom points the wrong way:
the upload succeeds, the `media_assets` row is correct, `publicStorageUrl()`
builds a URL that looks right — and every image on the site is broken, because
that URL answers `401`. Nothing is logged, because no server of ours is in the
request path.

Check it:

```bash
node scripts/configure-r2-cors.mjs --check
```

To enable: Cloudflare dashboard → R2 → the **public** bucket → Settings →
Public access → allow the `r2.dev` subdomain, or attach a custom domain and
point `NEXT_PUBLIC_R2_PUBLIC_URL` at it.

**Only the public bucket.** `portfolio-private` holds certificate originals,
resume PDFs, book PDFs, archival originals and LaTeX sources; making it public
would expose every one of them, which is the single thing the two-bucket split
exists to prevent.
