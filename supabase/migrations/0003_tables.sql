-- 0003 — tables
--
-- BUILD-SPEC §4.2. Two ordering corrections against the spec listing, as
-- docs/03-TASKS.md T1.3 instructs: citext is created in 0001, and the
-- auctions -> lots spotlight foreign key is added after lots exists.
--
-- Row Level Security is enabled on every one of these tables in 0005, in the
-- same push. Nothing here is reachable without a policy.

-- ---------------------------------------------------------------------------
-- Organisation
-- ---------------------------------------------------------------------------

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- One row per auth user, created by the handle_new_user() trigger in 0004.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  department_id uuid references departments(id),
  role user_role not null default 'door_staff',
  full_name text,
  email text,
  created_at timestamptz not null default now()
);
create index if not exists profiles_department on profiles(department_id);

-- ---------------------------------------------------------------------------
-- Contacts and consent
-- ---------------------------------------------------------------------------

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id),
  first_name text not null,
  last_name text not null,
  email citext,
  phone_e164 text,                      -- +27…
  whatsapp_opt_in boolean not null default false,
  organisation text,
  title text,
  tags text[] not null default '{}',
  alumni_year int,
  donor_tier text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A department may hold many contacts without an email or a phone, so the
  -- uniqueness rules are partial: NULLs are distinct in a plain unique
  -- constraint, but being explicit documents the intent for the CSV importer.
  constraint contacts_phone_e164_format check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{6,14}$')
);
create unique index if not exists contacts_department_email_key
  on contacts(department_id, email) where email is not null;
create unique index if not exists contacts_department_phone_key
  on contacts(department_id, phone_e164) where phone_e164 is not null;
create index if not exists contacts_department on contacts(department_id);
create index if not exists contacts_tags on contacts using gin(tags);

create table if not exists consents (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  purpose text not null,                -- 'event_comms', 'whatsapp', 'auction_terms'
  channel delivery_channel,
  wording_version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  source text                           -- 'rsvp_form', 'import', 'walk_in', 'first_bid'
);
create index if not exists consents_contact on consents(contact_id);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id),
  title text not null,
  slug text not null unique,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue_name text,
  venue_address text,
  capacity int check (capacity is null or capacity > 0),
  rsvp_deadline timestamptz,
  allow_plus_ones boolean not null default false,
  status event_status not null default 'draft',
  banner_url text,
  branding jsonb not null default '{}'::jsonb,   -- accent colour, faculty, sponsor logos
  auction_enabled boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_department_status on events(department_id, status);
create index if not exists events_starts_at on events(starts_at);

create table if not exists event_questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  label text not null,
  type text not null check (type in ('text','select','multiselect','boolean')),
  options jsonb,
  required boolean not null default false,
  sort_order int not null default 0
);
create index if not exists event_questions_event on event_questions(event_id, sort_order);

-- ---------------------------------------------------------------------------
-- Invitations, RSVPs, attendees
-- ---------------------------------------------------------------------------

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  contact_id uuid not null references contacts(id),
  token text not null unique,           -- signed r. token, BUILD-SPEC §6
  status invitation_status not null default 'pending',
  sent_via delivery_channel[] not null default '{}',
  first_sent_at timestamptz,
  opened_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, contact_id)
);
create index if not exists invitations_event_status on invitations(event_id, status);

create table if not exists rsvps (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references invitations(id) on delete cascade,
  attending boolean not null,
  guest_count int not null default 1 check (guest_count >= 1),
  answers jsonb not null default '{}'::jsonb,
  whatsapp_opt_in boolean not null default false,
  responded_at timestamptz not null default now()
);

create table if not exists attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  contact_id uuid references contacts(id),
  invitation_id uuid references invitations(id),
  display_name text not null,           -- denormalised for plus-ones and walk-ins
  is_plus_one boolean not null default false,
  is_walk_in boolean not null default false,
  pass_token text not null unique,      -- signed p. token, BUILD-SPEC §6
  bidder_number int,
  checked_in_at timestamptz,
  checked_in_by uuid references profiles(id),
  checked_out_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, bidder_number)
);
create index if not exists attendees_event_checked_in on attendees(event_id) where checked_in_at is not null;
create index if not exists attendees_event on attendees(event_id);
create index if not exists attendees_invitation on attendees(invitation_id);

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------

