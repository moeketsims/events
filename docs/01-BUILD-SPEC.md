# 01 — Build Specification

This is the technical contract for the CUT Events Platform. It is written so an implementing engineer or agent can build the proof of concept without further product decisions. Where a choice is left open, the default is stated and the reason to deviate is given.

Read [PLAN.md](../PLAN.md) first for the why. This document is the what and the how.

---

## 1. Repository layout

```
events/
├── CLAUDE.md                     # instructions for the implementing agent
├── PLAN.md                       # strategy and roadmap
├── docs/
│   ├── 01-BUILD-SPEC.md          # this file
│   ├── 02-DESIGN-SYSTEM.md       # brand, tokens, surface layouts
│   ├── 03-TASKS.md               # week-by-week tasks with acceptance criteria
│   └── 04-DEMO-SCRIPT.md         # the 15-minute demo and pre-demo checklist
├── app/                          # Next.js App Router
│   ├── (staff)/                  # authenticated staff surfaces
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── contacts/
│   │   ├── events/
│   │   │   ├── new/
│   │   │   └── [eventId]/
│   │   │       ├── page.tsx              # overview
│   │   │       ├── guests/
│   │   │       ├── invitations/
│   │   │       ├── attendance/
│   │   │       ├── broadcasts/
│   │   │       ├── auction/              # lot editor
│   │   │       ├── auction/console/      # operator console
│   │   │       └── results/
│   │   └── settings/
│   ├── scan/                     # door-staff scanner PWA
│   │   └── [eventId]/
│   ├── rsvp/[token]/             # public, token-authenticated
│   ├── p/[token]/                # attendee pass page and sub-pages
│   │   ├── page.tsx
│   │   ├── auction/
│   │   │   └── [lotId]/
│   │   └── bids/
│   ├── display/[auctionId]/      # projection view, display-key authenticated
│   ├── api/
│   │   ├── checkin/route.ts
│   │   ├── bid/route.ts
│   │   ├── webhooks/
│   │   │   ├── resend/route.ts
│   │   │   ├── whatsapp/route.ts
│   │   │   └── yoco/route.ts
│   │   └── cron/keepalive/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                       # shadcn/ui generated components
│   ├── brand/                    # Logo, Wordmark, BrandFrame
│   ├── staff/                    # console-specific composites
│   ├── attendee/                 # pass, lot card, bid button
│   ├── scanner/                  # camera view, result card
│   └── display/                  # projection board components
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # browser client (publishable key)
│   │   ├── server.ts             # server client with cookies (@supabase/ssr)
│   │   └── admin.ts              # service-role client, server only
│   ├── auth/
│   │   ├── staff.ts              # requireStaff(role[]) helper
│   │   └── pass.ts               # sign/verify pass and RSVP tokens
│   ├── messaging/
│   │   ├── index.ts              # send(kind, recipient, channel, payload)
│   │   ├── email.resend.ts
│   │   ├── email.brevo.ts        # fallback provider
│   │   ├── whatsapp.meta.ts
│   │   └── templates/            # subject/body builders per message kind
│   ├── payments/yoco.ts
│   ├── qr.ts                     # QR PNG/SVG generation
│   ├── money.ts                  # ZAR formatting, increment maths
│   ├── realtime.ts               # channel names and payload types
│   └── db/types.ts               # generated Supabase types
├── supabase/
│   ├── config.toml
│   ├── migrations/               # versioned SQL, applied by CI
│   │   ├── 0001_extensions.sql
│   │   ├── 0002_types.sql
│   │   ├── 0003_tables.sql
│   │   ├── 0004_functions.sql
│   │   ├── 0005_rls.sql
│   │   ├── 0006_realtime.sql
│   │   └── 0007_cron.sql
│   └── seed/
│       ├── seed.ts               # demo data, run with `pnpm seed`
│       └── lots/                 # lot images
├── public/
│   ├── brand/                    # fetched CUT logo files (see design system)
│   ├── manifest.webmanifest      # scanner PWA manifest
│   └── icons/
├── scripts/
│   ├── fetch-brand-assets.ps1
│   ├── fetch-brand-assets.sh
│   └── bid-storm.ts              # concurrency test for place_bid
├── tests/
│   ├── unit/                     # vitest
│   └── e2e/                      # playwright smoke (optional in POC)
├── .github/workflows/
│   ├── ci.yml                    # lint, typecheck, unit tests, migration dry-run
│   ├── migrate.yml               # supabase db push on main
│   └── keepalive.yml             # weekly ping so the free project never pauses
├── .env.example
├── .gitignore
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 2. Tooling and versions

| Tool | Version / choice | Notes |
|---|---|---|
| Node | 22 or 24 (the build machine has 24.18) | |
| Package manager | pnpm 10+ (build machine has 11.4) | |
| Script runner | `tsx` | For `seed.ts`, `bid-storm.ts`, `smoke-providers.ts` |
| Next.js | 15.x, App Router, TypeScript strict | Server Actions for mutations from staff UI; Route Handlers for webhooks and scanner/bid endpoints. |
| React | 19 | |
| Tailwind CSS | 4.x | Theme tokens defined in `globals.css` via `@theme`. |
| shadcn/ui | latest | Radix-based; init with the CUT palette from the design system. |
| Supabase JS | `@supabase/supabase-js` 2.x, `@supabase/ssr` | Use the new `sb_publishable_…` and `sb_secret_…` key formats. |
| Supabase CLI | latest | `supabase link`, `supabase db push`, `supabase gen types`. Local Docker stack is optional; the default workflow pushes to the dev project. |
| QR | `qrcode` (generate), `html5-qrcode` (scan) | |
| Validation | `zod` | Every Server Action and Route Handler validates input. |
| Testing | `vitest`, `@playwright/test` | |
| Lint/format | ESLint (next config), Prettier | |
| Icons | `lucide-react` | |
| Fonts | `next/font/google` Barlow Condensed (headings) + Source Sans 3 (body) | Substitutes for CUT's Univers Condensed and Myriad Pro, see design system §3. |

---

## 3. Environment variables

`.env.local` for development, Vercel project settings for deployments. Never commit real values. The user's global `~/.claude/CLAUDE.md` holds the Supabase project reference and publishable key for the dev project.

| Variable | Scope | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` | server | `sb_secret_…` service role. Used only in `lib/supabase/admin.ts`. |
| `SUPABASE_DB_URL` | CI only | For `supabase db push`. |
| `NEXT_PUBLIC_APP_URL` | public | Canonical origin, e.g. `https://cut-events.vercel.app`. Used in QR URLs and emails. |
| `PASS_SIGNING_SECRET` | server | 32+ random bytes, base64. Signs pass and RSVP tokens. Rotating it invalidates all issued passes. |
| `EMAIL_PROVIDER` | server | `resend` or `brevo`. |
| `RESEND_API_KEY` | server | |
| `RESEND_WEBHOOK_SECRET` | server | Svix signing secret for delivery events. |
| `BREVO_API_KEY` | server | Fallback provider. |
| `EMAIL_FROM` | server | `CUT Events <events@yourdomain>`; must be on a verified domain. |
| `WHATSAPP_PHONE_NUMBER_ID` | server | From Meta for Developers app. |
| `WHATSAPP_ACCESS_TOKEN` | server | Temporary 24h token in POC; system-user permanent token at production. |
| `WHATSAPP_VERIFY_TOKEN` | server | Arbitrary string for webhook verification handshake. |
| `WHATSAPP_APP_SECRET` | server | Validates `X-Hub-Signature-256` on inbound webhooks. |
| `YOCO_SECRET_KEY` | server | `sk_test_…` in POC. |
| `YOCO_WEBHOOK_SECRET` | server | |
| `CRON_SECRET` | server | Bearer token required by `/api/cron/*`. |
| `SENTRY_DSN` | public | Optional in POC. |

