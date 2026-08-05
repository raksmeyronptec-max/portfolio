-- Keep street-level profile data out of the anonymous API surface.
--
-- The public pages use the localized city/country value from site_settings.
-- `profiles.public_location` remains available to the authenticated owner for
-- backwards compatibility, but it is no longer projected by public_profile.

begin;

revoke select on public.public_profile from anon, authenticated;
drop view public.public_profile;

create view public.public_profile
with (security_invoker = false, security_barrier = true) as
  select
    p.id,
    p.display_name,
    p.public_headline_en,
    p.public_headline_km,
    p.public_bio_en,
    p.public_bio_km,
    p.public_avatar_url
  from public.profiles p
 where p.is_site_owner;

comment on view public.public_profile is
  'Column-restricted public projection of the site-owner profile; precise location stays private.';

grant select on public.public_profile to anon, authenticated;

commit;
