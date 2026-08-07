import Image from "next/image";

/**
 * The committed portrait is already chroma-keyed, so the hero can give it a
 * dark studio field without filtering the subject or reintroducing the green
 * backdrop from the original photograph.
 */
export function HeroPortrait({
  src,
  alt,
  proofLabel,
}: {
  src: string;
  alt: string;
  proofLabel: string;
}) {
  return (
    <div className="home-hero-portrait">
      <div className="home-hero-portrait__frame">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 24rem, (min-width: 640px) 60vw, 92vw"
          priority
          className="home-hero-portrait__image"
        />
      </div>

      <p className="home-hero-proof">{proofLabel}</p>
    </div>
  );
}
