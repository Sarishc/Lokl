create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pg_cron with schema extensions;
grant usage on schema extensions to anon, authenticated;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.last_seen = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  phone text,
  full_name text default '',
  avatar_url text default '',
  bio text default '',
  location_lat double precision default 12.9352,
  location_lng double precision default 77.6245,
  locality text default 'Koramangala',
  city text default 'Bengaluru',
  is_verified boolean default true,
  is_dealer boolean default false,
  is_admin boolean default false,
  is_banned boolean default false,
  rating double precision default 5,
  total_reviews integer default 0,
  listings_sold integer default 0,
  blocked_user_ids uuid[] default '{}',
  legal_consent_version text,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  joined_at timestamptz default now(),
  last_seen timestamptz default now()
);

alter table public.users add column if not exists is_admin boolean default false;
alter table public.users add column if not exists is_banned boolean default false;
alter table public.users add column if not exists legal_consent_version text;
alter table public.users add column if not exists terms_accepted_at timestamptz;
alter table public.users add column if not exists privacy_accepted_at timestamptz;
alter table public.users alter column phone drop not null;
alter table public.users drop constraint if exists users_phone_key;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text not null,
  price numeric(12,2) default 0,
  is_negotiable boolean default false,
  is_free boolean default false,
  category text not null,
  condition text not null check (condition in ('New','Like New','Good','Fair')),
  images text[] default '{}',
  location_lat double precision not null,
  location_lng double precision not null,
  locality text not null,
  city text not null,
  status text not null default 'active' check (status in ('active','sold','reserved','deleted')),
  views integer default 0,
  is_urgent boolean default false,
  is_featured boolean default false,
  moderation_status text not null default 'clear' check (moderation_status in ('clear','flagged','blocked')),
  moderation_reason text,
  moderation_severity integer not null default 0 check (moderation_severity between 0 and 5),
  moderated_at timestamptz,
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '60 days',
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(category,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(locality,'')), 'C')
  ) stored
);

alter table public.listings add column if not exists moderation_status text not null default 'clear' check (moderation_status in ('clear','flagged','blocked'));
alter table public.listings add column if not exists moderation_reason text;
alter table public.listings add column if not exists moderation_severity integer not null default 0 check (moderation_severity between 0 and 5);
alter table public.listings add column if not exists moderated_at timestamptz;

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.users(id) on delete cascade,
  seller_id uuid not null references public.users(id) on delete cascade,
  last_message text default '',
  last_message_at timestamptz default now(),
  buyer_unread integer default 0,
  seller_unread integer default 0,
  typing_user_id uuid null references public.users(id) on delete set null,
  status text not null default 'active' check (status in ('active','archived')),
  unique (listing_id, buyer_id, seller_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  type text not null default 'text' check (type in ('text','image','offer','system')),
  offer_amount numeric(12,2),
  offer_status text check (offer_status in ('pending','accepted','rejected')),
  is_read boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.users(id) on delete cascade,
  reviewed_id uuid not null references public.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text default '',
  created_at timestamptz default now(),
  unique (reviewer_id, listing_id)
);

create table if not exists public.saved_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, listing_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('new_message','offer','listing_sold','review','price_drop','offer_accepted','listing_view_milestone')),
  title text not null,
  body text not null,
  data jsonb default '{}'::jsonb,
  is_read boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  listing_id uuid null references public.listings(id) on delete set null,
  reported_user_id uuid null references public.users(id) on delete set null,
  reason text not null,
  description text default '',
  status text not null default 'pending' check (status in ('pending','reviewed','resolved')),
  created_at timestamptz default now()
);

create table if not exists public.moderation_flags (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('listing','user','image','message')),
  listing_id uuid null references public.listings(id) on delete cascade,
  user_id uuid null references public.users(id) on delete cascade,
  source text not null check (source in ('user_report','auto_spam','auto_image')),
  reason text not null,
  description text default '',
  severity integer not null default 2 check (severity between 1 and 5),
  status text not null default 'pending' check (status in ('pending','reviewed','resolved')),
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table if not exists public.otp_request_attempts (
  id bigint generated always as identity primary key,
  phone_hash text not null,
  device_id text not null,
  ip_hash text,
  allowed boolean not null default true,
  reason text,
  created_at timestamptz default now()
);

create table if not exists public.security_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null check (alert_type in ('otp_volume_anomaly')),
  severity integer not null default 3 check (severity between 1 and 5),
  title text not null,
  description text default '',
  data jsonb default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create index if not exists idx_users_phone on public.users(phone);
