import { z } from "zod";

import { locales } from "@/i18n/config";

/**
 * Contact form contract.
 *
 * The same schema runs in the browser (for immediate feedback) and on the server
 * (as the actual gate). Client-side validation is a convenience; the server-side
 * parse is the one that decides. The database then adds a third layer of CHECK
 * constraints, so the limits below cannot be bypassed by calling the API directly.
 */

export const projectTypes = [
  "teaching",
  "tutoring",
  "collaboration",
  "development",
  "speaking",
  "academic",
  "other",
] as const;

export const preferredContactMethods = ["email", "telegram", "either"] as const;

/** Field length limits, mirrored by the CHECK constraints on contact_messages. */
export const contactLimits = {
  nameMax: 100,
  emailMax: 254,
  organizationMax: 150,
  subjectMax: 150,
  messageMin: 10,
  messageMax: 2000,
} as const;

/**
 * Error codes rather than English strings.
 *
 * The server must not decide which language the user reads. It returns a code, the
 * client maps it through the locale dictionary. This is what makes the form's
 * validation messages properly bilingual instead of English-only.
 */
export const contactFieldSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "nameRequired" })
    .max(contactLimits.nameMax, { message: "nameTooLong" }),

  email: z
    .string()
    .trim()
    .min(1, { message: "emailRequired" })
    .max(contactLimits.emailMax, { message: "emailInvalid" })
    // Zod's email check is stricter than the loose regex v1 used and rejects the
    // shapes that would fail the database CHECK anyway.
    .email({ message: "emailInvalid" }),

  organization: z
    .string()
    .trim()
    .max(contactLimits.organizationMax, { message: "organizationTooLong" })
    .optional()
    .or(z.literal("")),

  subject: z
    .string()
    .trim()
    .max(contactLimits.subjectMax, { message: "subjectTooLong" })
    .optional()
    .or(z.literal("")),

  message: z
    .string()
    .trim()
    .min(contactLimits.messageMin, { message: "messageTooShort" })
    .max(contactLimits.messageMax, { message: "messageTooLong" }),

  projectType: z.enum(projectTypes).optional().or(z.literal("")),
  preferredContact: z.enum(preferredContactMethods).optional().or(z.literal("")),

  consent: z.literal(true, { message: "consentRequired" }),
});

export const contactSubmissionSchema = contactFieldSchema.extend({
  locale: z.enum(locales).default("en"),

  /**
   * Honeypot. A field styled off-screen and hidden from assistive technology,
   * which a human will never fill in. Naming it something a naive bot will want to
   * autofill (`website`) is the whole trick.
   *
   * Chosen over a CAPTCHA because it adds zero friction and no third-party
   * request. It is combined with server-side rate limiting rather than relied on
   * alone.
   */
  website: z.string().max(0).optional().or(z.literal("")),

  /**
   * Milliseconds between the form rendering and being submitted. A submission
   * faster than a human could type is almost certainly automated.
   */
  elapsedMs: z.number().int().nonnegative().optional(),
});

export type ContactSubmission = z.infer<typeof contactSubmissionSchema>;
export type ContactFieldErrors = Partial<
  Record<keyof z.infer<typeof contactFieldSchema>, string>
>;

/** Field errors keyed by field name, ready to hand to the form. */
export function collectFieldErrors(error: z.ZodError): ContactFieldErrors {
  const result: ContactFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string") continue;
    if (result[field as keyof ContactFieldErrors]) continue;
    result[field as keyof ContactFieldErrors] = issue.message;
  }

  return result;
}

/**
 * Heuristic spam score, 0–100.
 *
 * Used for triage in the inbox, never to silently reject a message. A false
 * positive that discards a real enquiry is far more costly than one that lands in
 * the inbox marked "likely spam", so nothing here blocks a submission.
 */
export function scoreSpam(input: {
  name: string;
  email: string;
  message: string;
  subject?: string;
  elapsedMs?: number;
  honeypotFilled: boolean;
}): number {
  let score = 0;

  if (input.honeypotFilled) score += 60;

  // Under three seconds from render to submit.
  if (typeof input.elapsedMs === "number" && input.elapsedMs < 3000) score += 25;

  const haystack = `${input.subject ?? ""} ${input.message}`.toLowerCase();

  const linkCount = (haystack.match(/https?:\/\//g) ?? []).length;
  if (linkCount >= 3) score += 20;
  else if (linkCount === 2) score += 10;

  // Terms that essentially never appear in a genuine enquiry to a teacher.
  const spamTerms = [
    "seo service",
    "buy now",
    "crypto",
    "casino",
    "viagra",
    "loan offer",
    "bitcoin",
    "guest post",
    "backlink",
  ];
  if (spamTerms.some((term) => haystack.includes(term))) score += 30;

  // Shouting.
  const letters = input.message.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 20) {
    const upper = input.message.replace(/[^A-Z]/g, "").length;
    if (upper / letters.length > 0.7) score += 15;
  }

  // A "name" that is actually a URL or an email address.
  if (/https?:\/\/|@/.test(input.name)) score += 15;

  return Math.min(score, 100);
}
