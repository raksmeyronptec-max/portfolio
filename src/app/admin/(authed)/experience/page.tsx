import type { Metadata } from "next";

import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { CvManager } from "@/components/admin/cv-manager";
import { requireAdminSession } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import { listAdminExperience } from "@/lib/data/admin-cv";
import { saveExperience } from "@/lib/actions/cv";
import { experienceKinds } from "@/lib/validation/cv";
import { locales } from "@/i18n/config";
import type { FieldSpec, TranslationFieldSpec } from "@/components/admin/entity-editor";

export const metadata: Metadata = { title: "Experience" };
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
  {
    key: "kind",
    label: "Kind",
    type: "select",
    half: true,
    options: experienceKinds.map((kind) => ({ value: kind, label: kind })),
  },
  { key: "sort_order", label: "Sort order", type: "number", half: true },
  { key: "organization_url", label: "Organisation website", type: "url", half: true },
  { key: "employment_type", label: "Employment type", type: "text", half: true, placeholder: "Placement" },
  { key: "location_en", label: "Location (English)", type: "text", half: true },
  { key: "location_km", label: "Location (Khmer)", type: "text", half: true, khmer: true },
  { key: "is_current", label: "Currently ongoing", type: "checkbox" },
  {
    key: "period_label_en",
    label: "Period label (English)",
    type: "text",
    half: true,
    placeholder: "2023 — present",
    description: "Preferred over the dates for display.",
  },
  { key: "period_label_km", label: "Period label (Khmer)", type: "text", half: true, khmer: true },
  { key: "started_on", label: "Started on", type: "date", half: true },
  { key: "ended_on", label: "Ended on", type: "date", half: true },
  {
    key: "tags",
    label: "Tags",
    type: "tags",
    placeholder: "Primary Education, Mathematics, 12+4 System",
    description: "Comma-separated.",
  },
  { key: "needs_review", label: "Needs review — unconfirmed details", type: "checkbox" },
  { key: "review_note", label: "Review note", type: "textarea", rows: 3 },
];

const TRANSLATION_FIELDS: TranslationFieldSpec[] = [
  { key: "role_title", label: "Role title", type: "text", required: true, completesTranslation: true },
  { key: "organization", label: "Organisation", type: "text", required: true, completesTranslation: true },
  { key: "summary", label: "Summary", type: "textarea", rows: 2, description: "One or two sentences, used on the homepage timeline." },
  { key: "description", label: "Description", type: "textarea", rows: 5 },
  { key: "achievements", label: "Highlights", type: "textarea", rows: 3 },
];

export default async function AdminExperiencePage() {
  const session = await requireAdminSession();
  const items = await listAdminExperience();

  return (
    <>
      <AdminPageHeader
        title="Experience"
        description="Teaching practice, placements and product work. Shown on the public Experience page and in the homepage timeline."
      />

      <AdminPageBody className="flex flex-col gap-5">
        <CvManager
          table="experiences"
          singular="experience entry"
          items={items}
          emptyTitle="No experience entries yet"
          emptyDescription="Add each role, placement or practicum."
          fields={FIELDS}
          translationFields={TRANSLATION_FIELDS}
          blankValues={{
            slug: "",
            status: "draft",
            kind: "teaching",
            sort_order: 0,
            organization_url: "",
            location_en: "",
            location_km: "",
            employment_type: "",
            started_on: "",
            ended_on: "",
            is_current: false,
            period_label_en: "",
            period_label_km: "",
            needs_review: false,
            review_note: "",
            tags: [],
            translations: locales.map((locale) => ({
              locale,
              role_title: "",
              organization: "",
              summary: "",
              description: "",
              achievements: "",
            })),
          }}
          onSave={saveExperience}
          canEdit={permissions.editContent(session.role)}
          canPublish={permissions.publishContent(session.role)}
          canDelete={permissions.deleteContent(session.role)}
          mediaHrefBase="/admin/experience"
        />
      </AdminPageBody>
    </>
  );
}