create unique index if not exists users_phone_unique_not_null on public.users(phone) where phone is not null;
create index if not exists idx_users_locality_city on public.users(city, locality);
create index if not exists idx_listings_seller on public.listings(seller_id);
create index if not exists idx_listings_status_city on public.listings(status, city);
create index if not exists idx_listings_created_at on public.listings(created_at desc);
create index if not exists idx_listings_moderation on public.listings(moderation_status, moderation_severity desc, created_at desc);
create index if not exists idx_listings_search_vector on public.listings using gin(search_vector);
create index if not exists idx_chats_participants on public.chats(buyer_id, seller_id, last_message_at desc);
create index if not exists idx_chats_buyer on public.chats(buyer_id);
create index if not exists idx_chats_seller on public.chats(seller_id);
create index if not exists idx_chats_typing_user on public.chats(typing_user_id);
create index if not exists idx_messages_chat_created on public.messages(chat_id, created_at);
create index if not exists idx_messages_sender on public.messages(sender_id);
create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_reports_status_created on public.reports(status, created_at desc);
create index if not exists idx_reports_reporter on public.reports(reporter_id);
create index if not exists idx_reports_listing on public.reports(listing_id);
create index if not exists idx_reports_reported_user on public.reports(reported_user_id);
create index if not exists idx_moderation_flags_queue on public.moderation_flags(status, severity desc, created_at desc);
create index if not exists idx_moderation_flags_listing on public.moderation_flags(listing_id);
create index if not exists idx_otp_request_attempts_phone_created on public.otp_request_attempts(phone_hash, created_at desc);
create index if not exists idx_otp_request_attempts_device_created on public.otp_request_attempts(device_id, created_at desc);
create index if not exists idx_otp_request_attempts_ip_created on public.otp_request_attempts(ip_hash, created_at desc);
create index if not exists idx_security_alerts_queue on public.security_alerts(status, severity desc, created_at desc);
create index if not exists idx_reviews_reviewed on public.reviews(reviewed_id);
create index if not exists idx_reviews_listing on public.reviews(listing_id);
create index if not exists idx_saved_user_listing on public.saved_listings(user_id, listing_id);
create index if not exists idx_saved_listing on public.saved_listings(listing_id);
create index if not exists idx_listings_geog on public.listings using gist ((extensions.st_setsrid(extensions.st_makepoint(location_lng, location_lat), 4326)::extensions.geography));

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.users
    where id = (select auth.uid())
      and is_admin = true
      and is_banned = false
  );
$$;

create or replace function public.current_user_is_banned()
returns boolean
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.users
    where id = (select auth.uid())
      and is_banned = true
  );
$$;

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

create or replace function public.increment_listing_views(listing_id_input uuid)
returns void
language sql
set search_path = public
as $$
  update public.listings set views = views + 1 where id = listing_id_input;
$$;

create or replace function public.update_chat_metadata()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  chat_record public.chats;
begin
  select * into chat_record from public.chats where id = new.chat_id;
  update public.chats
  set
    last_message = case when new.type = 'offer' then 'Offer: ₹' || coalesce(new.offer_amount,0)::text else new.content end,
    last_message_at = new.created_at,
    buyer_unread = case when new.sender_id = chat_record.seller_id then buyer_unread + 1 else buyer_unread end,
    seller_unread = case when new.sender_id = chat_record.buyer_id then seller_unread + 1 else seller_unread end,
    typing_user_id = null
  where id = new.chat_id;
  return new;
end;
$$;

create or replace function public.refresh_user_rating()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_user uuid;
begin
  target_user := coalesce(new.reviewed_id, old.reviewed_id);
  update public.users u
  set
    rating = coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r where r.reviewed_id = target_user), 5),
    total_reviews = (select count(*) from public.reviews r where r.reviewed_id = target_user)
  where u.id = target_user;
  return coalesce(new, old);
end;
$$;

create or replace function public.expire_old_listings()
returns void
language sql
security definer
set search_path = public
as $$
  update public.listings
  set status = 'deleted'
  where status in ('active', 'reserved') and expires_at < now();
$$;

revoke execute on function public.expire_old_listings() from public, anon, authenticated;

create or replace function public.protect_user_admin_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.current_user_is_banned() and not public.current_user_is_admin() then
    raise exception 'Banned users cannot update profiles';
  end if;

  if not public.current_user_is_admin() then
    if new.is_admin is distinct from old.is_admin
      or new.is_banned is distinct from old.is_banned
      or new.rating is distinct from old.rating
      or new.total_reviews is distinct from old.total_reviews
      or new.listings_sold is distinct from old.listings_sold then
      raise exception 'Protected user fields can only be changed by admins or trusted server jobs';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.protect_message_updates()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  chat_record public.chats;
  read_receipt_update boolean;
  offer_status_update boolean;
begin
  if public.current_user_is_admin() then
    return new;
  end if;

  select * into chat_record from public.chats where id = old.chat_id;
  if chat_record.id is null or auth.uid() not in (chat_record.buyer_id, chat_record.seller_id) then
    raise exception 'Only chat participants can update messages';
  end if;

  read_receipt_update :=
    old.chat_id is not distinct from new.chat_id
    and old.sender_id is not distinct from new.sender_id
    and old.content is not distinct from new.content
    and old.type is not distinct from new.type
    and old.offer_amount is not distinct from new.offer_amount
    and old.offer_status is not distinct from new.offer_status
    and old.created_at is not distinct from new.created_at
    and old.is_read = false
    and new.is_read = true
    and old.sender_id <> auth.uid();

  offer_status_update :=
    old.chat_id is not distinct from new.chat_id
    and old.sender_id is not distinct from new.sender_id
    and old.content is not distinct from new.content
    and old.type = 'offer'
    and new.type = 'offer'
    and old.offer_amount is not distinct from new.offer_amount
    and old.created_at is not distinct from new.created_at
    and old.is_read is not distinct from new.is_read
    and old.sender_id <> auth.uid()
    and old.offer_status = 'pending'
    and new.offer_status in ('accepted', 'rejected');

  if not read_receipt_update and not offer_status_update then
    raise exception 'Only read receipts and incoming offer decisions can be updated by clients';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_listing_rate_and_moderation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  combined_text text;
  flag_reasons text[] := '{}';
  recent_hour_count integer;
  recent_day_count integer;
