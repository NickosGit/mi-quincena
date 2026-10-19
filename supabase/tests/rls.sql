-- =============================================================================
-- Mi Quincena · RLS test suite (prompt F2 + packet §10.5)
--
-- Run supabase/schema.sql first. Then paste this whole file into the Supabase
-- SQL editor and press Run. It returns one row per test (PASS/FAIL + detail)
-- and a summary row.
--
-- Nothing persists: every test runs inside one block that ends with a forced
-- rollback (SQLSTATE MQRBK). The SQL editor only shows the last statement's
-- result, so a plain `begin; … rollback;` script would hide the results.
--
-- Users are simulated the way PostgREST does it:
--   role := authenticated  +  request.jwt.claims := {"sub": <uuid>}
-- so the same policies apply as for the Supabase client in the app.
-- All users and amounts are invented.
-- =============================================================================

create or replace function pg_temp.act(p_uid uuid) returns void
language plpgsql as $$
begin
  if p_uid is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true);
  else
    perform set_config('request.jwt.claims',
                       json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end $$;

create or replace function pg_temp.admin() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'none', true);
end $$;

create or replace function pg_temp.v(p_ok boolean, p_test text, p_detail text) returns jsonb
language sql as $$
  select jsonb_build_array(jsonb_build_object('ok', coalesce(p_ok, false), 'test', p_test, 'detail', coalesce(p_detail, '')))
$$;

create or replace function pg_temp.mq_rls()
returns table (n integer, result text, test text, detail text)
language plpgsql as $fn$
declare
  out_log jsonb := '[]'::jsonb;
  uA uuid := 'a0000000-0000-4000-8000-0000000000a1';
  uB uuid := 'a0000000-0000-4000-8000-0000000000b2';
  rowB uuid;
  k integer;
  owner uuid;
