-- 0009 — log_audit for actions that have no single row
--
-- `audit_log.entity_id` is nullable because some auditable acts are about a set
-- rather than a row: a CSV import of a donor list (TASKS T2.1) touches hundreds
-- of contacts and there is no one id to point at. `log_audit` was declared with
-- `p_entity_id uuid` and no default, so the generated TypeScript types made the
-- argument required and non-null and the importer could not record itself.
--
-- Adding a default does not change the function's signature, so the REVOKE and
-- GRANT in 0004 — which name log_audit(uuid,text,text,uuid,jsonb) — continue to
-- apply and the function stays callable by service_role alone.

create or replace function log_audit(
  p_actor_id uuid,
  p_action text,
  p_entity text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = public as $$
  insert into audit_log (actor_id, action, entity, entity_id, metadata)
  values (p_actor_id, p_action, p_entity, p_entity_id, p_metadata)
$$;

revoke all on function log_audit(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function log_audit(uuid, text, text, uuid, jsonb) to service_role;
