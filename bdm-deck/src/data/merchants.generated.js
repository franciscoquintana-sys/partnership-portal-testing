// Merchant data stripped from the vendored deck — the portal embeds the
// region/bank/partner experience only. These exports are stubs so the
// build still resolves; merchant lookups simply return null.

export const MERCHANTS = {}
export const MERCHANT_LIST = []

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function resolveMerchant() {
  return null
}