begin
  begin  -- ===== everything below is rolled back at the end =====

  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         u.email, '{}'::jsonb, '{}'::jsonb, now(), now()
  from (values
    (uA, 'miquincena-test-a@example.invalid'),
    (uB, 'miquincena-test-b@example.invalid')
  ) as u(id, email);

  -- ---------------------------------------------------------------- T01
  perform pg_temp.act(uA);
  begin
    insert into public.installments (due_date, amount, label) values
      ('2026-11-05', 1249.00, 'Celular (demo)'),
      ('2026-11-12', 892.50, 'Tenis (demo)');
    select count(*) into k from public.installments;
    out_log := out_log || pg_temp.v(k = 2, 'T01 A inserts 2 rows (user_id defaults to auth.uid()) and sees them', 'A sees ' || k);
  exception when others then
    out_log := out_log || pg_temp.v(false, 'T01 A inserts 2 rows and sees them', sqlerrm);
  end;

  -- ---------------------------------------------------------------- T02
  perform pg_temp.act(uB);
  select count(*) into k from public.installments;
  out_log := out_log || pg_temp.v(k = 0, 'T02 B gets 0 rows from A (no filter)', 'B sees ' || k);
  select count(*) into k from public.installments where user_id = uA;
  out_log := out_log || pg_temp.v(k = 0, 'T02b B gets 0 rows even filtering by A''s user_id', 'B sees ' || k);

  -- ---------------------------------------------------------------- T03
  perform pg_temp.act(uB);
  begin
    insert into public.installments (user_id, due_date, amount, label) values (uA, '2026-11-20', 1.00, 'Ataque');
    out_log := out_log || pg_temp.v(false, 'T03 B cannot insert a row with A''s user_id', 'no error');
  exception when others then
    out_log := out_log || pg_temp.v(sqlerrm like '%row-level security%', 'T03 B cannot insert a row with A''s user_id', sqlerrm);
  end;

  -- ---------------------------------------------------------------- T04
  perform pg_temp.act(uB);
  update public.installments set amount = 1 where user_id = uA;
  get diagnostics k = row_count;
  perform pg_temp.admin();
  out_log := out_log || pg_temp.v(
    k = 0 and (select sum(amount) from public.installments where user_id = uA) = 2141.50,
    'T04 B cannot update A''s rows', 'rows updated=' || k);

  -- ---------------------------------------------------------------- T05
  perform pg_temp.act(uB);
  delete from public.installments where user_id = uA;
  get diagnostics k = row_count;
  perform pg_temp.admin();
  out_log := out_log || pg_temp.v(
    k = 0 and (select count(*) from public.installments where user_id = uA) = 2,
    'T05 B cannot delete A''s rows', 'rows deleted=' || k);

  -- ---------------------------------------------------------------- T06
  perform pg_temp.act(uB);
  begin
    insert into public.installments (due_date, amount, label) values ('2026-11-30', 349.00, 'Súper (demo)')
      returning id, user_id into rowB, owner;
    out_log := out_log || pg_temp.v(owner = uB, 'T06 B inserts own row; user_id is B', 'user_id=' || owner);
  exception when others then
    out_log := out_log || pg_temp.v(false, 'T06 B inserts own row', sqlerrm);
  end;

  -- ---------------------------------------------------------------- T07
  perform pg_temp.act(uB);
  begin
    update public.installments set user_id = uA where id = rowB;
    out_log := out_log || pg_temp.v(false, 'T07 B cannot move own row to A (update with check)', 'no error');
  exception when others then
    out_log := out_log || pg_temp.v(sqlerrm like '%row-level security%', 'T07 B cannot move own row to A (update with check)', sqlerrm);
  end;

  -- ---------------------------------------------------------------- T08
  perform pg_temp.act(uA);
  select count(*) into k from public.installments;
  out_log := out_log || pg_temp.v(k = 2, 'T08 A still sees only own 2 rows after B inserted', 'A sees ' || k);

  -- ---------------------------------------------------------------- T09 anon
  perform pg_temp.act(null);
  begin
    select count(*) into k from public.installments;
    out_log := out_log || pg_temp.v(k = 0, 'T09 signed-out visitor reads nothing', 'anon sees ' || k);
  exception when others then
    out_log := out_log || pg_temp.v(sqlerrm like '%permission denied%', 'T09 signed-out visitor reads nothing', sqlerrm);
  end;
  perform pg_temp.act(null);
  begin
    insert into public.installments (user_id, due_date, amount, label) values (uA, '2026-11-20', 1.00, 'Ataque');
    out_log := out_log || pg_temp.v(false, 'T09b signed-out visitor cannot insert', 'no error');
  exception when others then
    out_log := out_log || pg_temp.v(true, 'T09b signed-out visitor cannot insert', sqlerrm);
  end;

  -- ---------------------------------------------------------------- T10 checks
  perform pg_temp.act(uA);
  begin
    insert into public.installments (due_date, amount, label) values ('2026-11-20', 0, 'Cero');
    out_log := out_log || pg_temp.v(false, 'T10a amount 0 rejected', 'no error');
  exception when others then
    out_log := out_log || pg_temp.v(sqlerrm like '%check constraint%', 'T10a amount 0 rejected', sqlerrm);
  end;
  begin
    insert into public.installments (due_date, amount, label) values ('2026-11-20', -10, 'Negativo');
    out_log := out_log || pg_temp.v(false, 'T10b negative amount rejected', 'no error');
  exception when others then
    out_log := out_log || pg_temp.v(sqlerrm like '%check constraint%', 'T10b negative amount rejected', sqlerrm);
  end;
  begin
    insert into public.installments (due_date, amount, label) values ('2026-11-20', 100000.01, 'Muy alto');
    out_log := out_log || pg_temp.v(false, 'T10c amount over 100,000 rejected', 'no error');
  exception when others then
    out_log := out_log || pg_temp.v(sqlerrm like '%check constraint%', 'T10c amount over 100,000 rejected', sqlerrm);
  end;
  begin
    insert into public.installments (due_date, amount, label) values ('2026-11-20', 10, '');
    out_log := out_log || pg_temp.v(false, 'T10d empty label rejected', 'no error');
  exception when others then
    out_log := out_log || pg_temp.v(sqlerrm like '%check constraint%', 'T10d empty label rejected', sqlerrm);
  end;
  begin
    insert into public.installments (due_date, amount, label) values ('2026-11-20', 10, repeat('x', 41));
    out_log := out_log || pg_temp.v(false, 'T10e 41-char label rejected', 'no error');
  exception when others then
    out_log := out_log || pg_temp.v(sqlerrm like '%check constraint%', 'T10e 41-char label rejected', sqlerrm);
  end;

  -- ---------------------------------------------------------------- T11 delete-all
  perform pg_temp.act(uA);
  delete from public.installments;  -- what "Borrar todos mis datos" will run
  get diagnostics k = row_count;
  perform pg_temp.admin();
  out_log := out_log || pg_temp.v(
    k = 2 and (select count(*) from public.installments where user_id = uB) = 1,
    'T11 A''s unfiltered delete removes only A''s rows', 'deleted=' || k || ', B rows left='
      || (select count(*) from public.installments where user_id = uB));

  -- ===== undo everything =====
  raise exception using errcode = 'MQRBK', message = 'mi quincena rls suite: rollback';
  exception when sqlstate 'MQRBK' then
    null;
  end;

  perform pg_temp.admin();

  return query
    select e.ord::int,
           case when (e.val ->> 'ok')::boolean then 'PASS' else 'FAIL' end,
           e.val ->> 'test',
           e.val ->> 'detail'
    from jsonb_array_elements(out_log) with ordinality as e(val, ord);

  return query
    select 999, 'SUMMARY',
           (select count(*) from jsonb_array_elements(out_log) as v(val) where (v.val ->> 'ok')::boolean)::text
             || ' of ' || jsonb_array_length(out_log)::text || ' PASS',
           'All test data was rolled back.';
end $fn$;

select * from pg_temp.mq_rls();
