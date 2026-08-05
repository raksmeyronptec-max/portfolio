export function AboutSectionHeading({
  number,
  eyebrow,
  title,
  description,
  id,
}: {
  number: string;
  eyebrow: string;
  title: string;
  description?: string;
  id: string;
}) {
  return (
    <div className="about-v4-section-heading">
      <div className="about-v4-kicker">
        <span aria-hidden="true">{number}</span>
        <p>{eyebrow}</p>
      </div>
      <h2 id={id}>{title}</h2>
      {description ? <p className="about-v4-section-description">{description}</p> : null}
    </div>
  );
}
