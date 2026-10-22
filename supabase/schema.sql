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