begin
  if tg_op = 'INSERT' then
    select count(*) into recent_hour_count
    from public.listings
    where seller_id = new.seller_id
      and created_at > now() - interval '1 hour'
      and status <> 'deleted';

    select count(*) into recent_day_count
    from public.listings
    where seller_id = new.seller_id
      and created_at > now() - interval '1 day'
      and status <> 'deleted';

    if recent_hour_count >= 8 then
      raise exception 'Posting limit reached: try again later';
    end if;

    if recent_day_count >= 25 then
      raise exception 'Daily posting limit reached: try again tomorrow';
    end if;
  end if;

  combined_text := lower(coalesce(new.title, '') || ' ' || coalesce(new.description, ''));

  if combined_text ~ '(send\s+money\s+first|advance\s+payment|pay\s+before|western\s+union|crypto|whatsapp|telegram|click\s+this\s+link|bit\.ly|tinyurl|https?://)' then
    flag_reasons := array_append(flag_reasons, 'Possible scam or off-platform payment language');
  end if;

  if combined_text ~ '(\+?\d[\d\s-]{8,}\d)' then
    flag_reasons := array_append(flag_reasons, 'Phone number embedded in listing text');
  end if;

  if exists (
    select 1
    from public.listings l
    where l.seller_id = new.seller_id
      and l.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and l.status in ('active', 'reserved')
      and lower(l.title) = lower(new.title)
      and lower(l.description) = lower(new.description)
      and l.created_at > now() - interval '7 days'
  ) then
    flag_reasons := array_append(flag_reasons, 'Repeated identical listing');
  end if;

  if array_length(flag_reasons, 1) is not null then
    new.moderation_status := 'flagged';
    new.moderation_reason := array_to_string(flag_reasons, '; ');
    new.moderation_severity := case when new.moderation_reason ilike '%scam%' then 4 else 3 end;
    new.moderated_at := now();
  elsif new.moderation_status <> 'blocked' then
    new.moderation_status := 'clear';
    new.moderation_reason := null;
    new.moderation_severity := 0;
  end if;

  return new;
end;
$$;

