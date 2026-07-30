import type { Metadata } from "next";

import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { CvManager } from "@/components/admin/cv-manager";
import { Notice } from "@/components/ui/states";
import { requireAdminSession } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import { listAdminTestimonials } from "@/lib/data/admin-cv";
import { saveTestimonial } from "@/lib/actions/cv";
import { relationships } from "@/lib/validation/cv";
import { locales } from "@/i18n/config";
import type { FieldSpec, TranslationFieldSpec } from "@/components/admin/entity-editor";

export const metadata: Metadata = { title: "References" };
export const dynamic = "force-dynamic";

const FIELDS: FieldSpec[] = [
  { key: "slug", label: "URL slug", type: "text", required: true, half: true },
  {
    key: "status",
    label: "Status",
    type: "select",
    half: true,
    options: [
      { value: "draft", label: "Draft" },
      { value: "in_review", label: "In review" },
      { value: "published", label: "Published" },
      { value: "archived", label: "Archived" },
    ],
  },
  { key: "author_name_en", label: "Name (English)", type: "text", required: true, half: true },
  { key: "author_name_km", label: "Name (Khmer)", type: "text", half: true, khmer: true },
  {
    key: "author_url",
    label: "Public profile URL",
    type: "url",
    description: "A public page only. Never a personal phone number or private address.",
  },
  {
    key: "relationship",
    label: "Relationship",
    type: "select",
    half: true,
    options: [
      { value: "", label: "Not specified" },
      ...relationships.map((value) => ({ value, label: value })),
    ],
  },
  { key: "sort_order", label: "Sort order", type: "number", half: true },
  { key: "featured", label: "Featured on the homepage", type: "checkbox" },
  {
    key: "consent_confirmed",
    label: "The author has consented to this quote being published",
    type: "checkbox",
    description: "Required to publish. The database rejects publication without it.",
  },
  {
    key: "consent_note",
    label: "How consent was obtained",
    type: "textarea",
    rows: 2,
    description: "For example: “Confirmed by message on 12 March 2026.”",
  },
];

const TRANSLATION_FIELDS: TranslationFieldSpec[] = [
  { key: "quote", label: "Quote", type: "textarea", rows: 4, required: true, maxLength: 1200, completesTranslation: true },
  { key: "author_role", label: "Author's role", type: "text", half: true },
  { key: "organization", label: "Organisation", type: "text", half: true },
];

export default async function AdminTestimonialsPage() {
  const session = await requireAdminSession();
  const items = await listAdminTestimonials();

  return (
    <>
      <AdminPageHeader
        title="References"
        description="Quotes from colleagues and classmates. Each one needs recorded consent before it can be published."
      />

      <AdminPageBody className="flex flex-col gap-5">
        <Notice tone="warning" icon="shield" title="Two rules enforced here">
          <p>
            There is no rating field — the old site showed invented five-star ratings on
            real people&apos;s words. And there is nowhere to store a private phone
            number, which the old site published for one referee. Only a public profile
            URL can be recorded.
          </p>
        </Notice>

        <CvManager
          table="testimonials"
          singular="reference"
          items={items}
          emptyTitle="No references yet"
          emptyDescription="Add each quote together with a record of how consent was obtained."
          fields={FIELDS}
          translationFields={TRANSLATION_FIELDS}
          blankValues={{
            slug: "",
            status: "draft",
            featured: false,
            sort_order: 0,
            author_name_en: "",
            author_name_km: "",
            author_url: "",
            avatar_media_id: null,
            relationship: "",
            consent_confirmed: false,
            consent_note: "",
            translations: locales.map((locale) => ({
              locale,
              quote: "",
              author_role: "",
              organization: "",
            })),
          }}
          onSave={saveTestimonial}
          canEdit={permissions.editContent(session.role)}
          canPublish={permissions.publishContent(session.role)}
          canDelete={permissions.deleteContent(session.role)}
        />
      </AdminPageBody>
    </>
  );
}
