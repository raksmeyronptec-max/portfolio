/**
 * Role model, shared by the server guards and the admin UI.
 *
 * The UI uses these predicates to decide what to *show*. The server guards in
 * ./guards.ts and the RLS policies decide what is *allowed*. Hiding a button is
 * never the security control.
 */

export const adminRoles = ["owner", "editor", "viewer"] as const;
export type AdminRole = (typeof adminRoles)[number];

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (adminRoles as readonly string[]).includes(value);
}

/** Rank used for "at least this role" comparisons. */
const rank: Record<AdminRole, number> = { viewer: 1, editor: 2, owner: 3 };

export function atLeast(role: AdminRole | null, minimum: AdminRole): boolean {
  if (!role) return false;
  return rank[role] >= rank[minimum];
}

export const permissions = {
  /** Open the admin area at all. */
  viewAdmin: (role: AdminRole | null) => atLeast(role, "viewer"),
  /** Create or change portfolio content. */
  editContent: (role: AdminRole | null) => atLeast(role, "editor"),
  /** Move content into `published`. */
  publishContent: (role: AdminRole | null) => atLeast(role, "editor"),
  /** Upload to the media library. */
  uploadMedia: (role: AdminRole | null) => atLeast(role, "editor"),
  /** Archive content (a reversible state change). */
  archiveContent: (role: AdminRole | null) => atLeast(role, "editor"),
  /** Soft-delete and restore. */
  deleteContent: (role: AdminRole | null) => atLeast(role, "owner"),
  /** Permanently remove a row. */
  hardDelete: (role: AdminRole | null) => atLeast(role, "owner"),
  /** Mint a signed URL for a private certificate original. */
  viewPrivateOriginals: (role: AdminRole | null) => atLeast(role, "owner"),
  /** Grant or revoke admin roles. */
  manageAdmins: (role: AdminRole | null) => atLeast(role, "owner"),
  /** Change site-wide settings. */
  manageSettings: (role: AdminRole | null) => atLeast(role, "owner"),
  /** Read the message inbox. */
  viewMessages: (role: AdminRole | null) => atLeast(role, "viewer"),
  /** Triage messages (mark read, star, archive, add notes). */
  manageMessages: (role: AdminRole | null) => atLeast(role, "editor"),
  /** Read analytics and audit logs. */
  viewAnalytics: (role: AdminRole | null) => atLeast(role, "viewer"),
  viewAuditLogs: (role: AdminRole | null) => atLeast(role, "viewer"),
  /** Activate a resume version. */
  manageResume: (role: AdminRole | null) => atLeast(role, "editor"),
} as const;

export const roleLabels: Record<AdminRole, { name: string; description: string }> = {
  owner: {
    name: "Owner",
    description:
      "Full access, including admin users, security settings, private certificate originals, and delete or restore.",
  },
  editor: {
    name: "Editor",
    description:
      "Manages portfolio content and media, and may publish. Cannot manage admin users or open private originals.",
  },
  viewer: {
    name: "Viewer",
    description: "Read-only access to the dashboard, content and analytics.",
  },
};
