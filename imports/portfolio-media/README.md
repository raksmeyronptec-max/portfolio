# Local media import

Put folders of photographs here, then open **Admin → Media library → Import from
a folder** while running `npm run dev`.

```
imports/portfolio-media/
├── ptom-plp-kakoh-2024/
│   ├── IMG_4477.HEIC
│   └── IMG_4478.HEIC
├── korean-teacher-exchange/
└── science-fair/
```

## What the importer does

Sub-folders are read up to four levels deep. For every image it finds, it
reports the size, the dimensions, the EXIF capture date, and whether the file is
a duplicate of another in the scan or of something already in the library.

Nothing is imported by scanning. For the files you tick, the importer:

1. decodes the image — including HEIC, so iPhone photographs work directly;
2. **strips all metadata, including GPS coordinates**;
3. re-encodes to WebP and generates thumbnail, card and preview sizes;
4. gives it a readable public name derived from the folder, keeping the original
   camera filename as private technical metadata;
5. registers it as **pending privacy review**.

Your original files are read and never modified, moved or deleted.

## What it does not do

**Nothing imported here is public.** An imported file becomes visible on the site
only when you attach it to a journey story, complete the privacy checklist on
that attachment, and mark it public — three separate, deliberate steps, each one
enforced by a database constraint rather than by the interface.

**Video is not imported.** Video files found here are listed with their size so
you know they were seen, but this CMS references video rather than hosting it:
there is no transcoder in the stack and the upload ceiling is 10 MB. Upload each
video to YouTube or Vimeo, then add it to a journey story with its address and a
poster frame.

## Folder names are hints, never titles

A folder called `ptom-plp-kakoh-2024` will suggest the "PTOM and PLP Fieldwork at
Kakoh Primary School" story. The suggestion is only a shortcut for you — a folder
name is never written to a public field.

## Privacy

Files placed here are **git-ignored** and must stay that way. They are
photographs of real classrooms, pupils, colleagues and guests. Committing them
would publish to the repository exactly the material the review process exists to
gate.

This whole feature only works in development. In production the filesystem holds
nothing but the deployment bundle, and the API route returns 404.
