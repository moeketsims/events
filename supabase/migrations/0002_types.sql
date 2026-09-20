-- 0002 — enum types
--
-- BUILD-SPEC §4.1. Every enum is created idempotently so a re-run against a
-- partially migrated project does not abort the batch.

do $$ begin
  create type user_role as enum ('platform_admin','organiser','door_staff','auction_operator','finance');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_status as enum ('draft','published','live','closed','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invitation_status as enum ('pending','accepted','declined','waitlisted','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_channel as enum ('email','whatsapp','sms','in_app');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_status as enum ('queued','sent','delivered','read','failed','bounced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_kind as enum ('invite','reminder','pass','broadcast','outbid','winner','receipt');
exception when duplicate_object then null; end $$;

do $$ begin
  create type auction_mode as enum ('silent','live');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lot_status as enum ('upcoming','open','closed','unsold','withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type settlement_status as enum ('pending','paid','overdue','waived');
exception when duplicate_object then null; end $$;
