-- Per-merchant deck content. Slug (PK) matches the app's resolveMerchant()
-- lookup; the rest is the dynamic content surfaced in SlideDiagnostic and
-- SlideYunoSolve. Logo and display name stay in merchants.generated.js.

create table public.merchants (
  slug               text        primary key,
  name               text        not null,
  pain_titles        text[]      not null,
  psps               jsonb       not null default '[]'::jsonb,
  missing_methods    jsonb       not null default '[]'::jsonb,
  capability_titles  text[]      not null,
  capability_descs   text[]      not null,
  updated_at         timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger merchants_set_updated_at
  before update on public.merchants
  for each row execute function public.set_updated_at();

-- Deck content is public (shown to merchants in sales calls).
-- Anon role gets SELECT only; writes require service_role.
alter table public.merchants enable row level security;

create policy "merchants_public_read"
  on public.merchants
  for select
  to anon, authenticated
  using (true);
