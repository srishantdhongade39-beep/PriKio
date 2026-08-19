-- USERS (extends Supabase auth.users)
create table profiles (
  id            uuid references auth.users primary key,
  full_name     text,
  student_id    text unique,
  department    text,
  year          int,
  wallet_balance decimal(10,2) default 0,
  role          text default 'student', -- student | faculty | admin
  created_at    timestamptz default now()
);

-- PRINT JOBS
create table print_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references profiles(id),
  file_name     text not null,
  file_url      text not null,        -- Supabase storage URL
  file_size_mb  decimal(6,2),
  page_count    int,
  color_mode    text,                 -- bw | color
  sides         text,                 -- simplex | duplex
  page_range    text,                 -- e.g. "1-12" or "all"
  copies        int default 1,
  sheet_count   int,
  kiosk_id      text,
  status        text default 'pending',
                -- pending | processing | sent | ready | collected | failed
  total_amount  decimal(8,2),
  payment_id    text,                 -- Razorpay payment ID
  payment_status text default 'unpaid', -- unpaid | paid | failed | refunded
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- KIOSKS
create table kiosks (
  id            text primary key,     -- e.g. "LIB-04"
  name          text,
  location      text,
  building      text,
  floor         text,
  is_online     boolean default true,
  queue_count   int default 0,
  ink_level_percent int default 100,
  paper_level_percent int default 100,
  last_ping     timestamptz
);

-- PRINT OTPS
create table print_otps (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid references print_jobs(id) on delete cascade,
  otp_hash      text not null,
  expires_at    timestamptz not null,
  attempts      int default 0,
  is_valid      boolean default true,
  created_at    timestamptz default now()
);

-- TRANSACTIONS
create table transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references profiles(id),
  print_job_id  uuid references print_jobs(id),
  amount        decimal(8,2),
  method        text,                 -- upi | qr | wallet | card
  razorpay_order_id text,
  razorpay_payment_id text,
  status        text,                 -- created | paid | failed
  created_at    timestamptz default now()
);

-- CLOUD DOCUMENTS
create table cloud_documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references profiles(id),
  provider      text,                 -- gdrive | dropbox | local
  file_name     text,
  file_size_mb  decimal(6,2),
  mime_type     text,
  provider_file_id text,
  storage_url   text,
  created_at    timestamptz default now()
);

-- ROW LEVEL SECURITY (RLS) POLICIES
alter table profiles enable row level security;
alter table print_jobs enable row level security;
alter table transactions enable row level security;
alter table cloud_documents enable row level security;
alter table kiosks enable row level security;
alter table print_otps enable row level security;
alter table notifications enable row level security;
alter table admin_invites enable row level security;

-- profiles: user can only read/update their own row
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
-- allow insert on signup (usually handled by a trigger, but explicit here for completeness if inserted manually)
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- print_jobs: user can only read their own jobs
create policy "Users can view own print jobs" on print_jobs for select using (auth.uid() = user_id);
create policy "Users can insert own print jobs" on print_jobs for insert with check (auth.uid() = user_id);
create policy "Users can update own print jobs" on print_jobs for update using (auth.uid() = user_id);

-- transactions: user can only read their own transactions
create policy "Users can view own transactions" on transactions for select using (auth.uid() = user_id);
create policy "Users can insert own transactions" on transactions for insert with check (auth.uid() = user_id);

-- cloud_documents: user can only read their own documents
create policy "Users can view own cloud documents" on cloud_documents for select using (auth.uid() = user_id);
create policy "Users can insert own cloud documents" on cloud_documents for insert with check (auth.uid() = user_id);
create policy "Users can update own cloud documents" on cloud_documents for update using (auth.uid() = user_id);
create policy "Users can delete own cloud documents" on cloud_documents for delete using (auth.uid() = user_id);

-- print_otps: system/service role mostly, but user can view their own
create policy "Users can view own OTPs" on print_otps for select using (
  exists (
    select 1 from print_jobs where id = print_otps.job_id and user_id = auth.uid()
  )
);
create policy "Users can insert own OTPs" on print_otps for insert with check (
  exists (
    select 1 from print_jobs where id = print_otps.job_id and user_id = auth.uid()
  )
);
create policy "Users can update own OTPs" on print_otps for update using (
  exists (
    select 1 from print_jobs where id = print_otps.job_id and user_id = auth.uid()
  )
);

-- kiosks: all authenticated users can read
create policy "Authenticated users can view kiosks" on kiosks for select using (auth.role() = 'authenticated');

-- Auth Hook Trigger to automatically create a profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
declare
  assigned_role text := 'student';
begin
  select role into assigned_role from public.admin_invites where email = new.email;
  if assigned_role is null then
    assigned_role := 'student';
  end if;

  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', assigned_role);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
