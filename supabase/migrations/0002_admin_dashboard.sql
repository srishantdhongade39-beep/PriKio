-- 0002_admin_dashboard.sql
-- Add hardware tracking columns to kiosks
alter table kiosks add column ink_level_percent int default 100;
alter table kiosks add column paper_level_percent int default 100;

-- Create notifications table
create table notifications (
  id            uuid primary key default gen_random_uuid(),
  kiosk_id      text references kiosks(id),
  type          text not null, -- 'low_ink', 'out_of_paper', 'offline'
  message       text not null,
  is_read       boolean default false,
  created_at    timestamptz default now()
);

-- Enable RLS for notifications
alter table notifications enable row level security;
create policy "Admins can view notifications" on notifications for select using (
  exists (
    select 1 from profiles where id = auth.uid() and role in ('admin', 'super_admin')
  )
);
create policy "Admins can update notifications" on notifications for update using (
  exists (
    select 1 from profiles where id = auth.uid() and role in ('admin', 'super_admin')
  )
);
create policy "System can insert notifications" on notifications for insert with check (true);

-- Create admin_invites table
create table admin_invites (
  email         text primary key,
  role          text not null, -- 'admin' or 'super_admin'
  created_by    uuid references profiles(id),
  created_at    timestamptz default now()
);

-- Enable RLS for admin_invites
alter table admin_invites enable row level security;
create policy "Super admins can view invites" on admin_invites for select using (
  exists (
    select 1 from profiles where id = auth.uid() and role = 'super_admin'
  )
);
create policy "Super admins can insert invites" on admin_invites for insert with check (
  exists (
    select 1 from profiles where id = auth.uid() and role = 'super_admin'
  )
);
create policy "Super admins can delete invites" on admin_invites for delete using (
  exists (
    select 1 from profiles where id = auth.uid() and role = 'super_admin'
  )
);

-- Update handle_new_user to check admin_invites
create or replace function public.handle_new_user()
returns trigger as $$
declare
  assigned_role text := 'student';
begin
  -- Check if the user's email was invited as an admin
  select role into assigned_role from public.admin_invites where email = new.email;
  
  -- If no invite was found, role remains 'student' (or whatever default)
  if assigned_role is null then
    assigned_role := 'student';
  end if;

  insert into public.profiles (id, full_name, email, role)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email, assigned_role);
  return new;
end;
$$ language plpgsql security definer;
