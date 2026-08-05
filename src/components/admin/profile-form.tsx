"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Card, CardBody, CardHeader, Divider } from "@/components/ui/primitives";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { saveOwnerProfile } from "@/lib/actions/profile";
import { profileErrorLabels } from "@/lib/validation/profile";

export type ProfileFormValues = {
  display_name: string;
  public_headline_en: string;
  public_headline_km: string;
  public_bio_en: string;
  public_bio_km: string;
  public_location: string;
  public_avatar_url: string;
  avatar_media_id: string;
};

export type PortraitChoice = { id: string; label: string; url: string | null };

/**
 * Owner profile editor.
 *
 * The portrait is expressed two ways on purpose: a library selection, which is
 * the normal path, and a plain path field, which is how the migrated
 * `/image/MyPF.jpg` portrait keeps working without pretending it was uploaded
 * through the CMS. Choosing from the library overwrites the path so the two
 * cannot silently disagree.
 */
export function ProfileForm({
  initial,
  portraits,
  email,
}: {
  initial: ProfileFormValues;
  portraits: PortraitChoice[];
  email: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [values, setValues] = useState<ProfileFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  const nameId = useId();
  const locationId = useId();
  const avatarId = useId();
  const portraitId = useId();

  function update(key: keyof ProfileFormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setIsDirty(true);
  }

  function choosePortrait(mediaId: string) {
    const chosen = portraits.find((option) => option.id === mediaId);

    setValues((current) => ({
      ...current,
      avatar_media_id: mediaId,
      // An unresolvable URL would leave a broken portrait on the homepage, so the
      // existing value is kept rather than blanked.
      public_avatar_url: chosen?.url ?? current.public_avatar_url,
    }));
    setIsDirty(true);
  }

  function save() {
    setErrors({});

    startTransition(async () => {
      const result = await saveOwnerProfile(values);

      if (result.ok) {
        setIsDirty(false);
        toast.show({
          tone: "success",
          title: "Profile saved",
          description: "The homepage and About page have been refreshed.",
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
            .map((code) => profileErrorLabels[code] ?? code)
            .join(" ") ||
          (result.code === "forbidden"
            ? "Only the site owner can edit the public profile."
            : "Please try again."),
      });
    });
  }

  const previewUrl = values.public_avatar_url.trim();

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
          <Field
            id={nameId}
            label="Display name"
            description="Used in the header, the footer, structured data and the resume."
            required
            requiredLabel="required"
            error={
              errors.display_name ? profileErrorLabels[errors.display_name] : undefined
            }
          >
            {({ describedBy, invalid }) => (
              <TextInput
                id={nameId}
                value={values.display_name}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                onChange={(event) => update("display_name", event.target.value)}
              />
            )}
          </Field>

          <Field
            id={locationId}
            label="Private profile location"
            description="Not published. Set the public city and country under Settings instead; never enter a street address for public display."
            optionalLabel="optional"
            showOptional
          >
            {({ describedBy }) => (
              <TextInput
                id={locationId}
                value={values.public_location}
                aria-describedby={describedBy}
                onChange={(event) => update("public_location", event.target.value)}
              />
            )}
          </Field>

          <Divider />

          <div className="text-small text-foreground-muted">
            <p>
              Sign-in address: <span className="font-mono">{email}</span>
            </p>
            <p className="mt-1 text-[0.75rem] text-foreground-subtle">
              Not editable here and never published. The public contact address is a
              separate value under Settings, so the account you sign in with does not
              have to be the address you advertise.
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-h4 font-semibold">Public headline</h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <BilingualPair
            label="Headline"
            description="One line under your name. Distinct from the homepage hero headline, which is site copy rather than an attribute of you."
            enValue={values.public_headline_en}
            kmValue={values.public_headline_km}
            onEnChange={(value) => update("public_headline_en", value)}
            onKmChange={(value) => update("public_headline_km", value)}
          />

          <BilingualPair
            label="Biography"
            description="Your authored About story. Aim for roughly 250–450 words per language; it appears visibly on About and in Person structured data."
            enValue={values.public_bio_en}
            kmValue={values.public_bio_km}
            onEnChange={(value) => update("public_bio_en", value)}
            onKmChange={(value) => update("public_bio_km", value)}
            multiline
            rows={7}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-h4 font-semibold">Portrait</h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <Field
            id={portraitId}
            label="Choose from the media library"
            description="Only public images are listed. Selecting one fills in the path below."
            optionalLabel="optional"
            showOptional
          >
            {({ describedBy }) => (
              <Select
                id={portraitId}
                value={values.avatar_media_id}
                aria-describedby={describedBy}
                onChange={(event) => choosePortrait(event.target.value)}
              >
                <option value="">Not set</option>
                {portraits.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            id={avatarId}
            label="Portrait path or URL"
            description="A path beginning with / refers to a file in public/. A full https:// URL is also accepted."
            error={
              errors.public_avatar_url
                ? profileErrorLabels[errors.public_avatar_url]
                : undefined
            }
            optionalLabel="optional"
            showOptional
          >
            {({ describedBy, invalid }) => (
              <TextInput
                id={avatarId}
                value={values.public_avatar_url}
                placeholder="/image/MyPF.jpg"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                onChange={(event) => update("public_avatar_url", event.target.value)}
              />
            )}
          </Field>

          {previewUrl ? (
            <figure className="flex flex-col gap-2">
              <div className="h-28 w-28 overflow-hidden rounded-(--radius-md) border border-border bg-surface-muted">
                {/*
                  A plain <img> rather than next/image: the value is operator-entered
                  and may point at a host that is not in the remote-image allowlist,
                  which next/image would reject at render time. This is a 112px
                  admin-only preview, so the optimiser buys nothing here.
                */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt=""
                  width={112}
                  height={112}
                  className="h-full w-full object-cover"
                />
              </div>
              <figcaption className="text-[0.75rem] text-foreground-subtle">
                Preview. If this is blank the path is wrong, or the file is not public.
              </figcaption>
            </figure>
          ) : null}

          <Notice tone="info" icon="info">
            <p>
              A portrait needs no alt text field here: it is decorative next to your
              name, which is already rendered as text on the same line. Adding
              &ldquo;photo of Ron Raksmey&rdquo; would make a screen reader announce the
              name twice.
            </p>
          </Notice>
        </CardBody>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button onClick={save} loading={isPending} iconStart="check">
          Save profile
        </Button>
      </div>
    </div>
  );
}

function BilingualPair({
  label,
  description,
  enValue,
  kmValue,
  onEnChange,
  onKmChange,
  multiline = false,
  rows = 3,
}: {
  label: string;
  description?: string;
  enValue: string;
  kmValue: string;
  onEnChange: (value: string) => void;
  onKmChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  const enId = useId();
  const kmId = useId();

  return (
    <div className="flex flex-col gap-2">
      {description ? (
        <p className="text-[0.8125rem] text-foreground-muted">{description}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={enId} label={`${label} (English)`}>
          {({ describedBy }) =>
            multiline ? (
              <TextArea
                id={enId}
                rows={rows}
                value={enValue}
                aria-describedby={describedBy}
                onChange={(event) => onEnChange(event.target.value)}
              />
            ) : (
              <TextInput
                id={enId}
                value={enValue}
                aria-describedby={describedBy}
                onChange={(event) => onEnChange(event.target.value)}
              />
            )
          }
        </Field>

        <Field id={kmId} label={`${label} (Khmer)`}>
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
