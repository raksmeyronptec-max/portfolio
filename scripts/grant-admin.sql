-- ═══════════════════════════════════════════════════════════════════════════
--  Grant admin access to an existing account
--
--  Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
--  against whichever project you are setting up — hosted or local.
--
--  ── Order matters ──────────────────────────────────────────────────────────
--  This script only grants a role. It does NOT create the login. Do this first:
--
--    1. Dashboard → Authentication → Users → "Add user" → "Create new user"
--       • Email:    the address you will sign in with
--       • Password: pick a strong one
--       • Tick "Auto Confirm User" — without it the account cannot sign in
--         until the confirmation email is clicked.
--
--    2. Edit the email on the line below.
--
--    3. Run this script.
--
--  ── Why a script rather than editing the table by hand ─────────────────────
--  `admin_roles.user_id` is a foreign key to `auth.users(id)`, so the row needs
--  a UUID, not an email. Looking it up here removes the copy-paste step that is
--  easy to get wrong, and the guard below turns "no such user" into a clear
--  error instead of a silent no-op.
--
--  ── Roles ──────────────────────────────────────────────────────────────────
--    viewer  read-only access to the admin area
--    editor  create, edit, publish, upload media
--    owner   everything, plus delete, hard-delete and viewing the private
--            certificate originals
--
--  Re-running is safe: the insert upserts, so it also works to change an
--  existing person's role, and it clears `revoked_at` if access was withdrawn.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  -- ── EDIT THESE TWO LINES ────────────────────────────────────────────────
  v_email text := 'raksmeyron97@gmail.com';
  v_role  public.admin_role := 'owner';
  -- ────────────────────────────────────────────────────────────────────────
  v_user_id uuid;
begin
  select id into v_user_id
    from auth.users
   where lower(email) = lower(v_email)
   limit 1;

  if v_user_id is null then
    raise exception
      'No auth user with email %. Create the account under Authentication → Users first (tick "Auto Confirm User"), then re-run this.',
      v_email;
  end if;

  insert into public.admin_roles (user_id, role, note)
  values (
    v_user_id,
    v_role,
    format('Granted %s via scripts/grant-admin.sql on %s', v_role, now()::date)
  )
  on conflict (user_id) do update
    set role       = excluded.role,
        note       = excluded.note,
        revoked_at = null,
        updated_at = now();

  raise notice 'OK — % now has the % role (user_id %).', v_email, v_role, v_user_id;
end
$$;

-- Verify. Expect one row per admin, with revoked_at null.
select u.email,
       ar.role,
       ar.granted_at,
       ar.revoked_at,
       ar.note
  from public.admin_roles ar
  join auth.users u on u.id = ar.user_id
 order by ar.granted_at;
