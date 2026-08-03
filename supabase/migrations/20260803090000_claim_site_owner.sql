-- ═══════════════════════════════════════════════════════════════════════════
--  0030 — Let an owner claim the site-owner profile
--
--  ── The problem this fixes ─────────────────────────────────────────────────
--  The public site reads `public_profile`, which is `where p.is_site_owner`.
--  Only the seed ever set that flag, and only on the local development account.
--  On a real deployment the owner signs up through the normal auth flow, their
--  `profiles` row lands with `is_site_owner = false`, and the whole of
--  /admin/profile — headline, biography, location, portrait — is written to a
--  row nothing public ever reads.
--
--  The admin surfaced this correctly ("Not the site-owner profile") and then
--  told the reader to "have the owner flag this account instead", pointing at a
--  control that did not exist. `saveOwnerProfile` deliberately omits the column
--  so an editor cannot seize the site's identity, which is right — but it left
--  the legitimate owner with no path either, short of hand-writing SQL.
--
--  ── Why an RPC rather than a column in the save action ─────────────────────
--  Claiming has to *unset* the flag on whichever row currently holds it, and
--  `profiles_self_update` only ever permits a caller to touch their own row. So
--  the operation cannot be expressed as a normal RLS-constrained write.
--
--  The two ways out are the service-role client or a SECURITY DEFINER function.
--  This takes the function, for the reason the rest of this schema takes the
--  database as the boundary: the authorisation check then lives next to the
--  write and applies to every caller, including psql and Supabase Studio. The
--  service-role client stays reserved for the handful of jobs RLS forbids
--  everyone outright.
--
--  Owner-only, and self-only. `is_owner()` is the same predicate that gates
--  role management and private certificate originals, and the function always
--  claims for `auth.uid()` — it takes no user-id argument, so it cannot be used
--  to hand the site's identity to somebody else.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.claim_site_owner()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Not authenticated.' using errcode = 'insufficient_privilege';
  end if;

  if not public.is_owner() then
    raise exception 'Only an owner may claim the site-owner profile.'
      using errcode = 'insufficient_privilege';
  end if;

  -- The caller must already have a profile row. Creating one here would let the
  -- flag exist on a row with no name, headline or portrait, which is a worse
  -- public state than the one being fixed.
  if not exists (select 1 from public.profiles where id = v_caller) then
    raise exception 'No profile row for this account.' using errcode = 'no_data_found';
  end if;

  /*
   * Cleared first, then set. `public_profile` selects with LIMIT 1 and no
   * ordering, so two flagged rows would make the public identity of the site
   * depend on Postgres row order — a bug that would appear as the wrong name
   * intermittently and be near-impossible to reproduce.
   */
  update public.profiles
     set is_site_owner = false
   where is_site_owner and id <> v_caller;

  update public.profiles
     set is_site_owner = true
   where id = v_caller;
end;
$$;

revoke all on function public.claim_site_owner() from public, anon;
grant execute on function public.claim_site_owner() to authenticated;

comment on function public.claim_site_owner() is
  'Flags the calling owner''s profile as the site owner, clearing the flag '
  'elsewhere. Owner-only, self-only, and the only supported way to move it.';

-- ── Audit vocabulary ────────────────────────────────────────────────────────
--
-- Moving the site's public identity from one account to another is exactly the
-- kind of change that should be answerable a year later, so it gets its own verb.
--
-- ── Why this appends instead of restating the list ─────────────────────────
-- Every migration that has needed a new verb so far has done it by dropping the
-- CHECK and writing out all of them again. That list is now 98 entries, and the
-- pattern has exactly one failure mode: transcribe it slightly short and the
-- omitted verbs are silently revoked, with nothing failing until months later
-- when some rarely-taken code path tries to log one and the insert is rejected —
-- inside `writeAuditLog`, which swallows errors by design, so the trail just
-- quietly develops a hole.
--
-- Writing this migration hit that: a hand-copied list dropped 21 publication
-- verbs. So rather than restate anything, this reads the constraint that is
-- actually installed and splices one value into it. It cannot drop a verb it did
-- not know about, and re-running it is a no-op.
do $$
declare
  v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
    from pg_constraint
   where conname = 'audit_logs_action_allowed'
     and conrelid = 'public.audit_logs'::regclass;

  if v_def is null then
    raise exception 'audit_logs_action_allowed is missing; refusing to guess at its contents.';
  end if;

  -- Already applied.
  if position('''profile.site_owner_claimed''' in v_def) > 0 then
    return;
  end if;

  -- Postgres normalises `action in (...)` to `CHECK ((action = ANY (ARRAY[...])))`,
  -- so splicing after the single `ARRAY[` preserves every existing member.
  if position('ARRAY[' in v_def) = 0 then
    raise exception 'Unexpected constraint shape: %', v_def;
  end if;

  execute 'alter table public.audit_logs drop constraint audit_logs_action_allowed';
  execute format(
    'alter table public.audit_logs add constraint audit_logs_action_allowed %s',
    replace(v_def, 'ARRAY[', 'ARRAY[''profile.site_owner_claimed''::text, ')
  );
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  Drop the Ask-Ron chat-widget switch
--
--  `chat_widget_enabled` has been read into `SiteSettings` and rendered as a
--  toggle since the rebuild, but no component has ever read it: the v1 widget
--  was never ported, and there is no Gemini endpoint in this codebase for it to
--  call. The control's own help text claimed the widget "only mounts on demand",
--  which was not true of anything that exists.
--
--  A switch that does nothing is worse than a missing feature — it invites the
--  owner to believe a thing is live. Removed rather than left lying; restoring
--  it is one `add column` away if the widget is ever built.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.site_settings drop column if exists chat_widget_enabled;
