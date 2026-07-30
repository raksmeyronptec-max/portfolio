import type { Metadata } from "next";

import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { ResumeManager } from "@/components/admin/resume-manager";
import { Notice } from "@/components/ui/states";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/lib/auth/roles";
import {
  listAdminResumeVersions,
  listResumeFileOptions,
} from "@/lib/data/admin-cv";

export const metadata: Metadata = { title: "Resume versions" };
export const dynamic = "force-dynamic";

export default async function AdminResumePage() {
  const session = await requirePermission("manageResume", "/admin/resume");

  const [versions, fileOptions] = await Promise.all([
    listAdminResumeVersions(),
    listResumeFileOptions(),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Resume versions"
        description="Keep every version, publish exactly one per language. Activation is atomic, and archiving revokes public access to the file itself — not just the link."
      />

      <AdminPageBody className="flex flex-col gap-5">
        <Notice tone="info" icon="lock" title="How access works">
          <p>
            All resume files live in a private bucket. A storage policy makes only the
            object behind the <strong>active, non-archived</strong> version readable, so
            activating a new version revokes the old one automatically. Downloads are
            served through <code>/api/resume/download</code>, which counts them
            server-side.
          </p>
        </Notice>

        {fileOptions.length === 0 ? (
          <Notice tone="warning" icon="upload" title="No resume files uploaded">
            <p>
              Upload a PDF in the Media library with the kind set to{" "}
              <strong>Resume PDF</strong> first. Only files in the resumes bucket can be
              attached to a version.
            </p>
          </Notice>
        ) : null}

        <ResumeManager
          versions={versions}
          fileOptions={fileOptions}
          canManage={permissions.manageResume(session.role)}
        />
      </AdminPageBody>
    </>
  );
}
