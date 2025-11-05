-- Projects capture uploaded repositories and metadata for the developer dashboard
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  repository_url text,
  repository_branch text,
  source_kind text check (source_kind in ('path', 'upload')),
  archive_temp_path text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.projects
  owner to postgres;

comment on table public.projects is 'Developer-uploaded projects tracked by the Customize developer studio.';
comment on column public.projects.archive_temp_path is 'Absolute path to the uploaded archive extracted on the analysis machine.';

create table if not exists public.project_analyses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'pending',
  prompt text,
  summary jsonb,
  result jsonb,
  error_message text,
  source_kind text check (source_kind in ('path', 'upload')),
  source_value text,
  archive_temp_path text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.project_analyses
  owner to postgres;

comment on table public.project_analyses is 'Analysis runs for a given project, including prompt, status, and JSON results.';
comment on column public.project_analyses.summary is 'Trimmed summary for quick cards and list views.';
comment on column public.project_analyses.result is 'Full analyzer payload returned by the agent.';

create index if not exists project_analyses_project_id_idx
  on public.project_analyses (project_id);

create index if not exists project_analyses_status_idx
  on public.project_analyses (status);

-- updated_at maintenance helper
create extension if not exists moddatetime with schema extensions;

create trigger handle_projects_updated_at
  before update on public.projects
  for each row
  execute procedure extensions.moddatetime(updated_at);

create trigger handle_project_analyses_updated_at
  before update on public.project_analyses
  for each row
  execute procedure extensions.moddatetime(updated_at);