create table if not exists message_deliveries (
  id uuid primary key default gen_random_uuid(),
  kind message_kind not null,
  event_id uuid references events(id) on delete cascade,
  contact_id uuid references contacts(id),
  attendee_id uuid references attendees(id) on delete cascade,
  broadcast_id uuid,                    -- fk added below, after broadcasts exists
  channel delivery_channel not null,
  recipient text not null,              -- email address or phone as sent
  provider text,                        -- 'resend','brevo','meta'
  provider_message_id text,
  status delivery_status not null default 'queued',
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists message_deliveries_provider_id on message_deliveries(provider_message_id);
create index if not exists message_deliveries_event on message_deliveries(event_id);
-- The pass page feed reads by attendee + channel; see BUILD-SPEC §7.3.
create index if not exists message_deliveries_attendee_channel
  on message_deliveries(attendee_id, channel);

create table if not exists broadcasts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  author_id uuid references profiles(id),
  body text not null,
  audience jsonb not null default '{"segment":"checked_in"}'::jsonb,
  channels delivery_channel[] not null default '{in_app}',
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists broadcasts_event on broadcasts(event_id, created_at desc);

do $$ begin
  alter table message_deliveries
    add constraint message_deliveries_broadcast_fk
    foreign key (broadcast_id) references broadcasts(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Auction
-- ---------------------------------------------------------------------------

create table if not exists auctions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references events(id) on delete cascade,
  mode auction_mode not null default 'silent',
  title text not null default 'Silent Auction',
  opens_at timestamptz,
  closes_at timestamptz,
  soft_close_seconds int not null default 120 check (soft_close_seconds >= 0),
  increment_table jsonb not null default
    '[{"upTo":1000,"step":100},{"upTo":5000,"step":250},{"upTo":null,"step":500}]'::jsonb,
  terms_version text not null default 'v1',
  display_key text not null default encode(gen_random_bytes(16),'hex'),
  display_mode text not null default 'grid' check (display_mode in ('grid','spotlight','total')),
  spotlight_lot_id uuid,                -- fk added below, after lots exists
  created_at timestamptz not null default now()
);

create table if not exists lots (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references auctions(id) on delete cascade,
  lot_number int not null,
  title text not null,
  description text,
  images text[] not null default '{}',
  donor_name text,
  starting_bid numeric(12,2) not null check (starting_bid >= 0),
  reserve numeric(12,2),
  buy_now_price numeric(12,2),
  status lot_status not null default 'upcoming',
  opens_at timestamptz,
  closes_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (auction_id, lot_number)
);
create index if not exists lots_auction_sort on lots(auction_id, sort_order, lot_number);
-- close_due_lots() scans for open lots past their close time every 30 seconds.
create index if not exists lots_due on lots(closes_at) where status = 'open';

do $$ begin
  alter table auctions add constraint auctions_spotlight_fk
    foreign key (spotlight_lot_id) references lots(id) on delete set null;
exception when duplicate_object then null; end $$;

-- Append-only ledger. A bid is never updated; it is voided.
create table if not exists bids (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references lots(id) on delete cascade,
  attendee_id uuid not null references attendees(id),
  amount numeric(12,2) not null check (amount > 0),
  placed_at timestamptz not null default now(),
  is_proxy boolean not null default false,
  placed_by_user_id uuid references profiles(id),
  voided_at timestamptz,
  void_reason text
);
create index if not exists bids_lot_amount on bids(lot_id, amount desc) where voided_at is null;
create index if not exists bids_attendee on bids(attendee_id);

create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null unique references lots(id) on delete cascade,
  attendee_id uuid not null references attendees(id),
  amount numeric(12,2) not null,
  status settlement_status not null default 'pending',
  payment_provider text,
  provider_ref text,
  checkout_url text,
  paid_at timestamptz,
  invoice_url text,
  created_at timestamptz not null default now()
);
create index if not exists settlements_attendee on settlements(attendee_id);

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

create table if not exists audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,                 -- 'bidder.identity_viewed', 'bid.voided', 'contacts.exported'
  entity text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists audit_log_at on audit_log(at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['contacts','events','message_deliveries'] loop
    execute format('drop trigger if exists %I_set_updated_at on %I', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on %I
         for each row execute function set_updated_at()', t, t);
  end loop;
end $$;
