-- Step 5: location integrity (docs/audit/FINDINGS.md LOKL-038, LOKL-042a/b/c).
-- Upgrade path for a deployment created from an older supabase/schema.sql.
-- Safe to run against a database that already has real listings/users data —
-- nothing here deletes or overwrites existing rows. See Task 4 in the Step 5
-- report for the separate, human-run diagnostic + remediation plan for rows
-- that already carry the old Koramangala/Bengaluru default.

-- 1. Stop defaulting a real place onto an account that hasn't set one.
-- location_lat/location_lng were already nullable (no NOT NULL constraint) —
-- only the fabricated default needed removing.
alter table public.users alter column location_lat drop default;
alter table public.users alter column location_lng drop default;
alter table public.users alter column locality set default '';
alter table public.users alter column city set default '';

-- 2. Table-level guard on listings — catches every insert path, not only this
-- app's own client code. Added NOT VALID: this does not re-check existing rows
-- (which, if any carry bad coordinates, would otherwise make this migration
-- fail outright) — run the Task 4 diagnostic first, remediate what it finds,
-- then run:
--   alter table public.listings validate constraint listings_location_lat_check;
--   alter table public.listings validate constraint listings_location_lng_check;
--   alter table public.listings validate constraint listings_no_null_island;
-- to actually enforce it retroactively once you've confirmed existing data is clean.
alter table public.listings
  add constraint listings_location_lat_check check (location_lat between -90 and 90) not valid;
alter table public.listings
  add constraint listings_location_lng_check check (location_lng between -180 and 180) not valid;
alter table public.listings
  add constraint listings_no_null_island check (not (location_lat = 0 and location_lng = 0)) not valid;

-- 3. Server-side backstop on the read path — anyone with the anon key can call
-- this RPC directly, bypassing the client's own requireValidCoordinate() check
-- (src/lib/utils.ts). create or replace is safe to re-run.
create or replace function public.search_listings_nearby(
  user_lat double precision,
  user_lng double precision,
  radius_km double precision,
  search_query text default '',
  categories_filter text[] default null,
  conditions_filter text[] default null,
  min_price_filter numeric default 0,
  max_price_filter numeric default 999999999,
  sort_by_filter text default 'distance',
  limit_count integer default 20,
  offset_count integer default 0,
  preset_filter text default 'all'
)
returns setof public.listings
language sql
stable
set search_path = public, extensions
as $$
  select l.*
  from public.listings l
  where l.status = 'active'
    and l.moderation_status <> 'blocked'
    and user_lat between -90 and 90
    and user_lng between -180 and 180
    and not (user_lat = 0 and user_lng = 0)
    and extensions.st_dwithin(
      extensions.st_setsrid(extensions.st_makepoint(l.location_lng, l.location_lat), 4326)::extensions.geography,
      extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat), 4326)::extensions.geography,
      radius_km * 1000
    )
    and (
      coalesce(search_query, '') = ''
      or l.search_vector @@ websearch_to_tsquery('simple', search_query)
      or l.title ilike '%' || search_query || '%'
    )
    and (categories_filter is null or l.category = any(categories_filter))
    and (conditions_filter is null or l.condition = any(conditions_filter))
    and l.price >= min_price_filter
    and l.price <= max_price_filter
    and (
      preset_filter = 'all'
      or (preset_filter = 'free' and l.is_free)
      or (preset_filter = 'urgent' and l.is_urgent)
      or (preset_filter = 'negotiable' and l.is_negotiable)
      or (preset_filter = 'under500' and l.price <= 500)
      or (preset_filter = 'under2000' and l.price <= 2000)
      or (preset_filter = 'under10000' and l.price <= 10000)
    )
  order by
    case when sort_by_filter = 'price-asc' then l.price end asc,
    case when sort_by_filter = 'price-desc' then l.price end desc,
    case when sort_by_filter = 'newest' then l.created_at end desc,
    extensions.st_distance(
      extensions.st_setsrid(extensions.st_makepoint(l.location_lng, l.location_lat), 4326)::extensions.geography,
      extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat), 4326)::extensions.geography
    ) asc
  limit limit_count
  offset offset_count;
$$;