`.env.example` lists all of these with empty values and a comment each.

---

## 4. Database

All schema lives in `supabase/migrations`. Never edit the schema in the Supabase dashboard. Generated TypeScript types go to `lib/db/types.ts` via `pnpm db:types`.

### 4.1 Extensions and types (`0001`, `0002`)

```sql
create extension if not exists pgcrypto;
create extension if not exists pg_cron;

create type user_role as enum ('platform_admin','organiser','door_staff','auction_operator','finance');
create type event_status as enum ('draft','published','live','closed','archived');
create type invitation_status as enum ('pending','accepted','declined','waitlisted','cancelled');
create type delivery_channel as enum ('email','whatsapp','sms','in_app');
create type delivery_status as enum ('queued','sent','delivered','read','failed','bounced');
create type message_kind as enum ('invite','reminder','pass','broadcast','outbid','winner','receipt');
create type auction_mode as enum ('silent','live');
create type lot_status as enum ('upcoming','open','closed','unsold','withdrawn');
create type settlement_status as enum ('pending','paid','overdue','waived');
```

### 4.2 Tables (`0003`)

```sql
create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- one row per auth user; created by trigger on auth.users insert
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  department_id uuid references departments(id),
  role user_role not null default 'door_staff',
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create table contacts (
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
  unique (department_id, email),
  unique (department_id, phone_e164)
);
create extension if not exists citext;   -- put before contacts in the actual migration

create table consents (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  purpose text not null,                -- 'event_comms', 'whatsapp', 'marketing'
  channel delivery_channel,
  wording_version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  source text                           -- 'rsvp_form', 'import', 'walk_in'
);

create table events (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id),
  title text not null,
  slug text not null unique,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue_name text,
  venue_address text,
  capacity int,
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

create table event_questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  label text not null,
  type text not null check (type in ('text','select','multiselect','boolean')),
  options jsonb,
  required boolean not null default false,
  sort_order int not null default 0
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  contact_id uuid not null references contacts(id),
  token text not null unique,           -- signed, see §6
  status invitation_status not null default 'pending',
  sent_via delivery_channel[] not null default '{}',
  first_sent_at timestamptz,
  opened_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, contact_id)
);

create table rsvps (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references invitations(id) on delete cascade,
  attending boolean not null,
  guest_count int not null default 1 check (guest_count >= 1),
  answers jsonb not null default '{}'::jsonb,
  whatsapp_opt_in boolean not null default false,
  responded_at timestamptz not null default now()
);

create table attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  contact_id uuid references contacts(id),
  invitation_id uuid references invitations(id),
  display_name text not null,           -- denormalised for plus-ones and walk-ins
  is_plus_one boolean not null default false,
  is_walk_in boolean not null default false,
  pass_token text not null unique,      -- signed, see §6
  bidder_number int,
  checked_in_at timestamptz,
  checked_in_by uuid references profiles(id),
  checked_out_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, bidder_number)
);
create index attendees_event_checked_in on attendees(event_id) where checked_in_at is not null;

create table message_deliveries (
  id uuid primary key default gen_random_uuid(),
  kind message_kind not null,
  event_id uuid references events(id) on delete cascade,
  contact_id uuid references contacts(id),
  attendee_id uuid references attendees(id),
  broadcast_id uuid,                    -- fk added after broadcasts
  channel delivery_channel not null,
  recipient text not null,              -- email or phone as sent
  provider text,                        -- 'resend','brevo','meta'
  provider_message_id text,
  status delivery_status not null default 'queued',
  error text,
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);
create index message_deliveries_provider_id on message_deliveries(provider_message_id);

create table broadcasts (
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
alter table message_deliveries
  add constraint message_deliveries_broadcast_fk
  foreign key (broadcast_id) references broadcasts(id) on delete set null;

create table auctions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references events(id) on delete cascade,
  mode auction_mode not null default 'silent',
  title text not null default 'Silent Auction',
  opens_at timestamptz,
  closes_at timestamptz,
  soft_close_seconds int not null default 120,
  increment_table jsonb not null default
    '[{"upTo":1000,"step":100},{"upTo":5000,"step":250},{"upTo":null,"step":500}]'::jsonb,
  terms_version text not null default 'v1',
  display_key text not null default encode(gen_random_bytes(16),'hex'),
  display_mode text not null default 'grid' check (display_mode in ('grid','spotlight','total')),
  spotlight_lot_id uuid,                -- fk to lots added after lots is created
  created_at timestamptz not null default now()
);

create table lots (
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
alter table auctions add constraint auctions_spotlight_fk
  foreign key (spotlight_lot_id) references lots(id) on delete set null;

-- append-only ledger; never update amount, only void
create table bids (
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
create index bids_lot_amount on bids(lot_id, amount desc) where voided_at is null;

create table settlements (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null unique references lots(id),
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

create table audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,                 -- 'bidder.identity_viewed', 'bid.voided', 'contacts.exported'
  entity text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
```

