-- 1. Kiosk Fleet Management Table
create table public.kiosks (
  id                  text primary key, -- Unique identifier like 'LIB-04'
  name                text not null,    -- Display name
  location            text,             -- E.g., 'Main Library'
  is_online           boolean default false,
  ink_level_percent   int default 100,
  paper_level_percent int default 100,
  last_heartbeat      timestamptz default now(),
  created_at          timestamptz default now()
);

-- 2. System Notifications & Alerts
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  kiosk_id    text references public.kiosks on delete cascade,
  type        text not null, -- 'paper_jam', 'low_ink', 'offline', 'hardware_error'
  message     text not null,
  is_read     boolean default false,
  created_at  timestamptz default now()
);

-- 3. Add kiosk_id to print_jobs so we can track revenue per kiosk
alter table public.print_jobs 
  add column kiosk_id text references public.kiosks on delete set null;

-- Seed a default kiosk for local testing
insert into public.kiosks (id, name, location, is_online) 
values ('LIB-04', 'Library Main Kiosk', 'Central Library', true);
