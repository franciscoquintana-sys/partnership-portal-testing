// Walks the deck's DOM after each render and replaces visible text with
// translations from /api/translate. Brand names, URLs, and numbers are
// kept in English by adding [data-no-translate] on the parent (or just by
// being inside <code>, <a>, or any element with a known brand class).
//
// The hook is intentionally lightweight — it batches one API call per slide
// transition, caches by (lang, text) on the server, and re-runs when the
// language or slide index changes.

import { useEffect } from 'react'

const NO_TRANSLATE_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'NOSCRIPT'])

// Matches strings that look purely numeric / code-like / URL — these
// stay in English regardless of locale.
const SKIP_PATTERNS = [
  /^\s*$/, // whitespace-only
  /^[\d.,%$€£¥+\-→←✓✗ \t]+$/, // numbers, currency, arrows
  /^https?:\/\//i, // URLs
  /^[A-Z0-9_-]{1,8}$/, // short ALL-CAPS codes / acronyms (USD, BRL, GDP)
]

function shouldSkip(text) {
  if (!text) return true
  const trimmed = text.trim()
  if (trimmed.length < 2) return true
  // Pure brand / acronym — letters but no spaces and short
  if (trimmed.length < 4 && !/[\s]/.test(trimmed)) return true
  for (const p of SKIP_PATTERNS) {
    if (p.test(trimmed)) return true
  }
  return false
}

function collectTextNodes(root) {
  const out = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.nodeValue
      if (shouldSkip(text)) return NodeFilter.FILTER_REJECT
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (NO_TRANSLATE_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT
      if (parent.closest('[data-no-translate]')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  let n
  while ((n = walker.nextNode())) out.push(n)
  return out
}

// Per-language client-side cache so React re-renders within the same slide
// don't refetch the translations we already have.
const clientCache = new Map() // key: `${lang}:${text}` -> translated

export function useAutoTranslate(lang, deps = []) {
  useEffect(() => {
    if (!lang || lang === 'en') return
    let cancelled = false

    const run = async () => {
      // Wait two animation frames so React has finished painting the slide.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      if (cancelled) return

      const nodes = collectTextNodes(document.body)
      if (nodes.length === 0) return

      // Capture the originals once so re-running translation on the same
      // node uses the English source, not a previously-translated value.
      const originals = nodes.map((n) => {
        if (!n._origText) n._origText = n.nodeValue
        return n._origText
      })

      // Split into cached vs uncached.
      const uncachedTexts = []
      const uncachedIdxs = []
      originals.forEach((t, i) => {
        const key = `${lang}:${t}`
        if (clientCache.has(key)) {
          nodes[i].nodeValue = clientCache.get(key)
        } else {
          uncachedTexts.push(t)
          uncachedIdxs.push(i)
        }
      })

      if (uncachedTexts.length === 0) return

      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: uncachedTexts, lang }),
        })
        if (!res.ok) return
        const j = await res.json()
        const translations = Array.isArray(j?.translations) ? j.translations : []
        if (cancelled) return
        translations.forEach((t, i) => {
          if (typeof t !== 'string') return
          const srcIdx = uncachedIdxs[i]
          const src = uncachedTexts[i]
          clientCache.set(`${lang}:${src}`, t)
          if (nodes[srcIdx]) nodes[srcIdx].nodeValue = t
        })
      } catch (_) {
        // best-effort — silent failure leaves the English text in place
      }
    }

    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, ...deps])
}