### 4.3 Views

```sql
-- current high bid per lot, anonymised
create view lot_state as
select
  l.id as lot_id,
  l.auction_id,
  l.lot_number,
  l.title,
  l.status,
  l.closes_at,
  l.starting_bid,
  b.amount as high_bid,
  a.bidder_number as high_bidder_number,
  (select count(*) from bids x where x.lot_id = l.id and x.voided_at is null) as bid_count
from lots l
left join lateral (
  select amount, attendee_id from bids
  where lot_id = l.id and voided_at is null
  order by amount desc, placed_at asc limit 1
) b on true
left join attendees a on a.id = b.attendee_id;

-- totals for the projection footer
create view auction_totals as
select auction_id, coalesce(sum(high_bid),0) as total_raised, count(*) filter (where high_bid is not null) as lots_with_bids
from lot_state group by auction_id;
```

### 4.4 Functions (`0004`)

Helpers used by RLS:

```sql
create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function auth_department() returns uuid
language sql stable security definer set search_path = public as $$
  select department_id from profiles where id = auth.uid()
$$;

create or replace function is_platform_admin() returns boolean
language sql stable as $$ select auth_role() = 'platform_admin' $$;
```

Profile auto-create:

```sql
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();
```

Increment maths, shared by server and client (mirror in `lib/money.ts` and unit-test both agree):

```sql
create or replace function bid_step(p_table jsonb, p_current numeric) returns numeric
language plpgsql immutable as $$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(p_table) loop
    if (r->>'upTo') is null or p_current < (r->>'upTo')::numeric then
      return (r->>'step')::numeric;
    end if;
  end loop;
  return 100;
end $$;

create or replace function next_min_bid(p_lot_id uuid) returns numeric
language sql stable as $$
  select case when ls.high_bid is null then ls.starting_bid
              else ls.high_bid + bid_step(a.increment_table, ls.high_bid) end
  from lot_state ls join auctions a on a.id = ls.auction_id
  where ls.lot_id = p_lot_id
$$;
```

**Check-in** (called from `/api/checkin` after the server has verified the pass token signature):

```sql
create or replace function check_in_attendee(p_attendee_id uuid, p_staff_id uuid)
returns table (result text, display_name text, bidder_number int, checked_in_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_att attendees%rowtype;
  v_event events%rowtype;
  v_next int;
begin
  select * into v_att from attendees where id = p_attendee_id for update;
  if not found then
    return query select 'invalid', null::text, null::int, null::timestamptz; return;
  end if;
  select * into v_event from events where id = v_att.event_id;

  if v_att.checked_in_at is not null then
    return query select 'already_checked_in', v_att.display_name, v_att.bidder_number, v_att.checked_in_at; return;
  end if;

  if v_event.auction_enabled and v_att.bidder_number is null then
    -- serialise per event so numbers are unique and sequential
    perform pg_advisory_xact_lock(hashtext(v_att.event_id::text));
    select coalesce(max(bidder_number), 0) + 1 into v_next from attendees where event_id = v_att.event_id;
    v_att.bidder_number := v_next;
  end if;

  update attendees
     set checked_in_at = now(), checked_in_by = p_staff_id, bidder_number = v_att.bidder_number
   where id = p_attendee_id
   returning * into v_att;

  perform realtime.send(
    jsonb_build_object('event_id', v_att.event_id, 'checked_in_count',
      (select count(*) from attendees where event_id = v_att.event_id and checked_in_at is not null)),
    'checkin', 'event:' || v_att.event_id, false);

  return query select 'checked_in', v_att.display_name, v_att.bidder_number, v_att.checked_in_at;
end $$;
```

**Place bid**, the single path for every bid. Locks the lot row so concurrent bids serialise:

