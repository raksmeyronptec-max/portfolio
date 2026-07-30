import type { Metadata } from "next";

import { AdminPageBody, AdminPageHeader } from "@/components/admin/admin-shell";
import { ProfileForm } from "@/components/admin/profile-form";
import { Notice } from "@/components/ui/states";
import { requirePermission } from "@/lib/auth/guards";
import { getOwnerProfileRow, listPortraitOptions } from "@/lib/data/admin-profile";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

/**
 * The owner's public profile.
 *
 * Split from Settings because the two answer different questions. Settings is the
 * site (hero copy, contact channels, feature switches); this is the person, and it
 * is what the `public_profile` view projects onto the homepage and About page.
 * Without this page those columns were only reachable through Supabase Studio,
 * which is exactly the hardcoded-content problem the rebuild set out to remove.
 */
export default async function AdminProfilePage() {
  const session = await requirePermission("manageSettings", "/admin/profile");

  const [profile, portraits] = await Promise.all([
    getOwnerProfileRow(session.userId),
    listPortraitOptions(),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Profile"
        description="Your public identity: name, headline, biography, location and portrait. These are the fields the homepage and About page read."
      />

      <AdminPageBody className="flex flex-col gap-6">
        {profile ? (
          <>
            {profile.is_site_owner ? null : (
              <Notice tone="warning" icon="shield" title="Not the site-owner profile">
                <p>
                  Changes here update your own profile row, but the public site reads
                  the row flagged as site owner. Ask the owner to publish these details,
                  or have the owner flag this account instead.
                </p>
              </Notice>
            )}

            <ProfileForm
              email={profile.email}
              portraits={portraits}
              initial={{
                display_name: profile.display_name ?? "",
                public_headline_en: profile.public_headline_en ?? "",
                public_headline_km: profile.public_headline_km ?? "",
                public_bio_en: profile.public_bio_en ?? "",
                public_bio_km: profile.public_bio_km ?? "",
                public_location: profile.public_location ?? "",
                public_avatar_url: profile.public_avatar_url ?? "",
                avatar_media_id: profile.avatar_media_id ?? "",
              }}
            />
          </>
        ) : (
          <Notice tone="danger" title="No profile row">
            <p>
              This account is authenticated and has an admin role, but has no row in{" "}
              <code>profiles</code>. Run <code>npm run db:reset</code> locally, or insert
              the row in Supabase Studio, then reload.
            </p>
          </Notice>
        )}
      </AdminPageBody>
    </>
  );
}