create or replace function public.create_listing_moderation_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.moderation_status = 'flagged'
    and coalesce(new.moderation_reason, '') <> ''
    and (tg_op = 'INSERT' or new.moderation_reason is distinct from old.moderation_reason) then
    insert into public.moderation_flags (target_type, listing_id, user_id, source, reason, description, severity)
    values (
      'listing',
      new.id,
      new.seller_id,
      'auto_spam',
      new.moderation_reason,
      'Automated first-line moderation flag. Human review required before permanent action.',
      greatest(new.moderation_severity, 2)
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.create_listing_moderation_flag() from public, anon, authenticated;

create or replace function public.check_otp_volume_anomaly(
  min_last_hour_count integer default 25,
  multiplier numeric default 3
)
returns table(last_hour_count integer, rolling_hour_average numeric, alert_created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
  rolling_average numeric;
  should_alert boolean;
begin
  select count(*) into recent_count
  from public.otp_request_attempts
  where created_at >= now() - interval '1 hour';

  select coalesce(count(*)::numeric / 23, 0) into rolling_average
  from public.otp_request_attempts
  where created_at >= now() - interval '24 hours'
    and created_at < now() - interval '1 hour';

  should_alert := recent_count >= min_last_hour_count
    and (rolling_average = 0 or recent_count >= rolling_average * multiplier)
    and not exists (
      select 1
      from public.security_alerts
      where alert_type = 'otp_volume_anomaly'
        and status = 'open'
        and created_at >= now() - interval '1 hour'
    );

  if should_alert then
    insert into public.security_alerts (alert_type, severity, title, description, data)
    values (
      'otp_volume_anomaly',
      case when recent_count >= min_last_hour_count * 3 then 5 else 4 end,
      'OTP request volume spike',
      'OTP request attempts exceeded the configured hourly anomaly threshold.',
      jsonb_build_object('lastHourCount', recent_count, 'rollingHourAverage', rolling_average, 'minLastHourCount', min_last_hour_count, 'multiplier', multiplier)
    );
  end if;

  return query select recent_count, rolling_average, should_alert;
end;
$$;

revoke execute on function public.check_otp_volume_anomaly(integer, numeric) from public, anon, authenticated;

create or replace function public.create_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chat_record public.chats;
  recipient_id uuid;
  sender_name text;
begin
  select * into chat_record from public.chats where id = new.chat_id;
  if chat_record.id is null then
    return new;
  end if;

  recipient_id := case when new.sender_id = chat_record.buyer_id then chat_record.seller_id else chat_record.buyer_id end;
  select coalesce(nullif(full_name, ''), 'A neighbour') into sender_name from public.users where id = new.sender_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    recipient_id,
    case when new.type = 'offer' then 'offer' else 'new_message' end,
    case when new.type = 'offer' then 'New offer from ' || sender_name else 'New message from ' || sender_name end,
    case when new.type = 'offer' then 'Offer: ₹' || coalesce(new.offer_amount, 0)::text else left(new.content, 140) end,
    jsonb_build_object('chatId', new.chat_id, 'listingId', chat_record.listing_id)
  );

  return new;
end;
$$;

revoke execute on function public.create_message_notification() from public, anon, authenticated;

drop trigger if exists trg_messages_chat_metadata on public.messages;
drop trigger if exists trg_messages_notification on public.messages;
drop trigger if exists trg_reviews_refresh_user_rating on public.reviews;
drop trigger if exists trg_users_protect_admin_fields on public.users;
drop trigger if exists trg_messages_protect_updates on public.messages;
drop trigger if exists trg_listings_rate_and_moderation on public.listings;
drop trigger if exists trg_listings_create_moderation_flag on public.listings;

create trigger trg_messages_chat_metadata
after insert on public.messages
for each row execute function public.update_chat_metadata();

create trigger trg_messages_notification
after insert on public.messages
for each row execute function public.create_message_notification();

create trigger trg_users_protect_admin_fields
before update on public.users
for each row execute function public.protect_user_admin_fields();

create trigger trg_messages_protect_updates
before update on public.messages
for each row execute function public.protect_message_updates();

create trigger trg_reviews_refresh_user_rating
after insert or update or delete on public.reviews
for each row execute function public.refresh_user_rating();

create trigger trg_listings_rate_and_moderation
before insert or update of title, description, status on public.listings
for each row execute function public.enforce_listing_rate_and_moderation();

create trigger trg_listings_create_moderation_flag
after insert or update of moderation_status, moderation_reason on public.listings
for each row execute function public.create_listing_moderation_flag();

alter table public.users enable row level security;
alter table public.listings enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.saved_listings enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_flags enable row level security;
alter table public.otp_request_attempts enable row level security;
alter table public.security_alerts enable row level security;

revoke all on table
  public.users,
  public.listings,
  public.saved_listings,
  public.chats,
  public.messages,
  public.reviews,
  public.notifications,
  public.reports,
  public.moderation_flags,
  public.otp_request_attempts,
  public.security_alerts
from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on table
  public.users,
  public.listings,
  public.saved_listings,
  public.chats,
  public.messages,
  public.reviews,
  public.notifications,
  public.reports,
  public.moderation_flags,
  public.security_alerts
to authenticated;

grant insert on table
  public.users,
  public.listings,
  public.saved_listings,
  public.chats,
  public.messages,
  public.reports
to authenticated;

grant update on table
  public.users,
  public.listings,
  public.chats,
  public.messages,
  public.notifications,
  public.moderation_flags,
  public.security_alerts
to authenticated;

grant delete on table public.saved_listings to authenticated;

drop policy if exists "users readable by anyone" on public.users;
drop policy if exists "users manage own profile" on public.users;
drop policy if exists "users update own profile" on public.users;
drop policy if exists "admins update users" on public.users;
drop policy if exists "users update own profile or admin" on public.users;
drop policy if exists "listings readable active" on public.listings;
drop policy if exists "sellers manage own listings" on public.listings;
drop policy if exists "listings insert by seller" on public.listings;
drop policy if exists "listings update by seller" on public.listings;
drop policy if exists "admins moderate listings" on public.listings;
drop policy if exists "listings update by seller or admin" on public.listings;
drop policy if exists "chat participants can read" on public.chats;
drop policy if exists "chat participants can update" on public.chats;
drop policy if exists "buyers can create chats" on public.chats;
drop policy if exists "participants read messages" on public.messages;
drop policy if exists "participants send messages" on public.messages;
drop policy if exists "participants update own message read state" on public.messages;
drop policy if exists "participants update message read state" on public.messages;
drop policy if exists "reviews readable" on public.reviews;
drop policy if exists "users create reviews about others" on public.reviews;
drop policy if exists "saved listing owner only" on public.saved_listings;
drop policy if exists "notifications owner only" on public.notifications;
drop policy if exists "notifications owner read" on public.notifications;
drop policy if exists "notifications owner update read state" on public.notifications;
drop policy if exists "reports readable by reporter" on public.reports;
drop policy if exists "reports created by reporter" on public.reports;
drop policy if exists "reports readable by admin" on public.reports;
drop policy if exists "reports updated by admin" on public.reports;
drop policy if exists "moderation flags readable by admin" on public.moderation_flags;
drop policy if exists "moderation flags updated by admin" on public.moderation_flags;
drop policy if exists "security alerts readable by admin" on public.security_alerts;
drop policy if exists "security alerts updated by admin" on public.security_alerts;

create policy "users readable by anyone"
on public.users for select
using (true);

create policy "users manage own profile"
on public.users for insert
with check ((select auth.uid()) = id and coalesce(is_admin, false) = false and coalesce(is_banned, false) = false);

create policy "users update own profile or admin"
on public.users for update
to authenticated
using ((((select auth.uid()) = id) and not public.current_user_is_banned()) or public.current_user_is_admin())
with check (((select auth.uid()) = id) or public.current_user_is_admin());

create policy "listings readable active"
on public.listings for select
using ((status = 'active' and moderation_status <> 'blocked') or (select auth.uid()) = seller_id or public.current_user_is_admin());

create policy "listings insert by seller"
on public.listings for insert
with check ((select auth.uid()) = seller_id and not public.current_user_is_banned());

create policy "listings update by seller or admin"
on public.listings for update
to authenticated
using ((((select auth.uid()) = seller_id) and not public.current_user_is_banned()) or public.current_user_is_admin())
with check ((((select auth.uid()) = seller_id) and not public.current_user_is_banned()) or public.current_user_is_admin());

create policy "chat participants can read"
on public.chats for select
using ((select auth.uid()) in (buyer_id, seller_id));

create policy "chat participants can update"
on public.chats for update
using ((select auth.uid()) in (buyer_id, seller_id) and not public.current_user_is_banned())
with check ((select auth.uid()) in (buyer_id, seller_id) and not public.current_user_is_banned());

create policy "buyers can create chats"
on public.chats for insert
with check (((select auth.uid()) = buyer_id or (select auth.uid()) = seller_id) and not public.current_user_is_banned());

create policy "participants read messages"
on public.messages for select
using (exists (select 1 from public.chats c where c.id = chat_id and (select auth.uid()) in (c.buyer_id, c.seller_id)));

create policy "participants send messages"
on public.messages for insert
with check ((select auth.uid()) = sender_id and not public.current_user_is_banned() and exists (select 1 from public.chats c where c.id = chat_id and (select auth.uid()) in (c.buyer_id, c.seller_id)));

create policy "participants update message read state"
on public.messages for update
using (exists (select 1 from public.chats c where c.id = chat_id and (select auth.uid()) in (c.buyer_id, c.seller_id)))
with check (exists (select 1 from public.chats c where c.id = chat_id and (select auth.uid()) in (c.buyer_id, c.seller_id)));

create policy "reviews readable"
on public.reviews for select
using (true);

create policy "users create reviews about others"
on public.reviews for insert
with check ((select auth.uid()) = reviewer_id and not public.current_user_is_banned());

create policy "saved listing owner only"
on public.saved_listings for all
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "notifications owner read"
on public.notifications for select
using ((select auth.uid()) = user_id);

create policy "notifications owner update read state"
on public.notifications for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "reports readable by reporter"
on public.reports for select
using ((select auth.uid()) = reporter_id or public.current_user_is_admin());

create policy "reports created by reporter"
on public.reports for insert
with check ((select auth.uid()) = reporter_id and not public.current_user_is_banned());

create policy "reports updated by admin"
on public.reports for update
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

create policy "moderation flags readable by admin"
on public.moderation_flags for select
using (public.current_user_is_admin());

create policy "moderation flags updated by admin"
on public.moderation_flags for update
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

create policy "security alerts readable by admin"
on public.security_alerts for select
using (public.current_user_is_admin());

create policy "security alerts updated by admin"
on public.security_alerts for update
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lokl-media', 'lokl-media', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "lokl media authenticated uploads" on storage.objects;
drop policy if exists "lokl media authenticated reads" on storage.objects;
drop policy if exists "lokl media authenticated updates" on storage.objects;
drop policy if exists "lokl media authenticated deletes" on storage.objects;
drop policy if exists "lokl media authenticated owner reads" on storage.objects;
drop policy if exists "lokl media authenticated owner updates" on storage.objects;
drop policy if exists "lokl media authenticated owner deletes" on storage.objects;

create policy "lokl media authenticated uploads"
on storage.objects for insert
to authenticated
with check (bucket_id = 'lokl-media');

create policy "lokl media authenticated owner reads"
on storage.objects for select
to authenticated
using (bucket_id = 'lokl-media' and owner = (select auth.uid()));

create policy "lokl media authenticated owner updates"
on storage.objects for update
to authenticated
using (bucket_id = 'lokl-media' and owner = (select auth.uid()))
with check (bucket_id = 'lokl-media' and owner = (select auth.uid()));

create policy "lokl media authenticated owner deletes"
on storage.objects for delete
to authenticated
using (bucket_id = 'lokl-media' and owner = (select auth.uid()));

insert into public.users (id, phone, full_name, avatar_url, bio, location_lat, location_lng, locality, city, is_verified, is_dealer, rating, total_reviews, listings_sold, joined_at, last_seen)
values
('11111111-1111-1111-1111-111111111111', '+919811223344', 'Aarav Mehta', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80', 'Weekend declutterer. Mostly gadgets and furniture from Koramangala.', 12.9352, 77.6245, 'Koramangala', 'Bengaluru', true, false, 4.8, 29, 18, now() - interval '420 days', now() - interval '1 hour'),
('22222222-2222-2222-2222-222222222222', '+919900112233', 'Isha Rao', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80', 'Interior stylist selling decor, plants and apartment essentials.', 19.1136, 72.8697, 'Andheri West', 'Mumbai', true, true, 4.9, 57, 42, now() - interval '780 days', now() - interval '3 hour'),
('33333333-3333-3333-3333-333333333333', '+919701234567', 'Kabir Malhotra', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80', 'Cyclist, photographer, and collector of interesting things in Hauz Khas.', 28.5494, 77.2001, 'Hauz Khas', 'Delhi', true, false, 4.6, 21, 13, now() - interval '650 days', now() - interval '5 hour'),
('44444444-4444-4444-4444-444444444444', '+918888000111', 'Saanvi Reddy', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80', 'Student seller. Fast replies. Mostly books, electronics and hostel finds.', 17.4375, 78.4483, 'Jubilee Hills', 'Hyderabad', true, false, 4.7, 17, 10, now() - interval '260 days', now() - interval '2 hour'),
('55555555-5555-5555-5555-555555555555', '+917700009999', 'Vikram Narayan', 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=200&q=80', 'IT professional in Pune. Clean tech, gaming and home office setup deals.', 18.5590, 73.7868, 'Baner', 'Pune', true, false, 4.5, 12, 7, now() - interval '340 days', now() - interval '7 hour')
on conflict (id) do nothing;

insert into public.listings (id, seller_id, title, description, price, is_negotiable, is_free, category, condition, images, location_lat, location_lng, locality, city, status, views, is_urgent, is_featured, created_at, expires_at)
values
('aaaaaaa1-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','iPhone 14 128GB Midnight','Purchased from Apple BKC, battery health 92%, with box and Spigen case.',45900,true,false,'Mobiles','Like New',array['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=80','https://images.unsplash.com/photo-1603921326210-6edd2d60ca68?auto=format&fit=crop&w=900&q=80'],12.934,77.626,'Koramangala','Bengaluru','active',142,false,true,now()-interval '1 hour', now()+interval '60 days'),
('aaaaaaa2-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','IKEA Linnmon Study Table 120cm','Perfect for WFH. Minor scratch on one edge, sturdy and easy pickup from 5th Block.',3200,true,false,'Furniture','Good',array['https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=900&q=80'],12.9331,77.6221,'Koramangala','Bengaluru','active',88,true,false,now()-interval '4 hour', now()+interval '60 days'),
('aaaaaaa3-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Sony WH-1000XM4 Headphones','Great ANC. Used mostly indoors. Includes carrying case and original cable.',14999,true,false,'Electronics','Like New',array['https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=900&q=80'],12.9362,77.6205,'HSR Layout','Bengaluru','active',233,false,true,now()-interval '7 hour', now()+interval '60 days'),
('aaaaaaa4-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Royal Enfield Helmet Matte Black','ISI certified full-face helmet, size M, cleaned and ready.',1800,false,false,'Bikes','Good',array['https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=900&q=80'],12.928,77.61,'BTM Layout','Bengaluru','active',31,true,false,now()-interval '10 hour', now()+interval '60 days'),
('aaaaaaa5-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Bean Bag XL Grey','Soft refill added last month. Ideal for gaming setup or balcony corner.',1200,true,false,'Home Decor','Good',array['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'],12.941,77.615,'Indiranagar','Bengaluru','active',27,false,false,now()-interval '13 hour', now()+interval '60 days'),
('aaaaaaa6-0000-0000-0000-000000000006','22222222-2222-2222-2222-222222222222','Marshall Emberton Bluetooth Speaker','Used in my studio. Rich bass, no dents, comes with braided cable.',7999,true,false,'Electronics','Like New',array['https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=900&q=80'],19.1211,72.8362,'Bandra West','Mumbai','active',74,false,true,now()-interval '16 hour', now()+interval '60 days'),
('aaaaaaa7-0000-0000-0000-000000000007','22222222-2222-2222-2222-222222222222','Velvet 3-Seater Sofa Olive Green','Statement sofa from Pepperfry, recently steam cleaned, pickup only.',18500,true,false,'Furniture','Good',array['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=80'],19.1345,72.8212,'Andheri West','Mumbai','active',126,false,true,now()-interval '19 hour', now()+interval '60 days'),
('aaaaaaa8-0000-0000-0000-000000000008','22222222-2222-2222-2222-222222222222','Set of 4 Ceramic Planters','Minimal cream finish. Great for balcony herbs or indoor snake plants.',900,false,false,'Home Decor','New',array['https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=900&q=80'],19.1173,72.8465,'Versova','Mumbai','active',45,true,false,now()-interval '22 hour', now()+interval '60 days'),
('aaaaaaa9-0000-0000-0000-000000000009','22222222-2222-2222-2222-222222222222','Samsung 253L Double Door Fridge','Cooling is excellent. Selling because I am upgrading my kitchen setup.',13900,true,false,'Appliances','Good',array['https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=900&q=80'],19.1113,72.8479,'Andheri West','Mumbai','reserved',164,false,false,now()-interval '25 hour', now()+interval '60 days'),
('aaaaaaa0-0000-0000-0000-000000000010','22222222-2222-2222-2222-222222222222','Dyson Airwrap Attachments Organiser','Custom acrylic organiser, barely used, fits all attachments perfectly.',2500,false,false,'Fashion','Like New',array['https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80'],19.1155,72.8382,'Juhu','Mumbai','active',61,false,false,now()-interval '28 hour', now()+interval '60 days'),
('bbbbbbb1-0000-0000-0000-000000000011','33333333-3333-3333-3333-333333333333','Canon EOS 200D II with 50mm Lens','Perfect beginner DSLR combo, shutter count low, includes 2 batteries.',35500,true,false,'Electronics','Like New',array['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80'],28.5521,77.2022,'Hauz Khas','Delhi','active',109,false,true,now()-interval '31 hour', now()+interval '60 days'),
('bbbbbbb2-0000-0000-0000-000000000012','33333333-3333-3333-3333-333333333333','Firefox Rapide 21-Speed Cycle','Recently serviced, tyres changed in March, ideal for morning rides.',7800,true,false,'Sports','Good',array['https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=900&q=80'],28.5602,77.1944,'Green Park','Delhi','active',92,false,false,now()-interval '34 hour', now()+interval '60 days'),
('bbbbbbb3-0000-0000-0000-000000000013','33333333-3333-3333-3333-333333333333','OnePlus 12R 256GB Cool Blue','Purchased 4 months ago, still under warranty, invoice available.',31999,false,false,'Mobiles','Like New',array['https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=900&q=80'],28.5477,77.2071,'Hauz Khas','Delhi','active',58,true,false,now()-interval '37 hour', now()+interval '60 days'),
('bbbbbbb4-0000-0000-0000-000000000014','33333333-3333-3333-3333-333333333333','Mid-century Walnut Bookshelf','Solid wood bookshelf with 5 shelves. Fits studio apartments perfectly.',6900,true,false,'Furniture','Good',array['https://images.unsplash.com/photo-1594620302200-9a762244a156?auto=format&fit=crop&w=900&q=80'],28.5662,77.2144,'Saket','Delhi','active',38,false,false,now()-interval '40 hour', now()+interval '60 days'),
('bbbbbbb5-0000-0000-0000-000000000015','33333333-3333-3333-3333-333333333333','Free UPS Battery Backup Cabinet','Needs pickup today. Metal cabinet is sturdy, battery inside is dead.',0,false,true,'Appliances','Fair',array['https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=900&q=80'],28.5609,77.1986,'Malviya Nagar','Delhi','active',17,true,false,now()-interval '43 hour', now()+interval '60 days'),
('ccccccc1-0000-0000-0000-000000000016','44444444-4444-4444-4444-444444444444','Dell 24-inch Monitor P2419H','Works flawlessly. Great for coding and movies. HDMI cable included.',7900,true,false,'Electronics','Good',array['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80'],17.4301,78.4371,'Jubilee Hills','Hyderabad','active',67,false,true,now()-interval '46 hour', now()+interval '60 days'),
('ccccccc2-0000-0000-0000-000000000017','44444444-4444-4444-4444-444444444444','Hostel Essentials Combo','Laundry basket, mini rack, two buckets and mirror. Selling as bundle.',1100,false,false,'Home Decor','Good',array['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'],17.4382,78.4411,'Madhapur','Hyderabad','active',23,true,false,now()-interval '49 hour', now()+interval '60 days'),
('ccccccc3-0000-0000-0000-000000000018','44444444-4444-4444-4444-444444444444','Kindle Paperwhite 11th Gen','No scratches. Ideal for UPSC prep or leisure reading. Cover included.',9200,true,false,'Books','Like New',array['https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80'],17.4448,78.3927,'Gachibowli','Hyderabad','active',52,false,false,now()-interval '52 hour', now()+interval '60 days'),
('ccccccc4-0000-0000-0000-000000000019','44444444-4444-4444-4444-444444444444','Prestige Induction Cooktop','Single touch controls, perfect for PGs and hostels. Bill available.',1700,false,false,'Appliances','Good',array['https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&w=900&q=80'],17.4509,78.3837,'Financial District','Hyderabad','active',29,false,false,now()-interval '55 hour', now()+interval '60 days'),
('ccccccc5-0000-0000-0000-000000000020','44444444-4444-4444-4444-444444444444','Zara Denim Jacket Oversized M','Trendy wash, only worn twice, super clean. Pickup or Dunzo within 3 km.',1600,true,false,'Fashion','Like New',array['https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=80'],17.4399,78.4005,'Kondapur','Hyderabad','active',41,false,false,now()-interval '58 hour', now()+interval '60 days'),
('ddddddd1-0000-0000-0000-000000000021','55555555-5555-5555-5555-555555555555','PS5 Disc Edition + 2 Controllers','Excellent condition, very light use, one extra Cosmic Red controller included.',40999,true,false,'Gaming','Like New',array['https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=900&q=80'],18.5601,73.7812,'Baner','Pune','active',144,false,true,now()-interval '61 hour', now()+interval '60 days'),
('ddddddd2-0000-0000-0000-000000000022','55555555-5555-5555-5555-555555555555','Ergonomic Mesh Office Chair','Lumbar support, smooth wheels, ideal for long desk sessions.',4800,true,false,'Furniture','Good',array['https://images.unsplash.com/photo-1505843513577-22bb7d21e455?auto=format&fit=crop&w=900&q=80'],18.5672,73.7741,'Aundh','Pune','active',66,true,false,now()-interval '64 hour', now()+interval '60 days'),
('ddddddd3-0000-0000-0000-000000000023','55555555-5555-5555-5555-555555555555','Nintendo Switch OLED','Comes with carrying case and Mario Kart 8 Deluxe cartridge.',22900,false,false,'Gaming','Like New',array['https://images.unsplash.com/photo-1612036782180-6f0822045d95?auto=format&fit=crop&w=900&q=80'],18.5423,73.7921,'Balewadi','Pune','active',54,false,false,now()-interval '67 hour', now()+interval '60 days'),
('ddddddd4-0000-0000-0000-000000000024','55555555-5555-5555-5555-555555555555','Bosch Front Load Washing Machine 7kg','Fully working, moved to furnished flat so selling quickly.',12500,true,false,'Appliances','Good',array['https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=900&q=80'],18.5481,73.8071,'Wakad','Pune','active',70,true,false,now()-interval '70 hour', now()+interval '60 days'),
('ddddddd5-0000-0000-0000-000000000025','55555555-5555-5555-5555-555555555555','MacBook Air M1 8GB 256GB','Battery health 96%, kept in sleeve always, invoice + charger available.',51500,true,false,'Electronics','Like New',array['https://images.unsplash.com/photo-1517336714739-489689fd1ca8?auto=format&fit=crop&w=900&q=80'],18.5513,73.7761,'Baner','Pune','active',173,false,true,now()-interval '73 hour', now()+interval '60 days'),
('eeeeeee1-0000-0000-0000-000000000026','22222222-2222-2222-2222-222222222222','Air Fryer Philips 4.1L','Crispy snacks without oil. Great for apartments. Includes recipe booklet.',5400,true,false,'Appliances','Good',array['https://images.unsplash.com/photo-1585515656263-8ed3b1d64cf2?auto=format&fit=crop&w=900&q=80'],13.0486,80.209,'T Nagar','Chennai','active',26,false,false,now()-interval '76 hour', now()+interval '60 days'),
('eeeeeee2-0000-0000-0000-000000000027','33333333-3333-3333-3333-333333333333','Yamaha Acoustic Guitar F280','Warm sound, fresh strings, includes capo and padded bag.',6200,true,false,'Sports','Good',array['https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=900&q=80'],13.0399,80.2342,'Nungambakkam','Chennai','active',33,false,false,now()-interval '79 hour', now()+interval '60 days'),
('eeeeeee3-0000-0000-0000-000000000028','44444444-4444-4444-4444-444444444444','Temple Brass Lamp Pair','Traditional kuthu vilakku set, polished and beautiful for festive decor.',2900,false,false,'Home Decor','Like New',array['https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=900&q=80'],13.0604,80.2496,'Mylapore','Chennai','active',19,false,false,now()-interval '82 hour', now()+interval '60 days'),
('eeeeeee4-0000-0000-0000-000000000029','55555555-5555-5555-5555-555555555555','Voltas 1.5 Ton Inverter AC','Cooling is strong. Service done last month. Selling before move-out.',21900,true,false,'Appliances','Good',array['https://images.unsplash.com/photo-1631088390716-5275366b5df7?auto=format&fit=crop&w=900&q=80'],19.0646,72.837,'Powai','Mumbai','active',91,true,false,now()-interval '85 hour', now()+interval '60 days'),
('eeeeeee5-0000-0000-0000-000000000030','11111111-1111-1111-1111-111111111111','Hero Pleasure Plus Scooter 2021','Single owner, insurance valid, city mileage around 45. RC transfer mandatory.',46500,true,false,'Bikes','Good',array['https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80'],12.9716,77.5946,'Richmond Town','Bengaluru','active',65,false,false,now()-interval '88 hour', now()+interval '60 days')
on conflict (id) do nothing;

insert into public.reviews (id, reviewer_id, reviewed_id, listing_id, rating, comment, created_at)
values
('f1111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','aaaaaaa2-0000-0000-0000-000000000002',5,'Quick pickup and exactly as described.', now()-interval '8 days'),
('f2222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','aaaaaaa7-0000-0000-0000-000000000007',5,'Very responsive seller, smooth deal.', now()-interval '14 days'),
('f3333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555','44444444-4444-4444-4444-444444444444','ccccccc3-0000-0000-0000-000000000018',4,'Product worked great, polite meetup.', now()-interval '21 days')
on conflict (id) do nothing;

insert into public.chats (id, listing_id, buyer_id, seller_id, last_message, last_message_at, buyer_unread, seller_unread, status)
values
('c1111111-1111-1111-1111-111111111111','aaaaaaa2-0000-0000-0000-000000000002','44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','Can you do ₹3000 if I pick up tonight?', now()-interval '2 hours',0,1,'active'),
('c2222222-2222-2222-2222-222222222222','bbbbbbb1-0000-0000-0000-000000000011','55555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333','Offer accepted. I can come tomorrow morning.', now()-interval '6 hours',0,0,'active'),
('c3333333-3333-3333-3333-333333333333','ddddddd1-0000-0000-0000-000000000021','11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555555','Still available? Is the red controller included?', now()-interval '12 hours',1,0,'active')
on conflict (id) do nothing;

insert into public.messages (id, chat_id, sender_id, content, type, offer_amount, offer_status, is_read, created_at)
values
('m1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444','Hey Aarav, is the table still available?','text',null,null,true, now()-interval '3 hours'),
('m1111112-1111-1111-1111-111111111112','c1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','Yes, it is. Pickup from Koramangala 5th Block.','text',null,null,true, now()-interval '2 hours 48 minutes'),
('m1111113-1111-1111-1111-111111111113','c1111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444','Can you do ₹3000 if I pick up tonight?','offer',3000,'pending',false, now()-interval '2 hours'),
('m2222221-2222-2222-2222-222222222221','c2222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555555','Loved the camera sample shots. Sending an offer.','text',null,null,true, now()-interval '8 hours'),
('m2222222-2222-2222-2222-222222222222','c2222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555555','Offer','offer',34000,'accepted',true, now()-interval '7 hours 30 minutes'),
('m2222223-2222-2222-2222-222222222223','c2222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','Offer accepted. I can hold it till tomorrow morning.','system',null,null,true, now()-interval '6 hours'),
('m3333331-3333-3333-3333-333333333331','c3333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','Still available? Is the red controller included?','text',null,null,false, now()-interval '12 hours')
on conflict (id) do nothing;

insert into public.saved_listings (id, user_id, listing_id, created_at)
values ('s1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','aaaaaaa6-0000-0000-0000-000000000006', now()-interval '2 days')
on conflict (user_id, listing_id) do nothing;

insert into public.notifications (id, user_id, type, title, body, data, is_read, created_at)
values
('n1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','new_message','New message from Saanvi','Can you do ₹3000 if I pick up tonight?','{"chatId": "c1111111-1111-1111-1111-111111111111"}',false, now()-interval '2 hours'),
('n2222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','offer_accepted','Offer accepted','Vikram accepted your Canon EOS listing.','{"chatId": "c2222222-2222-2222-2222-222222222222"}',true, now()-interval '6 hours'),
('n3333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555','price_drop','Saved item dropped in price','Marshall Emberton is now ₹7,999.','{"listingId": "aaaaaaa6-0000-0000-0000-000000000006"}',false, now()-interval '10 hours')
on conflict (id) do nothing;

-- If pg_cron is enabled in your Supabase project, schedule listing expiry:
-- select cron.schedule('expire-lokl-listings', '0 * * * *', $$select public.expire_old_listings();$$);

do $$
declare
  existing_job integer;
begin
  select jobid into existing_job from cron.job where jobname = 'otp-volume-anomaly' limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end $$;

select cron.schedule('otp-volume-anomaly', '*/15 * * * *', $$select public.check_otp_volume_anomaly();$$);