```sql
create or replace function place_bid(p_lot_id uuid, p_attendee_id uuid, p_amount numeric,
                                     p_is_proxy boolean default false, p_staff_id uuid default null)
returns table (result text, bid_id uuid, high_bid numeric, next_min numeric, closes_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_lot lots%rowtype;
  v_auction auctions%rowtype;
  v_att attendees%rowtype;
  v_min numeric;
  v_bid_id uuid;
  v_prev_attendee uuid;
  v_now timestamptz := now();
begin
  select * into v_lot from lots where id = p_lot_id for update;
  if not found then return query select 'lot_not_found', null::uuid, null::numeric, null::numeric, null::timestamptz; return; end if;
  select * into v_auction from auctions where id = v_lot.auction_id;
  select * into v_att from attendees where id = p_attendee_id;

  if v_att.id is null or v_att.event_id <> v_auction.event_id then
    return query select 'not_an_attendee', null::uuid, null::numeric, null::numeric, null::timestamptz; return; end if;
  if v_att.checked_in_at is null then
    return query select 'not_checked_in', null::uuid, null::numeric, null::numeric, null::timestamptz; return; end if;
  if v_lot.status <> 'open' or (v_lot.closes_at is not null and v_now >= v_lot.closes_at) then
    return query select 'lot_closed', null::uuid, null::numeric, null::numeric, v_lot.closes_at; return; end if;

  v_min := next_min_bid(p_lot_id);
  if p_amount < v_min then
    return query select 'too_low', null::uuid, (select high_bid from lot_state where lot_id = p_lot_id), v_min, v_lot.closes_at; return; end if;

  select attendee_id into v_prev_attendee from bids
   where lot_id = p_lot_id and voided_at is null order by amount desc, placed_at asc limit 1;

  insert into bids (lot_id, attendee_id, amount, is_proxy, placed_by_user_id)
  values (p_lot_id, p_attendee_id, p_amount, p_is_proxy, p_staff_id) returning id into v_bid_id;

  -- soft close: extend if inside the window
  if v_lot.closes_at is not null and v_lot.closes_at - v_now < make_interval(secs => v_auction.soft_close_seconds) then
    update lots set closes_at = v_now + make_interval(secs => v_auction.soft_close_seconds)
     where id = p_lot_id returning * into v_lot;
  end if;

  perform realtime.send(
    jsonb_build_object('lot_id', p_lot_id, 'lot_number', v_lot.lot_number, 'amount', p_amount,
                       'bidder_number', v_att.bidder_number, 'closes_at', v_lot.closes_at,
                       'next_min', p_amount + bid_step(v_auction.increment_table, p_amount)),
    'bid_placed', 'auction:' || v_auction.id, false);

  if v_prev_attendee is not null and v_prev_attendee <> p_attendee_id then
    perform realtime.send(
      jsonb_build_object('lot_id', p_lot_id, 'lot_number', v_lot.lot_number, 'amount', p_amount),
      'outbid', 'attendee:' || v_prev_attendee, false);
  end if;

  return query select 'ok', v_bid_id, p_amount, p_amount + bid_step(v_auction.increment_table, p_amount), v_lot.closes_at;
end $$;
```

**Lot lifecycle** (operator actions and timed close):

```sql
create or replace function set_lot_status(p_lot_id uuid, p_status lot_status, p_closes_at timestamptz default null)
returns lots language plpgsql security definer set search_path = public as $$
declare v lots%rowtype;
begin
  update lots set status = p_status, closes_at = coalesce(p_closes_at, closes_at),
         opens_at = case when p_status = 'open' and opens_at is null then now() else opens_at end
   where id = p_lot_id returning * into v;
  perform realtime.send(jsonb_build_object('lot_id', v.id, 'status', v.status, 'closes_at', v.closes_at),
                        'lot_status', 'auction:' || v.auction_id, false);
  return v;
end $$;

-- called by pg_cron every 30 seconds; finalises lots whose time has passed
create or replace function close_due_lots() returns int
language plpgsql security definer set search_path = public as $$
declare v_count int := 0; r record;
begin
  for r in select l.id, ls.high_bid, ls.high_bidder_number, l.reserve, l.auction_id
             from lots l join lot_state ls on ls.lot_id = l.id
            where l.status = 'open' and l.closes_at is not null and l.closes_at <= now()
            for update of l skip locked loop
    if r.high_bid is null or (r.reserve is not null and r.high_bid < r.reserve) then
      perform set_lot_status(r.id, 'unsold');
    else
      perform set_lot_status(r.id, 'closed');
      insert into settlements (lot_id, attendee_id, amount)
      select r.id, b.attendee_id, b.amount from bids b
       where b.lot_id = r.id and b.voided_at is null order by b.amount desc, b.placed_at asc limit 1
      on conflict (lot_id) do nothing;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
```

`void_bid(p_bid_id, p_reason, p_staff_id)` sets `voided_at`, writes an audit row, and re-broadcasts the lot's new state on `auction:{id}` as event `bid_voided`. Operator only.

### 4.5 Row Level Security (`0005`)

RLS is enabled on every table. Attendee-facing reads never hit tables directly; they go through server routes using the pass token (§6) and the admin client, which return only the fields listed in §7. The browser uses the publishable key only for realtime subscriptions and for staff sessions.

| Table | platform_admin | organiser (own dept) | door_staff (own dept) | auction_operator (own dept) | finance (own dept) | anon / attendee browser |
|---|---|---|---|---|---|---|
| departments | all | read own | read own | read own | read own | none |
| profiles | all | read own dept | read self | read own dept | read self | none |
| contacts | all | all own dept | read `display_name`-level via function only | read | read | none |
| consents | all | read/insert own dept | insert (walk-in) | none | none | none |
| events | all | all own dept | read own dept | read own dept | read own dept | none (public page data via server) |
| event_questions | all | all own dept | read | none | none | none |
| invitations | all | all own dept | read | none | none | none |
| rsvps | all | read own dept | read | none | none | none |
| attendees | all | all own dept | read/update `checked_in_*` via `check_in_attendee` | read | read | none |
| message_deliveries | all | read/insert own dept | none | none | none | none |
| broadcasts | all | all own dept | none | none | none | none |
| auctions | all | all own dept | none | all own dept | read | none |
| lots | all | all own dept | none | all own dept | read | none |
| bids | all | read own dept | none | read own dept, void via function | read | none |
| settlements | all | read own dept | none | read | all own dept | none |
| audit_log | read | none | none | none | none | none (insert via functions) |
| views `lot_state`, `auction_totals` | read | read | none | read | read | none (served by display/pass routes) |

Representative policy shape, used for every "own dept" rule:

