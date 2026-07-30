-- ═══════════════════════════════════════════════════════════════════════════
--  0013 — Allow 'profile.updated' in the audit trail
--
--  The owner's public profile (display name, headline, biography, portrait) is
--  edited at /admin/profile. It feeds the `public_profile` view that the
--  homepage and About page read, so a change to it is a change to public
--  content and belongs in the same append-only trail as everything else.
--
--  The action list is a CHECK rather than an enum precisely so that widening it
--  is a one-statement migration with no type rewrite and no downtime.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.audit_logs
  drop constraint if exists audit_logs_action_allowed;

alter table public.audit_logs
  add constraint audit_logs_action_allowed check (
    action in (
      'admin.login', 'admin.login_failed', 'admin.logout',
      'admin.unauthorized', 'admin.role_changed',
      'profile.updated',
      'project.created', 'project.updated', 'project.published',
      'project.unpublished', 'project.archived', 'project.restored',
      'project.deleted', 'project.duplicated',
      'certificate.created', 'certificate.updated', 'certificate.published',
      'certificate.unpublished', 'certificate.archived', 'certificate.restored',
      'certificate.deleted', 'certificate.original_viewed',
      'certificate.original_downloaded', 'certificate.privacy_reviewed',
      'media.uploaded', 'media.replaced', 'media.deleted',
      'resume.uploaded', 'resume.activated', 'resume.archived',
      'education.updated', 'experience.updated', 'skill.updated',
      'testimonial.updated', 'message.updated', 'message.deleted',
      'seo.updated', 'settings.updated'
    )
  );
