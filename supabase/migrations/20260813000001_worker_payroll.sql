-- Worker payroll: task-linked points, cliff payout, bonuses and payment history.
-- Money is stored as integer millimes (1 DT = 1000) throughout.

begin;

create table public.payroll_task_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  base_rate_millimes integer not null check (base_rate_millimes > 0),
  above_rate_millimes integer not null check (above_rate_millimes > 0),
  output_points integer not null check (output_points >= 0),
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payroll_worker_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  target_millimes integer not null check (target_millimes > 0),
  baseline_percent integer not null default 80 check (baseline_percent between 1 and 99),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks
  add column payroll_task_type_id uuid references public.payroll_task_types(id) on delete set null,
  add column payroll_credit_user_id uuid references public.profiles(id) on delete set null;
alter table public.tasks add constraint tasks_payroll_pair_check check (
  (payroll_task_type_id is null) = (payroll_credit_user_id is null)
);

create index tasks_payroll_credit_idx
  on public.tasks(payroll_credit_user_id, completed_at)
  where payroll_task_type_id is not null;

create table public.payroll_task_credits (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  task_type_id uuid not null references public.payroll_task_types(id) on delete restrict,
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index payroll_task_credits_user_period_idx
  on public.payroll_task_credits(user_id, completed_at);

create table public.payroll_bonuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  bonus_date date not null,
  amount_millimes integer not null check (amount_millimes > 0),
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index payroll_bonuses_user_period_idx
  on public.payroll_bonuses(user_id, bonus_date);

create table public.payroll_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  period_start date not null check (period_start = date_trunc('month', period_start)::date),
  earned_millimes integer not null check (earned_millimes >= 0),
  payout_millimes integer not null check (payout_millimes >= 0),
  target_millimes integer not null check (target_millimes > 0),
  output_points integer not null check (output_points >= 0),
  status text not null default 'calculated' check (status in ('calculated','paid')),
  breakdown jsonb not null default '[]'::jsonb,
  note text,
  paid_at timestamptz,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start),
  check ((status = 'paid' and paid_at is not null) or status = 'calculated')
);
create index payroll_payments_user_period_idx
  on public.payroll_payments(user_id, period_start desc);

insert into public.payroll_task_types
  (code, label, base_rate_millimes, above_rate_millimes, output_points, position)
values
  ('video', 'Vidéo', 40000, 60000, 1, 10),
  ('post', 'Post', 8000, 12000, 1, 20),
  ('carousel', 'Carrousel', 24000, 36000, 3, 30),
  ('script', 'Script', 8000, 12000, 1, 40),
  ('publication', 'Publication', 10000, 15000, 1, 50),
  ('marketing_strategy', 'Stratégie marketing', 60000, 90000, 3, 60),
  ('brand_identity', 'Identité de marque', 120000, 180000, 5, 70);

alter table public.payroll_task_types enable row level security;
alter table public.payroll_worker_settings enable row level security;
alter table public.payroll_task_credits enable row level security;
alter table public.payroll_bonuses enable row level security;
alter table public.payroll_payments enable row level security;

create policy payroll_task_types_admin_all on public.payroll_task_types
  for all using (public.is_admin()) with check (public.is_admin());
create policy payroll_task_types_worker_select on public.payroll_task_types
  for select using (public.auth_role() = 'worker');

create policy payroll_worker_settings_admin_all on public.payroll_worker_settings
  for all using (public.is_admin()) with check (public.is_admin());
create policy payroll_worker_settings_self_select on public.payroll_worker_settings
  for select using (public.auth_role() = 'worker' and user_id = auth.uid());

create policy payroll_task_credits_admin_all on public.payroll_task_credits
  for all using (public.is_admin()) with check (public.is_admin());
create policy payroll_task_credits_self_select on public.payroll_task_credits
  for select using (public.auth_role() = 'worker' and user_id = auth.uid());

create policy payroll_bonuses_admin_all on public.payroll_bonuses
  for all using (public.is_admin()) with check (public.is_admin());
create policy payroll_bonuses_self_select on public.payroll_bonuses
  for select using (public.auth_role() = 'worker' and user_id = auth.uid());

create policy payroll_payments_admin_all on public.payroll_payments
  for all using (public.is_admin()) with check (public.is_admin());
create policy payroll_payments_self_select on public.payroll_payments
  for select using (public.auth_role() = 'worker' and user_id = auth.uid());

revoke all on public.payroll_task_types, public.payroll_worker_settings,
  public.payroll_task_credits, public.payroll_bonuses, public.payroll_payments
  from anon, public;
grant select, insert, update, delete on public.payroll_task_types,
  public.payroll_worker_settings, public.payroll_task_credits,
  public.payroll_bonuses, public.payroll_payments to authenticated;

create or replace function public.guard_task_payroll_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated' and not public.is_admin() and (
    (tg_op = 'INSERT' and (new.payroll_task_type_id is not null or new.payroll_credit_user_id is not null))
    or
    (tg_op = 'UPDATE' and (
      new.payroll_task_type_id is distinct from old.payroll_task_type_id or
      new.payroll_credit_user_id is distinct from old.payroll_credit_user_id
    ))
  ) then
    raise exception 'Only an administrator may assign payroll credit'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_tasks_payroll_field_guard
  before insert or update on public.tasks for each row
  execute function public.guard_task_payroll_fields();

create or replace function public.sync_task_payroll_credit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  credit_time timestamptz;
begin
  if new.status <> 'done' or new.payroll_task_type_id is null
     or new.payroll_credit_user_id is null then
    return new;
  end if;

  credit_time := coalesce(new.completed_at, now());
  if extract(isodow from credit_time at time zone 'Africa/Tunis') in (6, 7) then
    raise exception 'Payroll work cannot be completed on a weekend';
  end if;

  if not exists (
    select 1 from public.profiles p
    join public.payroll_worker_settings s on s.user_id = p.id and s.active
    where p.id = new.payroll_credit_user_id and p.role = 'worker'
  ) then
    raise exception 'Payroll credit requires an active worker payroll profile';
  end if;

  insert into public.payroll_task_credits(task_id, user_id, task_type_id, completed_at)
  values (new.id, new.payroll_credit_user_id, new.payroll_task_type_id, credit_time)
  on conflict (task_id) do update set
    user_id = excluded.user_id,
    task_type_id = excluded.task_type_id,
    completed_at = excluded.completed_at;
  return new;
end;
$$;

create trigger trg_tasks_sync_payroll_credit
  after insert or update of status, completed_at, payroll_task_type_id, payroll_credit_user_id
  on public.tasks for each row execute function public.sync_task_payroll_credit();

commit;