```sql
alter table events enable row level security;
create policy events_admin_all on events for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());
create policy events_dept_select on events for select to authenticated
  using (department_id = auth_department());
create policy events_dept_write on events for insert to authenticated
  with check (department_id = auth_department() and auth_role() in ('organiser'));
create policy events_dept_update on events for update to authenticated
  using (department_id = auth_department() and auth_role() in ('organiser'));
```

In the POC the organiser role also acts as auction operator. Keep the enum value; grant organiser the operator rights in policies with `auth_role() in ('organiser','auction_operator')`.

### 4.6 Realtime (`0006`)

Realtime uses **database broadcast** (`realtime.send`) on public channels. Payloads are anonymised, so no channel authorisation is needed in the POC. Nothing sensitive is ever put in a payload; clients refetch details through authenticated routes when a payload tells them something changed.

| Topic | Events | Payload | Subscribers |
|---|---|---|---|
| `event:{eventId}` | `checkin` | `{event_id, checked_in_count}` | attendance dashboard |
| `event:{eventId}` | `broadcast` | `{broadcast_id}` | pass pages (refetch body via `/p/[token]` server) |
| `auction:{auctionId}` | `bid_placed` | `{lot_id, lot_number, amount, bidder_number, closes_at, next_min}` | projection, bidding pages, operator console |
| `auction:{auctionId}` | `lot_status` | `{lot_id, status, closes_at}` | same |
| `auction:{auctionId}` | `bid_voided` | `{lot_id, high_bid, high_bidder_number, next_min}` | same |
| `attendee:{attendeeId}` | `outbid` | `{lot_id, lot_number, amount}` | that attendee's pass page |

`lib/realtime.ts` exports the topic builders and TypeScript types for each payload. Client subscription:

```ts
supabase.channel(`auction:${auctionId}`)
  .on('broadcast', { event: 'bid_placed' }, ({ payload }) => apply(payload as BidPlaced))
  .on('broadcast', { event: 'lot_status' }, ...)
  .subscribe();
```

Broadcast of an organiser message is triggered by an `after insert` trigger on `broadcasts` when `sent_at` is set (or directly from the Server Action after inserting deliveries).

`set_display_mode(p_auction_id, p_mode, p_lot_id)` updates the two columns and sends event `display_mode` `{mode, lot_id}` on `auction:{id}`.

**Fallback if `realtime.send` is unavailable on the project:** keep the functions identical but replace each `perform realtime.send(...)` with a no-op, and have the projection, bidding pages and attendance dashboard poll `GET /api/auction/[id]/state` (returns `lot_state` rows + totals) and `GET /api/event/[id]/counts` every 2 seconds. The realtime path is preferred; the polling path must exist behind an env flag `NEXT_PUBLIC_REALTIME_MODE=broadcast|poll` so the demo cannot be blocked by a realtime setting. Also confirm in the Supabase dashboard (Realtime settings) that public channels are allowed for the project.

### 4.7 Cron (`0007`)

```sql
select cron.schedule('close-due-lots', '30 seconds', $$select close_due_lots()$$);
```

Lot `closes_at` is authoritative: `place_bid` rejects late bids on its own, so clients render countdowns from `closes_at` and the cron only finalises status and settlements. If the free tier's `pg_cron` refuses sub-minute schedules, use `* * * * *` (every minute); the user-visible behaviour is unchanged.

### 4.8 Storage (`0008`)

```sql
insert into storage.buckets (id, name, public) values
  ('lot-images','lot-images', true),
  ('passes','passes', true),
  ('event-banners','event-banners', true)
on conflict (id) do nothing;

create policy "public read lot-images" on storage.objects for select to public using (bucket_id = 'lot-images');
create policy "public read passes" on storage.objects for select to public using (bucket_id = 'passes');
create policy "public read event-banners" on storage.objects for select to public using (bucket_id = 'event-banners');
-- no insert/update/delete policies: writes happen only through the service-role client
```

### 4.9 Supabase Auth configuration (dashboard, one-time, documented in README)

- **Custom SMTP is required.** Supabase's built-in auth mailer is limited to a handful of emails per hour on the free tier, which will break OTP login during a demo. Configure Auth → SMTP with the Resend SMTP credentials (`smtp.resend.com`, port 465, user `resend`, password = API key) and the verified `EMAIL_FROM` address. If Brevo is used, use Brevo's SMTP relay instead.
- Email template "Magic Link" must include `{{ .Token }}` so the 6-digit code is delivered; keep `{{ .ConfirmationURL }}` as well so the link also works.
- Site URL = `NEXT_PUBLIC_APP_URL`; add `http://localhost:3000/**` and the Vercel preview pattern to Redirect URLs.
- Disable "Enable email signups" for the public. Staff accounts are created only by the seed or by a platform admin via the Auth admin API in `/settings`.
- The seed prints admin-generated magic links (`auth.admin.generateLink`) for each demo user as a fallback if SMTP is not yet configured.

---

## 5. Authentication model

| Actor | Mechanism | Session |
|---|---|---|
| Staff | Supabase Auth email OTP (6-digit code) via `@supabase/ssr` cookies. Profiles carry `role` and `department_id`. | Standard Supabase session; `requireStaff(['organiser'])` in server components and actions redirects or 403s. |
| Door staff | Same as staff, role `door_staff`. | Same. |
| Attendee | **No account.** Identity is the signed pass token in the URL `/p/{token}`. The layout sets an `httpOnly`, `SameSite=Lax` cookie `cut_pass={token}` so sub-pages and the bid endpoint can read it without the token leaking into analytics referrers. | Cookie lifetime: event end + 30 days. |
| Invitee | Signed RSVP token in `/rsvp/{token}`. | None; each request re-verifies. |
| Projection | `/display/{auctionId}?k={display_key}`; the route compares `k` with `auctions.display_key` using the admin client. | Cookie `cut_display` for 24h so a reload does not need the key. |

