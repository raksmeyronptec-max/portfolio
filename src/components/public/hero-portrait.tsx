import Image from "next/image";

import type { Dictionary } from "@/i18n/dictionary";

/* ═══════════════════════════════════════════════════════════════════════════
   Hero portrait.

   ── The problem, measured rather than guessed ──────────────────────────────
   The source photograph (`public/image/MyPF.jpg` — a PNG despite the
   extension, 1024×1536) is a studio shot on a green screen. Sampling it says
   exactly what was wrong with every CSS-only attempt to tame that:

     region            R    G    B   luminance  green excess
     face            141  111   94        116            −6
     backdrop, lit    19   51    7         41           +38
     backdrop, edge    5    9    3          8            +5
     suit             17   15   19         16            −3

   Two facts follow, and both defeat a global filter:

     1. **The face was never green.** It is warm, correctly exposed skin. The
        previous `saturate(0.3)` — applied to kill the backdrop — drained the
        one region that was already right, and `brightness(0.97)` plus a 0.82
        vignette plus a 40%-tall opaque scrim is what made the card too dark.

     2. **The backdrop is a large radial centred behind the head**, not a rim
        light. Edge-anchored washes never reach it; a masked `color` blend
        leaves a halo on the mask boundary and turns the suit blue, because the
        shoulders run to the frame edge and no ellipse separates subject from
        background.

   ── The fix ────────────────────────────────────────────────────────────────
   Remove the backdrop instead of fighting it. `scripts/key-portrait.mjs`
   chroma-keys and despills it into `portrait-keyed.webp`, which carries an
   alpha channel. That turns an image-processing problem into a layout one: the
   lighting below is genuinely *behind* the subject, so it can be retuned freely
   without ever touching the photograph — which now needs almost no filtering at
   all.

   Layer order, back to front:

     1  ambient    glows outside the card, lighting the section
     2  field      the navy ground the subject stands in
     3  lights     cyan low-left, indigo upper-right, gold floor reflection
     4  grid       a faint coordinate rule — the mathematics, stated quietly
     5  subject    the keyed portrait, essentially untouched
     6  vignette   a gentle corner falloff over everything
     7  scrim      just enough to seat the role chips
   ═══════════════════════════════════════════════════════════════════════════ */

export function HeroPortrait({
  src,
  alt,
  t,
}: {
  src: string;
  alt: string;
  t: Dictionary;
}) {
  return (
    <div className="relative mx-auto w-full max-w-[24rem]">
      {/* ── 1. Ambient light, outside the card ─────────────────────────────
          The only blurred layers in the composition, and all three are small
          boxes at `-z-10` — nothing the browser repaints on scroll. */}
      <div
        aria-hidden="true"
        className="absolute -inset-10 -z-10 rounded-full opacity-60 blur-2xl"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgb(var(--identity-indigo-rgb) / 0.38), transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-8 -left-10 -z-10 size-44 rounded-full opacity-50 blur-2xl"
        style={{
          background:
            "radial-gradient(circle, rgb(var(--identity-cyan-rgb) / 0.45), transparent 70%)",
        }}
      />

      {/* ── Frame ────────────────────────────────────────────────────────────
          A 1px padded wrapper whose background is the gradient, so the ring
          follows the squircle exactly rather than approximating it. */}
      <div
        className="rounded-[2rem] p-px shadow-lg"
        style={{
          background:
            "linear-gradient(150deg, rgb(var(--identity-indigo-rgb) / 0.5), rgb(var(--identity-cyan-rgb) / 0.28) 48%, rgb(var(--identity-gold-rgb) / 0.42))",
        }}
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-[calc(2rem-1px)]">
          {/* ── 2. The field the subject stands in ───────────────────────── */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(165deg, rgb(18 24 46), rgb(10 13 26) 60%, rgb(8 10 20))",
            }}
          />

          {/* ── 3. Studio lighting, on its own layer ─────────────────────────
              Two key lights and a floor bounce, placed where a photographer
              would put them: cyan low and left, indigo high and right, a thin
              warm reflection along the bottom. Because the subject is keyed,
              these read as light *around* him rather than a tint *over* him. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background: [
                "radial-gradient(52% 44% at 12% 68%, rgb(var(--identity-cyan-rgb) / 0.34), transparent 72%)",
                "radial-gradient(56% 48% at 88% 26%, rgb(var(--identity-indigo-rgb) / 0.42), transparent 74%)",
                "radial-gradient(70% 26% at 50% 104%, rgb(var(--identity-gold-rgb) / 0.2), transparent 70%)",
              ].join(", "),
            }}
          />

          {/* ── 4. Coordinate rule ───────────────────────────────────────────
              The mathematics, said once and quietly: a faint grid fading out
              before it reaches the subject. Two repeating-linear-gradients, so
              it costs one paint and no extra element per line. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.16]"
            style={{
              background: [
                "repeating-linear-gradient(to right, rgb(var(--identity-cyan-rgb) / 0.5) 0 1px, transparent 1px 48px)",
                "repeating-linear-gradient(to bottom, rgb(var(--identity-cyan-rgb) / 0.5) 0 1px, transparent 1px 48px)",
              ].join(", "),
              maskImage:
                "radial-gradient(80% 70% at 50% 45%, transparent 30%, black 85%)",
              WebkitMaskImage:
                "radial-gradient(80% 70% at 50% 45%, transparent 30%, black 85%)",
            }}
          />

          {/* ── 5. The subject ───────────────────────────────────────────────
              Almost untouched, which is the whole return on keying the
              backdrop. `brightness(1.04)` lifts the face just clear of the
              navy behind it; saturation and contrast are left alone. Compare
              the previous `saturate(0.3) brightness(0.97)`.

              The single `priority` image on the page. `fill` inside a fixed
              aspect-ratio box reserves the space before the file arrives, so
              this cannot contribute to layout shift. */}
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(min-width: 1024px) 24rem, (min-width: 640px) 60vw, 88vw"
            priority
            className="object-cover object-top [filter:brightness(1.04)_contrast(1.02)]"
          />

          {/* ── 6. Vignette ─────────────────────────────────────────────────
              Gentle, and over the subject as well as the field, so the whole
              card falls off together instead of the person floating on a
              separately-darkened background. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(112% 88% at 50% 36%, transparent 48%, rgb(6 8 16 / 0.5) 100%)",
            }}
          />

          {/* ── 7. Chip scrim ───────────────────────────────────────────────
              Lower quarter only, stopping short of opaque. Its one job is to
              guarantee contrast for the chips. */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[rgb(6_8_16_/_0.85)] to-transparent"
          />

          {/* ── Role chips ──────────────────────────────────────────────────
              Two, not four. Translucent dark rather than filled pills, seated
              at the bottom edge where the scrim guarantees contrast and well
              clear of the face. Real text, so they are searchable and
              translated — not baked into the image. */}
          <ul className="absolute inset-x-4 bottom-4 flex flex-wrap gap-1.5">
            {[t.home.hero.roles.educator, t.home.hero.roles.builder].map((role) => (
              <li
                key={role}
                className="rounded-(--radius-full) border border-white/20 bg-[rgb(8_10_18_/_0.55)] px-3 py-1 text-[0.75rem] font-medium text-white backdrop-blur-sm"
              >
                {role}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
