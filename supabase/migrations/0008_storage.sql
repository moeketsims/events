-- 0008 — storage buckets
--
-- BUILD-SPEC §4.8 and §10. Three public-read buckets, no write policies at all:
-- every upload goes through a Server Action using the service-role client, so
-- the browser never writes to Storage in the POC.
--
-- The passes bucket holds generated QR PNGs named {attendeeId}.png, needed
-- because a WhatsApp image message takes a public URL rather than an
-- attachment. The PNG encodes only the pass URL, which already carries its own
-- signed token, so public read adds no exposure: knowing the attendee id does
-- not let anyone forge a token.

insert into storage.buckets (id, name, public) values
  ('lot-images','lot-images', true),
  ('passes','passes', true),
  ('event-banners','event-banners', true)
on conflict (id) do update set public = excluded.public;

do $$
declare b text;
begin
  foreach b in array array['lot-images','passes','event-banners'] loop
    execute format('drop policy if exists %I on storage.objects', 'public read ' || b);
    execute format(
      'create policy %I on storage.objects for select to public using (bucket_id = %L)',
      'public read ' || b, b);
  end loop;
end $$;
