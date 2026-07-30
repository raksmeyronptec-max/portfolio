import type { Metadata } from "next";

import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { CvManager } from "@/components/admin/cv-manager";
import { Notice } from "@/components/ui/states";
import { requireAdminSession } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import { listAdminEducation } from "@/lib/data/admin-cv";
import { saveEducation } from "@/lib/actions/cv";
import { educationKinds } from "@/lib/validation/cv";
import { locales } from "@/i18n/config";
import type { FieldSpec, TranslationFieldSpec } from "@/components/admin/entity-editor";

export const metadata: Metadata = { title: "Education" };
export const dynamic = "force-dynamic";

const FIELDS: FieldSpec[] = [
  { key: "slug", label: "URL slug", type: "text", required: true, half: true, description: "Lower-case letters, numbers and hyphens." },
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
    options: educationKinds.map((kind) => ({
      value: kind,
      label: kind.replace(/_/g, " "),
    })),
  },
  { key: "sort_order", label: "Sort order", type: "number", half: true, description: "Lower numbers appear first." },
  { key: "institution_url", label: "Institution website", type: "url", half: true },
  { key: "is_current", label: "Currently studying here", type: "checkbox" },
  {
    key: "period_label_en",
    label: "Period label (English)",
    type: "text",
    half: true,
    placeholder: "2023 — 2028 (expected)",
    description: "Only the precision you can evidence. Preferred over the dates for display.",
  },
  { key: "period_label_km", label: "Period label (Khmer)", type: "text", half: true, khmer: true },
  { key: "started_on", label: "Started on", type: "date", half: true, description: "Used for sorting only." },
  { key: "ended_on", label: "Ended on", type: "date", half: true },
  { key: "schedule_label_en", label: "Schedule (English)", type: "text", half: true, placeholder: "Monday – Friday" },
  { key: "schedule_label_km", label: "Schedule (Khmer)", type: "text", half: true, khmer: true },
  { key: "grade_value", label: "Grade or GPA", type: "text", half: true, placeholder: "A" },
  {
    key: "grade_scale",
    label: "Grade scale",
    type: "text",
    half: true,
    placeholder: "Cambodian BacII overall grade (A–E)",
    description: "Required whenever a grade is set — a bare number means nothing without it.",
  },
  {
    key: "grade_source_note",
    label: "Grade source",
    type: "textarea",
    rows: 2,
    description: "Where does this figure come from? Recorded so it can be checked later.",
  },
  { key: "needs_review", label: "Needs review — unconfirmed details", type: "checkbox" },
  { key: "review_note", label: "Review note", type: "textarea", rows: 3 },
];

const TRANSLATION_FIELDS: TranslationFieldSpec[] = [
  { key: "institution", label: "Institution", type: "text", required: true, completesTranslation: true },
  { key: "qualification", label: "Qualification", type: "text", completesTranslation: true },
  { key: "field_of_study", label: "Field of study", type: "text", half: true },
  { key: "description", label: "Description", type: "textarea", rows: 4 },
  { key: "achievements", label: "Achievements", type: "textarea", rows: 3 },
];

export default async function AdminEducationPage() {
  const session = await requireAdminSession();
  const items = await listAdminEducation();

  return (
    <>
      <AdminPageHeader
        title="Education"
        description="Schools, teacher training and degrees. Shown on the public Education page and in the journey timeline on the homepage."
      />

      <AdminPageBody className="flex flex-col gap-5">
        <Notice tone="info" icon="info">
          <p>
            A grade is only rendered publicly together with its scale. That is why the
            scale is required whenever a grade is set — the old site printed “3.79” and
            “A” with nothing to interpret them against.
          </p>
        </Notice>

        <CvManager
          table="education"
          singular="education entry"
          items={items}
          emptyTitle="No education entries yet"
          emptyDescription="Add each school, college or degree programme."
          fields={FIELDS}
          translationFields={TRANSLATION_FIELDS}
          blankValues={{
            slug: "",
            status: "draft",
            kind: "university",
            sort_order: 0,
            institution_url: "",
            started_on: "",
            ended_on: "",
            is_current: false,
            period_label_en: "",
            period_label_km: "",
            schedule_label_en: "",
            schedule_label_km: "",
            grade_value: "",
            grade_scale: "",
            grade_source_note: "",
            needs_review: false,
            review_note: "",
            translations: locales.map((locale) => ({
              locale,
              institution: "",
              qualification: "",
              field_of_study: "",
              description: "",
              achievements: "",
            })),
          }}
          onSave={saveEducation}
          canEdit={permissions.editContent(session.role)}
          canPublish={permissions.publishContent(session.role)}
          canDelete={permissions.deleteContent(session.role)}
        />
      </AdminPageBody>
    </>
  );
}
