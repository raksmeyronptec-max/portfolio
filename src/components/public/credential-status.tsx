import { Icon, type IconName } from "@/components/ui/icon";
import { StatusDot } from "@/components/ui/primitives";
import type { CredentialValidity, CredentialVerification } from "@/lib/data/certificates";
import type { Dictionary } from "@/i18n/messages/en";
import { cn } from "@/lib/utils/cn";

/**
 * Verification and validity, shown as two separate facts.
 *
 * ── Why this component exists ──────────────────────────────────────────────
 * The page previously rendered one field for both, and the result was that
 * every credential on the site — permanent school diplomas, a university
 * transcript, four commendation letters — displayed "Active" beside a green
 * dot. A visitor reads a green dot next to a credential as *verified*, and not
 * one of them is: none has a working issuer verification route.
 *
 * So the two questions are answered separately and honestly:
 *
 *   validity      is this qualification still in force?
 *   verification  has anyone established that it is genuine, and how?
 *
 * ── Rules this encodes ─────────────────────────────────────────────────────
 *  1. Never colour alone. Every state renders its label as text; the dot and the
 *     icon are redundant with it, so the meaning survives greyscale, a colour
 *     vision deficiency, and a screen reader.
 *  2. Green is reserved for verification that actually happened. "Awaiting
 *     verification" is neutral, not green and not red — it is not a failure, it
 *     is an absence, and colouring it red would misrepresent an honest state as
 *     a problem.
 *  3. A different icon per state. A check mark on every row is how "verified"
 *     stops meaning anything.
 */

type Tone = "success" | "neutral" | "warning" | "danger";

const VERIFICATION_PRESENTATION: Record<
  CredentialVerification,
  { tone: Tone; icon: IconName }
> = {
  // Established by the issuer. The only state that earns a check and green.
  verified_by_issuer: { tone: "success", icon: "checkCircle" },
  // A route exists but nobody has walked it — a link, not a confirmation.
  verification_link_available: { tone: "neutral", icon: "externalLink" },
  // Reviewed by the owner. Real work, but not issuer verification, so it gets
  // its own mark rather than borrowing the check.
  manually_reviewed: { tone: "neutral", icon: "eye" },
  awaiting_verification: { tone: "warning", icon: "clock" },
  // Not a fault of the credential; the issuer simply has no such service.
  issuer_verification_unavailable: { tone: "neutral", icon: "info" },
  unverified: { tone: "warning", icon: "alertCircle" },
};

const VALIDITY_PRESENTATION: Record<CredentialValidity, { tone: Tone; icon: IconName }> = {
  valid: { tone: "success", icon: "checkCircle" },
  // A diploma does not expire. That is a plain fact, not a positive status, so
  // it is neutral rather than green.
  no_expiry: { tone: "neutral", icon: "infinity" },
  expired: { tone: "warning", icon: "clock" },
  revoked: { tone: "danger", icon: "alertTriangle" },
  unknown: { tone: "neutral", icon: "help" },
};

const TONE_CLASS: Record<Tone, string> = {
  success: "text-success-foreground",
  neutral: "text-foreground-muted",
  warning: "text-warning-foreground",
  danger: "text-danger-foreground",
};

export function VerificationStatus({
  status,
  t,
  className,
  showIcon = true,
}: {
  status: CredentialVerification;
  t: Dictionary;
  className?: string;
  showIcon?: boolean;
}) {
  const { tone, icon } = VERIFICATION_PRESENTATION[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[0.8125rem] font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      {showIcon ? <Icon name={icon} size={14} aria-hidden="true" /> : null}
      {t.certificates.verification[status]}
    </span>
  );
}

/**
 * Validity, rendered only when it says something.
 *
 * `unknown` renders nothing at all. "Validity unknown" on a card is noise that
 * pushes the credential title down the visual order to report an absence, and
 * the detail page states it properly in the metadata list where a reader has
 * asked for that level of detail.
 */
export function ValidityStatus({
  status,
  t,
  className,
  showIcon = true,
}: {
  status: CredentialValidity;
  t: Dictionary;
  className?: string;
  showIcon?: boolean;
}) {
  if (status === "unknown") return null;

  const { tone, icon } = VALIDITY_PRESENTATION[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[0.8125rem]",
        TONE_CLASS[tone],
        className,
      )}
    >
      {showIcon ? <Icon name={icon} size={14} aria-hidden="true" /> : null}
      {t.certificates.validity[status]}
    </span>
  );
}

/**
 * The pair, for a card.
 *
 * Verification first: it is what a visitor is actually asking when they look at
 * a credential. Validity is secondary and frequently uninteresting — a diploma
 * from 2023 has no expiry and never will.
 *
 * A `StatusDot` is drawn only for verified credentials. Everywhere else the icon
 * carries the state and a second coloured mark would just be decoration
 * competing with the title.
 */
export function CredentialStatusPair({
  verification,
  validity,
  t,
  className,
}: {
  verification: CredentialVerification;
  validity: CredentialValidity;
  t: Dictionary;
  className?: string;
}) {
  return (
    <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      {verification === "verified_by_issuer" ? (
        <StatusDot tone="success" className="size-1.5" />
      ) : null}
      <VerificationStatus status={verification} t={t} />
      <ValidityStatus status={validity} t={t} className="text-foreground-subtle" />
    </span>
  );
}
