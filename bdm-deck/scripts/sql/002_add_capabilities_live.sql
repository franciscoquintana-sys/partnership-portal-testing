-- Adds a text[] column that stores which capabilities each merchant has
-- LIVE today (based on public research). Slide 3 renders a chip per
-- CAPABILITY_DEFS entry on SlideDiagnostic and lights up the ones whose
-- slug appears in this array. Missing slugs render as muted "missing"
-- chips — those are the upsell opportunities for Yuno on that merchant.
--
-- Allowed slugs (match CAPABILITY_DEFS in SlideDiagnostic.jsx):
--   payouts · subscriptions · tokenization · fraud · kyc · kyb · baas
--
-- Default = empty array so existing rows stay valid. The research script
-- (scripts/research-capabilities.mjs) will populate this per merchant by
-- reading /Users/isabellapdl/Desktop/Stripe Sessions Decks/Research/<Name>/
-- and sending the material to Claude for structured extraction.

alter table public.merchants
  add column if not exists capabilities_live text[] not null default '{}';