Staff users are created for the POC by the seed script (three users: organiser, door staff, platform admin). Supabase Auth "Confirm email" stays on; the seed uses the admin API with `email_confirm: true`.

---

## 6. Token formats

Both tokens are HMAC-signed, URL-safe, and short enough for a QR code at medium error correction.

```
pass token   :  p.<id22>.<sig22>
rsvp token   :  r.<id22>.<sig22>
  id22  = base64url(uuid bytes)                          (22 chars)
  sig22 = base64url(HMAC-SHA256(secret, prefix + "." + id22))[0:22]
```

`lib/auth/pass.ts`:

```ts
export function signToken(kind: 'p' | 'r', id: string): string
export function verifyToken(token: string): { kind: 'p' | 'r'; id: string } | null   // constant-time compare
```

Tokens are also stored in `attendees.pass_token` and `invitations.token` so a database lookup is possible without recomputing, and so a token can be revoked by regenerating it. The QR code encodes the full URL `${NEXT_PUBLIC_APP_URL}/p/${token}`; the scanner accepts either the full URL or a bare token.

Unit tests: round trip, tampered signature rejected, wrong kind rejected, stable output for fixed secret.

---

## 7. Routes and contracts

### 7.1 Staff surfaces (Server Components + Server Actions)

| Route | Purpose | Key actions |
|---|---|---|
| `/login` | Email OTP | `requestOtp(email)`, `verifyOtp(email, code)` |
| `/dashboard` | Upcoming events, counts | |
| `/contacts` | Table, search, CSV import | `importContacts(csvText)` → upsert by email/phone within department; returns `{inserted, updated, skipped, errors[]}` |
| `/events` | List by status | |
| `/events/new` | Create | `createEvent(form)` |
| `/events/[id]` | Overview: funnel numbers, quick links | |
| `/events/[id]/guests` | Guest list builder: filter contacts, add to event as invitations | `addInvitees(eventId, contactIds[])` creates `invitations` with signed tokens |
| `/events/[id]/invitations` | Compose and send | `sendInvitations(eventId, invitationIds[], channels[])` → creates `message_deliveries`, calls messaging layer, updates statuses |
| `/events/[id]/attendance` | Live register, export | `exportAttendance(eventId)` → CSV; subscribes to `event:{id}` |
| `/events/[id]/broadcasts` | Compose, target, send, log | `sendBroadcast(eventId, body, audience, channels[])` |
| `/events/[id]/auction` | Auction settings, lot CRUD, image upload to Storage bucket `lot-images` | `upsertAuction`, `upsertLot`, `deleteLot`, `reorderLots` |
| `/events/[id]/auction/console` | Operator: open/close/extend/withdraw, void bid, identity lookup, proxy bid | `setLotStatus`, `voidBid`, `revealBidder(attendeeId)` (writes audit row), `proxyBid(lotId, attendeeId, amount)` |
| `/events/[id]/results` | Lot results, winners with names, settlement status, CSV | |
| `/settings` | Department, users and roles, integrations status | |

### 7.2 Scanner PWA

| Route | Behaviour |
|---|---|
| `/scan` | Requires `door_staff` or above. Lists events of the department that are `published` or `live` today ±1 day. |
| `/scan/[eventId]` | Full-screen camera via `html5-qrcode`. On decode: POST `/api/checkin`. Shows result card for 2.5 s then resumes scanning. Tabs: Scan · Search · Walk-in · Count. |

`POST /api/checkin` (staff session required)

```json
// request
{ "eventId": "uuid", "token": "p.xxx.yyy" }          // or { "eventId": "uuid", "attendeeId": "uuid" } for manual
// response 200
{ "result": "checked_in" | "already_checked_in" | "invalid" | "wrong_event",
  "displayName": "Thabo M.", "bidderNumber": 42, "checkedInAt": "2026-10-30T16:12:00Z" }
```

`POST /api/walkin` (staff): `{eventId, firstName, lastName, email?, phone?, whatsappOptIn}` → creates contact (or matches existing), attendee with `is_walk_in`, consent row, then checks in. Returns the same shape as check-in plus `passUrl`.

### 7.3 Attendee surfaces (token-authenticated, rendered server-side with the admin client)

| Route | Content |
|---|---|
| `/rsvp/[token]` | Event details, attending yes/no, guest count (if allowed), custom questions, WhatsApp opt-in checkbox with consent wording. Submit → `rsvps` upsert, `invitations.status`, create `attendees` rows (one per guest) with pass tokens, send pass message. Shows the pass link on success. |
| `/p/[token]` | Pass: QR (SVG), name, event, venue, time, "Add to calendar" (.ics link), bidder number once checked in, live broadcast feed (subscribes to `event:{id}` and refetches `/p/[token]/feed`), link to auction if enabled. Before check-in the auction link shows "Bidding opens once you have checked in at the door." |
| `/p/[token]/feed` (GET, JSON) | The attendee's broadcasts: `broadcasts` joined to `message_deliveries` where `attendee_id` = this attendee and `channel = 'in_app'`, newest first, limit 50. Audience membership is therefore decided once, at send time, by which attendees received an `in_app` delivery row. |
| `/p/[token]/auction` | Lot grid: image, title, current bid, next minimum, time left, "You are leading" / "Outbid" badges. Subscribes to `auction:{id}` and `attendee:{id}`. |
| `/p/[token]/auction/[lotId]` | Lot detail, bid button with proposed amount, custom amount input, T&Cs acceptance on first bid (stored in `attendees`-linked `consents` with purpose `auction_terms`). |
| `/p/[token]/bids` | My bids, leading/outbid, won lots with "Pay now" (Yoco checkout URL). |

`POST /api/bid` (pass cookie or `token` in body)

