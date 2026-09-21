-- 0010 — self-registration by event QR (docs/07)
alter table events
  add column if not exists join_token text unique,
  add column if not exists join_nonce uuid;
comment on column events.join_token is 'Signed j. token printed on the event QR; null = self-registration off. Regenerating it revokes every printed code.';
