-- À lancer UNE fois dans Supabase > SQL Editor, après avoir créé les comptes
-- (Authentication > Users > Add user, cocher « Auto Confirm User »).

-- 1. Tables et protections (identique à la fin de schema.sql)
create table if not exists profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz default now()
);
alter table documents  enable row level security;
alter table pages      enable row level security;
alter table chunks     enable row level security;
alter table agent_runs enable row level security;
alter table profiles   enable row level security;
revoke execute on function match_chunks(vector, int) from public, anon, authenticated;

-- 2. Rôles : remplacer les deux courriels
insert into profiles (user_id, role)
select id, 'admin' from auth.users where email = 'admin@exemple.com'
on conflict (user_id) do update set role = excluded.role;

insert into profiles (user_id, role)
select id, 'user' from auth.users where email = 'employe@exemple.com'
on conflict (user_id) do update set role = excluded.role;

-- Vérification
select u.email, p.role from auth.users u left join profiles p on p.user_id = u.id;
