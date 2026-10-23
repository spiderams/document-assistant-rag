-- Run once in Supabase > SQL Editor

create extension if not exists vector;

create table documents (
  id          uuid primary key default gen_random_uuid(),
  filename    text not null,
  page_count  int,
  status      text not null default 'uploaded',  -- uploaded | indexed | error
  error       text,
  created_at  timestamptz default now()
);

create table pages (
  id          bigserial primary key,
  document_id uuid references documents(id) on delete cascade,
  page_number int not null,
  text        text not null
);

create table chunks (
  id          bigserial primary key,
  document_id uuid not null references documents(id) on delete cascade,
  page_number int not null,
  chunk_index int not null,
  content     text not null,
  embedding   vector(1536) not null
);

create index on chunks using hnsw (embedding vector_cosine_ops);

create or replace function match_chunks(query_embedding vector(1536), match_count int default 5)
returns table (id bigint, document_id uuid, filename text, page_number int, content text, similarity float)
language sql stable as $$
  select c.id, c.document_id, d.filename, c.page_number, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join documents d on d.id = c.document_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Version 2 : journal de l'agent
create table if not exists agent_runs (
  id           bigserial primary key,
  question     text not null,
  tools        jsonb not null default '[]',  -- [{tool, input, result, ms}]
  answer       text,
  found        boolean,
  source_count int,
  duration_ms  int,
  created_at   timestamptz default now()
);

-- Version 3 : sécurité ------------------------------------------------------

-- Rôles des utilisateurs (Supabase Auth). Sans ligne ici, un utilisateur connecté a le rôle "user".
create table if not exists profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz default now()
);

-- L'interface contient maintenant la clé publique (publishable) de Supabase.
-- Sans RLS, cette clé permettrait de lire ou supprimer les tables directement, en contournant FastAPI.
-- RLS activé + aucune politique = aucun accès avec la clé publique. Le backend (clé secrète) n'est pas concerné.
alter table documents  enable row level security;
alter table pages      enable row level security;
alter table chunks     enable row level security;
alter table agent_runs enable row level security;
alter table profiles   enable row level security;

-- La recherche vectorielle ne doit être appelable que par le backend.
revoke execute on function match_chunks(vector, int) from public, anon, authenticated;
