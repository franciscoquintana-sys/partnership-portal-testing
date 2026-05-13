import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey ? createClient(url, anonKey) : null

export async function fetchMerchantContent(slug) {
  if (!supabase || !slug) return null
  const { data, error } = await supabase
    .from('merchants')
    .select('slug, name, pain_titles, psps, missing_methods, capability_titles, capability_descs, capabilities_live')
    .eq('slug', slug)
    .maybeSingle()
  if (error) {
    console.warn('[supabase] fetchMerchantContent failed', error)
    return null
  }
  return data
}

// Adapt the merchants-table row into the flat shape the slides already consume
// (PAIN_N_TITLE, PSPS, LOCAL_METHODS_MISSING, CAPABILITY_N_TITLE/DESC).
export function toSlideData(row) {
  if (!row) return null
  const pains = row.pain_titles || []
  const caps = row.capability_titles || []
  const descs = row.capability_descs || []
  return {
    PAIN_1_TITLE: pains[0],
    PAIN_2_TITLE: pains[1],
    PAIN_3_TITLE: pains[2],
    PAIN_4_TITLE: pains[3],
    PAIN_5_TITLE: pains[4],
    PSPS: row.psps || [],
    LOCAL_METHODS_MISSING: row.missing_methods || [],
    CAPABILITY_1_TITLE: caps[0],
    CAPABILITY_1_DESC: descs[0],
    CAPABILITY_2_TITLE: caps[1],
    CAPABILITY_2_DESC: descs[1],
    CAPABILITY_3_TITLE: caps[2],
    CAPABILITY_3_DESC: descs[2],
    CAPABILITY_4_TITLE: caps[3],
    CAPABILITY_4_DESC: descs[3],
    CAPABILITIES_LIVE: row.capabilities_live || [],
  }
}
