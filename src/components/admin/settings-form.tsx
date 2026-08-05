"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, Field, TextArea, TextInput } from "@/components/ui/field";
import { Card, CardBody, CardHeader, Divider } from "@/components/ui/primitives";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { saveSiteSettings } from "@/lib/actions/settings";
import { seoErrorLabels } from "@/lib/validation/settings";

type SettingsValues = Record<string, unknown>;

/**
 * Site settings form.
 *
 * Bilingual fields are paired side by side rather than split across tabs, because
 * these are short values where seeing both at once is the point — it makes a missing
 * Khmer tagline obvious instead of hidden behind a tab.
 */
export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [values, setValues] = useState<SettingsValues>(() => ({
    site_name_en: initial.site_name_en ?? "Ron Raksmey",
    site_name_km: initial.site_name_km ?? "រុន រស្មី",
    tagline_en: initial.tagline_en ?? "",
    tagline_km: initial.tagline_km ?? "",
    positioning_en: initial.positioning_en ?? "",
    positioning_km: initial.positioning_km ?? "",
    hero_headline_en: initial.hero_headline_en ?? "",
    hero_headline_km: initial.hero_headline_km ?? "",
    hero_subheadline_en: initial.hero_subheadline_en ?? "",
    hero_subheadline_km: initial.hero_subheadline_km ?? "",
    availability_status_en: initial.availability_status_en ?? "",
    availability_status_km: initial.availability_status_km ?? "",
    is_available_for_work: Boolean(initial.is_available_for_work ?? true),
    location_en: initial.location_en ?? "",
    location_km: initial.location_km ?? "",
    contact_email: initial.contact_email ?? "",
    telegram_handle: initial.telegram_handle ?? "",
    facebook_url: initial.facebook_url ?? "",
    github_url: initial.github_url ?? "",
    linkedin_url: initial.linkedin_url ?? "",
    google_site_verification: initial.google_site_verification ?? "",
    contact_form_enabled: Boolean(initial.contact_form_enabled ?? true),
    analytics_enabled: Boolean(initial.analytics_enabled ?? true),
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  function update(key: string, value: unknown) {
    setValues((current) => ({ ...current, [key]: value }));
    setIsDirty(true);
  }

  function save() {
    setErrors({});

    startTransition(async () => {
      const result = await saveSiteSettings(values);

      if (result.ok) {
        setIsDirty(false);
        toast.show({
          tone: "success",
          title: "Settings saved",
          description: "Every public page has been refreshed.",
        });
        router.refresh();
        return;
      }

      if (result.fields) setErrors(result.fields);

      toast.show({
        tone: "error",
        title: "Could not save",
        description:
          Object.values(result.fields ?? {})
            .map((code) => seoErrorLabels[code] ?? code)
            .join(" ") ||
          (result.code === "forbidden"
            ? "Only the site owner can change settings."
            : "Please try again."),
      });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {isDirty ? (
        <Notice tone="info" icon="clock">
          <p>Unsaved changes.</p>
        </Notice>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-h4 font-semibold">Identity</h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <Pair
            label="Site name"
            enValue={String(values.site_name_en ?? "")}
            kmValue={String(values.site_name_km ?? "")}
            onEnChange={(value) => update("site_name_en", value)}
            onKmChange={(value) => update("site_name_km", value)}
            required
            error={errors.site_name_en ? seoErrorLabels[errors.site_name_en] : undefined}
          />

          <Pair
            label="Tagline"
            description="Used in the footer and as a metadata fallback."
            enValue={String(values.tagline_en ?? "")}
            kmValue={String(values.tagline_km ?? "")}
            onEnChange={(value) => update("tagline_en", value)}
            onKmChange={(value) => update("tagline_km", value)}
          />

          <Pair
            label="Positioning statement"
            description="One sentence connecting education and product work. Shown on About."
            enValue={String(values.positioning_en ?? "")}
            kmValue={String(values.positioning_km ?? "")}
            onEnChange={(value) => update("positioning_en", value)}
            onKmChange={(value) => update("positioning_km", value)}
            multiline
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-h4 font-semibold">Homepage hero</h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <Pair
            label="Headline"
            description="The large statement at the top of the homepage."
            enValue={String(values.hero_headline_en ?? "")}
            kmValue={String(values.hero_headline_km ?? "")}
            onEnChange={(value) => update("hero_headline_en", value)}
            onKmChange={(value) => update("hero_headline_km", value)}
            multiline
          />

          <Pair
            label="Supporting text"
            enValue={String(values.hero_subheadline_en ?? "")}
            kmValue={String(values.hero_subheadline_km ?? "")}
            onEnChange={(value) => update("hero_subheadline_en", value)}
            onKmChange={(value) => update("hero_subheadline_km", value)}
            multiline
            rows={4}
          />

          <Divider />

          <Checkbox
            id="available-for-work"
            label="Show as open to opportunities"
            description="Controls the status dot and label in the hero."
            checked={Boolean(values.is_available_for_work)}
            onChange={(event) => update("is_available_for_work", event.target.checked)}
          />

          <Pair
            label="Availability status"
            description="Overrides the default wording next to the status dot."
            enValue={String(values.availability_status_en ?? "")}
            kmValue={String(values.availability_status_km ?? "")}
            onEnChange={(value) => update("availability_status_en", value)}
            onKmChange={(value) => update("availability_status_km", value)}
          />

          <Pair
            label="Location"
            enValue={String(values.location_en ?? "")}
            kmValue={String(values.location_km ?? "")}
            onEnChange={(value) => update("location_en", value)}
            onKmChange={(value) => update("location_km", value)}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-h4 font-semibold">Contact and links</h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <Notice tone="info" icon="shield">
            <p>
              Only add channels you are happy to publish. There is deliberately no field
              for a phone number — the previous site published a referee&apos;s mobile
              number, and this schema has nowhere to put one.
            </p>
          </Notice>

          <div className="grid gap-4 sm:grid-cols-2">
            <Single
              label="Contact email"
              value={String(values.contact_email ?? "")}
              onChange={(value) => update("contact_email", value)}
              type="email"
              error={errors.contact_email ? seoErrorLabels[errors.contact_email] : undefined}
            />
            <Single
              label="Telegram handle"
              value={String(values.telegram_handle ?? "")}
              onChange={(value) => update("telegram_handle", value)}
              placeholder="@username"
            />
            <Single
              label="Facebook URL"
              value={String(values.facebook_url ?? "")}
              onChange={(value) => update("facebook_url", value)}
              type="url"
              error={errors.facebook_url ? seoErrorLabels[errors.facebook_url] : undefined}
            />
            <Single
              label="GitHub URL"
              value={String(values.github_url ?? "")}
              onChange={(value) => update("github_url", value)}
              type="url"
              error={errors.github_url ? seoErrorLabels[errors.github_url] : undefined}
            />
            <Single
              label="LinkedIn URL"
              value={String(values.linkedin_url ?? "")}
              onChange={(value) => update("linkedin_url", value)}
              type="url"
              error={errors.linkedin_url ? seoErrorLabels[errors.linkedin_url] : undefined}
            />
            <Single
              label="Google site verification"
              value={String(values.google_site_verification ?? "")}
              onChange={(value) => update("google_site_verification", value)}
              description="The token from Search Console, if you use it."
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-h4 font-semibold">Features</h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <Checkbox
            id="contact-form-enabled"
            label="Enable the public contact form"
            description="When off, the Contact page shows the direct channels instead. Visitors are never left without a way to reach you."
            checked={Boolean(values.contact_form_enabled)}
            onChange={(event) => update("contact_form_enabled", event.target.checked)}
          />

          <Checkbox
            id="analytics-enabled"
            label="Enable analytics collection"
            description="Cookieless, first-party, and honours Do Not Track. Turning this off stops all event recording immediately."
            checked={Boolean(values.analytics_enabled)}
            onChange={(event) => update("analytics_enabled", event.target.checked)}
          />
        </CardBody>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button onClick={save} loading={isPending} iconStart="check">
          Save settings
        </Button>
      </div>
    </div>
  );
}

// ── Field helpers ───────────────────────────────────────────────────────────

function Pair({
  label,
  description,
  enValue,
  kmValue,
  onEnChange,
  onKmChange,
  multiline = false,
  rows = 2,
  required = false,
  error,
}: {
  label: string;
  description?: string;
  enValue: string;
  kmValue: string;
  onEnChange: (value: string) => void;
  onKmChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  error?: string;
}) {
  const enId = useId();
  const kmId = useId();

  return (
    <div className="flex flex-col gap-2">
      {description ? (
        <p className="text-[0.8125rem] text-foreground-muted">{description}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={enId}
          label={`${label} (English)`}
          required={required}
          requiredLabel="required"
          error={error}
        >
          {({ describedBy, invalid }) =>
            multiline ? (
              <TextArea
                id={enId}
                rows={rows}
                value={enValue}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                onChange={(event) => onEnChange(event.target.value)}
              />
            ) : (
              <TextInput
                id={enId}
                value={enValue}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                onChange={(event) => onEnChange(event.target.value)}
              />
            )
          }
        </Field>

        <Field
          id={kmId}
          label={`${label} (Khmer)`}
          required={required}
          requiredLabel="required"
        >
          {({ describedBy }) =>
            multiline ? (
              <TextArea
                id={kmId}
                lang="km"
                rows={rows}
                value={kmValue}
                aria-describedby={describedBy}
                onChange={(event) => onKmChange(event.target.value)}
              />
            ) : (
              <TextInput
                id={kmId}
                lang="km"
                value={kmValue}
                aria-describedby={describedBy}
                onChange={(event) => onKmChange(event.target.value)}
              />
            )
          }
        </Field>
      </div>
    </div>
  );
}

function Single({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  description,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  description?: string;
  error?: string;
}) {
  const id = useId();

  return (
    <Field
      id={id}
      label={label}
      description={description}
      error={error}
      optionalLabel="optional"
      showOptional
    >
      {({ describedBy, invalid }) => (
        <TextInput
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}
