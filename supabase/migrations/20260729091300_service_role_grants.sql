-- ═══════════════════════════════════════════════════════════════════════════
--  0014 — Explicit table privileges for `service_role`
--
--  WHY THIS IS NEEDED
--
--  Supabase's default privileges for schema `public` are registered with
--  `supabase_admin` as the grantor:
--
--    alter default privileges in schema public grant all on tables
--      to postgres, anon, authenticated, service_role;   -- owned by supabase_admin
--
--  PostgreSQL applies a default-ACL entry only when the role *creating* the
--  object matches the grantor of that entry. Migrations here run as `postgres`,
--  not `supabase_admin`, so none of those defaults applied to any table in this
--  schema. `anon` and `authenticated` were unaffected because migration 0009
--  grants to them explicitly; `service_role` was left with nothing but
--  REFERENCES, TRIGGER and TRUNCATE.
--
--  The practical consequence was severe and silent:
--
--    * `admin_roles` lookups through the service-role client returned
--      `42501 permission denied`, so /api/admin/session answered `no_role` for a
--      correctly credentialled owner — admin sign-in was impossible.
--    * `audit_logs` inserts failed. `writeAuditLog` deliberately swallows its
--      errors so a logging fault cannot block an admin action, which meant the
--      audit trail was quietly empty.
--    * Signed URLs for private certificate originals could not be minted.
--
--  Being explicit here is better than relying on inherited defaults regardless:
--  the privilege model becomes part of the migration history and reproduces on
--  any project, whoever happens to own the schema.
--
--  DOES THIS WEAKEN RLS?  No.
--
--  `service_role` already carries BYPASSRLS — that is what it is for, and it is
--  reachable only from the server (the key never appears in a NEXT_PUBLIC_
--  variable, and eslint's no-restricted-imports rule confines the client that
--  uses it to route handlers, Server Actions and server-only modules). Nothing
--  about `anon` or `authenticated` changes below; their privileges remain exactly
--  as granted in migration 0009, and every policy stays in force for them.
-- ═══════════════════════════════════════════════════════════════════════════

grant usage on schema public to service_role;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Cover tables added by later migrations without needing to remember this file.
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;

-- ── Guard rail ──────────────────────────────────────────────────────────────
-- Fail the migration loudly if the grant did not take, rather than discovering
-- it again through a mysterious "no_role" at the sign-in screen.
do $$
declare
  missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not has_table_privilege('service_role', c.oid, 'SELECT');

  if missing is not null then
    raise exception
      'service_role is still missing SELECT on: %', missing;
  end if;

  raise notice 'service_role has SELECT on every table in public.';
end $$;
