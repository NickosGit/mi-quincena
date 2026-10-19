-- Mi Quincena · schema
-- Paste into the Supabase SQL editor and Run. Safe to run once on a fresh project.
-- Only due_date, amount and label are stored. Screenshots never reach the database.

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  due_date date not null,
  amount numeric(10,2) not null check (amount > 0 and amount <= 100000),
  label text not null check (char_length(label) between 1 and 40),
  created_at timestamptz not null default now()
);
alter table public.installments enable row level security;
create policy "own rows select" on public.installments for select using (user_id = auth.uid());
create policy "own rows insert" on public.installments for insert with check (user_id = auth.uid());
create policy "own rows update" on public.installments for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.installments for delete using (user_id = auth.uid());

-- Additions beyond the prompt's table (defense in depth + the dashboard's main query).
-- Signed-out visitors (anon role) get no table privileges at all, not just zero rows.
revoke all on public.installments from anon;
create index installments_user_due_idx on public.installments (user_id, due_date);
