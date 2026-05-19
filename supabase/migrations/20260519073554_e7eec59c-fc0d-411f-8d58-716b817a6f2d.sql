
-- Roles
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "admins read roles" on public.user_roles for select using (public.has_role(auth.uid(), 'admin'));
create policy "admins manage roles" on public.user_roles for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Allowed emails
create table public.allowed_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  note text,
  granted_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;
create policy "authenticated read allowed_emails" on public.allowed_emails for select to authenticated using (true);
create policy "admins manage allowed_emails" on public.allowed_emails for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Access requests
create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  telegram_username text,
  reason text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
alter table public.access_requests enable row level security;
create policy "anyone can request access" on public.access_requests for insert to anon, authenticated with check (true);
create policy "admins read requests" on public.access_requests for select using (public.has_role(auth.uid(), 'admin'));
create policy "admins update requests" on public.access_requests for update using (public.has_role(auth.uid(), 'admin'));
create policy "admins delete requests" on public.access_requests for delete using (public.has_role(auth.uid(), 'admin'));

-- Templates
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  category text not null default 'anime',
  description text,
  external_endpoint_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.templates enable row level security;
create policy "admins manage templates" on public.templates for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "authenticated read templates" on public.templates for select to authenticated using (true);

-- API keys
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  customer_note text,
  bot_limit int not null default 1,
  allowed_template_slugs text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
alter table public.api_keys enable row level security;
create policy "admins manage api_keys" on public.api_keys for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- API key bots (unique bot registrations per key)
create table public.api_key_bots (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  bot_id text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (api_key_id, bot_id)
);
alter table public.api_key_bots enable row level security;
create policy "admins read api_key_bots" on public.api_key_bots for select using (public.has_role(auth.uid(), 'admin'));
create policy "admins delete api_key_bots" on public.api_key_bots for delete using (public.has_role(auth.uid(), 'admin'));

-- Logs
create table public.api_logs (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid references public.api_keys(id) on delete set null,
  template_slug text,
  bot_id text,
  status int,
  error text,
  duration_ms int,
  created_at timestamptz not null default now()
);
alter table public.api_logs enable row level security;
create policy "admins read api_logs" on public.api_logs for select using (public.has_role(auth.uid(), 'admin'));

create index on public.api_logs (created_at desc);
create index on public.api_key_bots (api_key_id);

-- Seed templates 1..100 (animeposter, animeposter2, ... animeposter100)
do $$
declare i int;
begin
  for i in 1..100 loop
    insert into public.templates (slug, display_name, category, description, active)
    values (
      case when i = 1 then 'animeposter' else 'animeposter' || i::text end,
      case when i = 1 then 'Anime Poster' else 'Anime Poster ' || i::text end,
      'anime',
      'Anime poster template #' || i::text,
      i = 1
    ) on conflict (slug) do nothing;
  end loop;
end $$;
