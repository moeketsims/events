-- 00 — fixture for the RLS boundary script.
-- Run after 01-schema-behaviour.sql, which creates the department, event,
-- attendees, auction and lots this file builds on.

insert into departments (id, name, slug)
values ('aaaaaaaa-0000-0000-0000-000000000002', 'Other Dept', 'other-dept')
on conflict (id) do nothing;

insert into events (id, department_id, title, slug, starts_at)
values ('aaaaaaaa-0000-0000-0000-0000000000e2', 'aaaaaaaa-0000-0000-0000-000000000002',
        'Other Dept Event', 'other-dept-event', now() + interval '2 days')
on conflict (id) do nothing;

insert into contacts (id, department_id, first_name, last_name, email)
values ('aaaaaaaa-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111',
        'Verify', 'Contact', 'verify.contact@example.com')
on conflict (id) do nothing;

-- Profiles normally arrive through the handle_new_user() trigger on
-- auth.users; these rows stand in for three signed-in members of staff.
-- GoTrue treats confirmation_token, recovery_token, email_change and
-- email_change_token_* as NOT NULL in its own Go structs even though the
-- columns allow null. A raw insert that leaves them null makes every later call
-- to the Auth admin API fail with "Database error checking email", so they are
-- set to '' here explicitly.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data,
                        confirmation_token, recovery_token, email_change,
                        email_change_token_new, email_change_token_current)
values
 ('bbbbbbbb-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-organiser@example.com','', now(), now(), now(), '{}','{}', '', '', '', '', ''),
 ('bbbbbbbb-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-door@example.com','', now(), now(), now(), '{}','{}', '', '', '', '', ''),
 ('bbbbbbbb-0000-0000-0000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-other@example.com','', now(), now(), now(), '{}','{}', '', '', '', '', '')
on conflict (id) do nothing;

update profiles set department_id = '11111111-1111-1111-1111-111111111111', role = 'organiser'
 where id = 'bbbbbbbb-0000-0000-0000-00000000000a';
update profiles set department_id = '11111111-1111-1111-1111-111111111111', role = 'door_staff'
 where id = 'bbbbbbbb-0000-0000-0000-00000000000b';
update profiles set department_id = 'aaaaaaaa-0000-0000-0000-000000000002', role = 'organiser'
 where id = 'bbbbbbbb-0000-0000-0000-00000000000c';