```json
// request
{ "lotId": "uuid", "amount": 2500 }
// response 200
{ "result": "ok" | "too_low" | "lot_closed" | "not_checked_in" | "not_an_attendee",
  "highBid": 2500, "nextMin": 2750, "closesAt": "…" }
```

Rate limit: 10 requests per 10 seconds per attendee (in-memory map in the route; acceptable for POC).

### 7.4 Projection

`/display/[auctionId]?k=…`: full-screen, no chrome. Modes switched by the operator (stored in `auctions.branding` jsonb key `display_mode`, broadcast on `lot_status` topic or polled every 10 s):

- `grid` — all lots, current bid, bidder number, time left; recent-bids ticker at the bottom; total raised in the footer.
- `spotlight` — one lot large: image, title, current bid in very large type, next minimum, countdown, last five bids.
- `total` — total raised, thank-you message, CUT logo.

### 7.5 Webhooks

| Route | Provider | Verification | Effect |
|---|---|---|---|
| `POST /api/webhooks/resend` | Resend | Svix signature | Update `message_deliveries.status` by `provider_message_id`; set `invitations.opened_at` on `email.opened`. |
| `GET/POST /api/webhooks/whatsapp` | Meta | GET: `hub.verify_token` handshake. POST: `X-Hub-Signature-256` HMAC with app secret. | Statuses → `message_deliveries`; inbound messages logged (opens the 24-hour free-form window). |
| `POST /api/webhooks/yoco` | Yoco | Webhook secret | `payment.succeeded` → `settlements.status='paid'`, `paid_at`, `provider_ref`. |
| `GET /api/cron/keepalive` | GitHub Actions weekly | `Authorization: Bearer CRON_SECRET` | `select 1` through the admin client so the free project stays awake. |

---

## 8. Messaging layer

`lib/messaging/index.ts`:

```ts
type Kind = 'invite' | 'reminder' | 'pass' | 'broadcast' | 'outbid' | 'winner' | 'receipt';
type Channel = 'email' | 'whatsapp' | 'sms' | 'in_app';

export async function send(input: {
  kind: Kind; channel: Channel; eventId: string;
  contactId?: string; attendeeId?: string; broadcastId?: string;
  to: { email?: string; phone?: string };
  data: Record<string, unknown>;          // template variables
}): Promise<{ deliveryId: string; providerMessageId?: string; status: 'sent' | 'failed'; error?: string }>
```

Every call inserts a `message_deliveries` row first (status `queued`), calls the provider, then updates the row. Templates live in `lib/messaging/templates/{kind}.ts` and return `{ subject, html, text, whatsappText }`.

**Email (Resend).** `POST https://api.resend.com/emails` with `from: EMAIL_FROM`, `to`, `subject`, `html`, `text`, `tags: [{name:'kind',value}]`. The `pass` email shows the QR as a hosted image (`<img src="https://…/storage/v1/object/public/passes/{attendeeId}.png">`) rather than an attachment, so it renders in every client and the same PNG serves WhatsApp. Resend's free tier requires a **verified sending domain** to email arbitrary recipients; without one it delivers only to the account owner. If no domain is available, set `EMAIL_PROVIDER=brevo` (300 emails/day, verified sender address is enough).

Sending is batched: `sendInvitations` and `sendBroadcast` process recipients with concurrency 5 inside a Route Handler with `export const maxDuration = 60` (Vercel Hobby allows up to 60 s). Anything larger than 200 recipients is chunked into successive requests from the client with a progress bar; that limit is not reached in the POC.

**WhatsApp (Meta Cloud API, direct).**
`POST https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages`, `Authorization: Bearer {token}`.

- Text: `{ messaging_product:'whatsapp', to:'27…', type:'text', text:{ body } }`
- Image (pass QR): `{ type:'image', image:{ link: qrPngUrl, caption } }` where `qrPngUrl` is a public Storage URL in bucket `passes`.
- Template (production only): `{ type:'template', template:{ name, language:{code:'en'}, components:[…] } }`

POC constraint: the Meta **test number** can only message up to five recipient numbers added in the Meta dashboard, and free-form text is delivered only within 24 hours of that recipient last messaging the number. The demo procedure therefore has each demo phone send "Hi" to the test number before the demo. This is documented in `04-DEMO-SCRIPT.md`.

**SMS.** Interface stubbed with `sms.noop.ts` that records `failed` with error `not_configured`. Implemented in Stage B.

**In-app.** No provider; the `broadcast` row plus a `realtime.send` on `event:{id}` is the delivery. A `message_deliveries` row is still written per attendee so the log is complete.

---

## 9. Payments (Yoco sandbox)

`lib/payments/yoco.ts`:

```ts
export async function createCheckout(settlementId: string): Promise<{ checkoutUrl: string; checkoutId: string }>
```

`POST https://payments.yoco.com/api/checkouts` with `Authorization: Bearer YOCO_SECRET_KEY`, body `{ amount: <cents>, currency: 'ZAR', successUrl, cancelUrl, failureUrl, metadata: { settlementId } }`. Store `checkout_url` and `provider_ref` on the settlement. Webhook marks paid. Test card numbers are in Yoco's docs.

If CUT Finance later mandates PayFast, only this file and the webhook route change.

---

## 10. Storage buckets

| Bucket | Public | Contents |
|---|---|---|
| `lot-images` | public read | Lot photos, resized client-side to max 1600 px before upload. |
| `passes` | public read | Generated pass QR PNGs, named `{attendeeId}.png`, for WhatsApp image messages. The PNG contains only a URL with a signed token, so public read is acceptable. |
| `event-banners` | public read | Event hero images. |

Writes go through Server Actions using the admin client; the browser never writes to Storage directly in the POC.

---

## 11. Seed data (`supabase/seed/seed.ts`, run with `pnpm seed`)

Idempotent; deletes and recreates its own department `demo`.

