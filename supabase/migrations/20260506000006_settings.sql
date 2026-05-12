-- Areen CUBs Studio — Settings (singleton)
-- One-row table holding the brand identity that prints on every devis +
-- the agency-wide defaults (TVA rate, default object, etc).

create table if not exists public.settings (
  id                       integer primary key default 1,
  company_name             text not null default 'Areen CUBs',
  company_address          text not null default 'Résidence Nadine, Avenue Habib Bourguiba Ksibet El Médiouni Monastir 5031 Tunisie',
  matricule_fiscal         text not null default '1823660/R/M/A/000',
  email                    text not null default 'areencubs@gmail.com',
  phone                    text not null default '+216 52 148 184',
  website                  text not null default 'areencubs.com',
  tva_rate                 numeric(5,2) not null default 19.00,
  default_devis_object     text not null default 'Création d''identité visuelle et supports de communication',
  default_facture_object   text not null default 'Facturation services rendus',
  updated_at               timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

alter table public.settings enable row level security;

drop policy if exists "settings_read_all" on public.settings;
create policy "settings_read_all"
  on public.settings
  for select using (auth.uid() is not null);

drop policy if exists "settings_admin_write" on public.settings;
create policy "settings_admin_write"
  on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Auto-bump updated_at
drop trigger if exists trg_settings_updated on public.settings;
create trigger trg_settings_updated before update on public.settings
  for each row execute function public.set_updated_at();