- Department: `Institutional Advancement (Demo)`.
- Users (via Auth admin API, `email_confirm: true`): `organiser@demo.cut-events.test`, `door@demo.cut-events.test`, `admin@demo.cut-events.test`. Passwords are not used; OTP only. For demo convenience the seed also prints a magic link for each.
- Contacts: 40 fictitious people, names generated from a South African name list, emails `firstname.lastname@example.com`, phones `+2782000000NN`. Tags mix `alumni`, `donor`, `staff`, `partner`; alumni years 1985–2020.
- Event: **"CUT Fundraising Gala Dinner (Demo)"**, Friday 30 October 2026 18:00 SAST, venue "CUT Hotel School, Bloemfontein", capacity 200, plus-ones allowed, auction enabled, status `published`. The real gala exists on CUT's events calendar; the demo mirrors it.
- Invitations: all 40 contacts; 28 accepted (with attendees and passes), 6 declined, 6 pending. 12 of the accepted are pre-checked-in with bidder numbers 1–12 so the auction board is not empty at demo start.
- Auction: silent mode, soft close 120 s, default increment table, closes 30 October 2026 21:30.
- Lots (six, images in `supabase/seed/lots/lot-{1..6}.jpg`): 1 "Weekend for two at a Clarens guesthouse" R3 000; 2 "Signed Cheetahs rugby jersey" R1 500; 3 "Original artwork by a CUT Design graduate" R5 000, reserve R6 000 (so the demo can show an unsold-under-reserve outcome); 4 "Executive braai set, donated by a local partner" R2 000; 5 "One year of CUT Hotel School Sunday lunches" R6 000; 6 "Sponsor a first-year's textbooks for a year" R1 500. All six are ordinary auction lots in the POC (pledge lots with unlimited takers are Stage B). Lots 1–5 open with 2–4 seeded bids each from the 12 checked-in attendees; lot 6 open with no bids.
- Two demo pass URLs and the display URL are printed at the end of the seed run.

---

## 11a. `package.json` scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "e2e": "playwright test",
  "db:push": "supabase db push",
  "db:types": "supabase gen types typescript --linked > lib/db/types.ts",
  "seed": "tsx supabase/seed/seed.ts",
  "bid-storm": "tsx scripts/bid-storm.ts",
  "smoke-providers": "tsx scripts/smoke-providers.ts",
  "assets:fetch": "bash scripts/fetch-brand-assets.sh",
  "assets:derive": "python scripts/generate-derived-assets.py"
}
```

## 11b. Known platform gotchas (read before Week 1)

- **Supabase Auth mailer rate limit** on the free tier is a few emails per hour. Configure custom SMTP (§4.9) before relying on OTP login.
- **`html5-qrcode` needs HTTPS** and a user gesture to open the camera on iOS Safari. Localhost is exempt; Vercel is HTTPS. Import it in a client component with `dynamic(() => import(...), { ssr: false })`.
- **Server Action body size** defaults to 1 MB. Set `experimental.serverActions.bodySizeLimit = '10mb'` in `next.config.ts` for CSV and image uploads; resize images client-side to ≤ 1600 px before upload.
- **Vercel function region:** set `regions: ['cpt1']` (Cape Town) in `vercel.json` if the Supabase project is in an African or European region; otherwise match the Supabase region. Cross-continent hops add 150–300 ms to every bid.
- **Preview deployments** get their own URL; QR codes embed `NEXT_PUBLIC_APP_URL`, so always generate demo passes from the production deployment.
- **Meta temporary access tokens expire after 24 hours.** Refresh in the Meta dashboard on the morning of every demo, or create a System User token (permanent) once the app is past development mode.
- **WhatsApp test number** delivers free-form text only inside a 24-hour window opened by the recipient messaging the number first. Demo phones must send "Hi" beforehand.
- **`realtime.send` and public channels** must be enabled on the project; the polling fallback in §4.6 exists for this reason.
- **`pg_cron` sub-minute schedules** need pg_cron ≥ 1.5; fall back to every minute.
- **Time zones:** Supabase stores `timestamptz` in UTC; render with `Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg' })`. Never use `toLocaleString()` without a zone.

## 12. Quality gates

- `pnpm lint`, `pnpm typecheck`, `pnpm test` run in CI on every push.
- Unit tests: token sign/verify; `bidStep`/`nextMinBid` in TypeScript agree with SQL for a table of cases; CSV import parsing and de-duplication; ZAR formatting.
- `scripts/bid-storm.ts`: fires 100 concurrent bids from 20 seeded attendees at one lot and asserts the ledger is strictly increasing by valid steps with no two accepted bids at the same amount. Run manually before the demo.
- Playwright smoke (optional in week 4): login → open event → attendance page renders; open pass URL → QR visible; open display URL → lots render.
- Migrations are applied to the dev project by `migrate.yml` on push to `main`, after CI passes. `supabase db push --dry-run` runs in `ci.yml` on pull requests.

---

## 13. Non-functional targets for the POC

| Target | Value |
|---|---|
| Bid placed → projection updated | < 1 s on mobile data |
| Scan → result card | < 2 s |
| Attendee page weight | < 1 MB first load, no client-side Supabase bundle on the pass page except the realtime client |
| Lighthouse accessibility on attendee pages | ≥ 90 |
| Time zone | store UTC, render `Africa/Johannesburg` via `Intl.DateTimeFormat` |
| Currency | `R2 500` (space thousands separator, no decimals unless cents present), `lib/money.ts` |

---

## 14. Deferred to Stage B (seams already present)

Offline scanner queue (IndexedDB) · reminders and scheduled sends (`pg_cron` + `broadcasts.scheduled_at`) · SMS provider · WhatsApp templates and Business verification · live-sequenced auction mode UI (the `mode` column exists) · invoices PDF · cross-event reports · department switching UI · audit log UI · Cloudflare Pages deployment · Microsoft Entra SSO for staff.
