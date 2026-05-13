# Design Principles

A condensed checklist for the Stripe Sessions deck. ~30 rules distilled from
Refactoring UI (Wathan/Schoger), Linear/Vercel/shadcn restraint, Tufte's data-viz
canon, and McKinsey presentation conventions — tuned to Yuno's brand tokens.

When in doubt: **80% Linear-restraint, 20% Refactoring UI**. Presence of a rule
is more important than its pedigree — a slide either clears the checklist or it
doesn't.

---

## Typography

1. **Hierarchy by weight and color first, size second.** A 700 at full-white reads
   as heading against a 400 at 60% opacity. Don't jump font sizes to create
   emphasis — you usually don't have the room.
2. **Max two fonts.** `var(--font)` for body, `var(--font-display)` for headings
   and numerals. No third typeface, no italic for emphasis.
3. **Numerals get `font-variant-numeric: tabular-nums`** so digits align across
   rows/columns. Always. Stat tables look broken without it.
4. **Titles have no trailing period.** McKinsey rule: `.` implies a complete
   sentence; titles are fragments.
5. **No em-dashes `—` in body copy.** Use commas or restructure. (Yuno house
   style — long dashes read as machine-generated.)
6. **Letter-spacing**: tight (`-0.6 to -1.8px`) for large display; normal at body;
   `+1.2 to +2.2px` + uppercase for labels/tags.

## Color & contrast

7. **One accent per slide.** If the purple gradient is doing work, the pink one
   should sit out. Competing accents read as decoration, not meaning.
8. **Use opacity to create tonal scales, not separate greys.** `rgba(255,255,255,
   0.04 / 0.08 / 0.12 / 0.24 / 0.48 / 0.72 / 1)` covers surface, divider,
   border, secondary-text, primary-text. One palette, many tones.
9. **Saturate only what you want read.** The accent gradient belongs on 1-2
   elements: title word, key stat, CTA. Anything else in purple is noise.
10. **Contrast minimums**: body text ≥ 4.5:1 against its surface (AA). Secondary
    text can be lighter but must still clear 3:1.
11. **No pure black, no pure white.** Body type is `rgba(255,255,255,0.72-0.92)`;
    backgrounds are `#05071A` / `#0B0E2E` — off-black gives the subtle warmth
    the brand uses.

## Spacing & alignment

12. **4 / 8 / 16 / 24 / 32 / 48 / 72 px scale.** Any gap, padding, or margin
    that isn't on this ladder is probably wrong. `clamp()` should snap to these
    at both ends. No `11px` / `13px` / `17px` spacing.
13. **Optical alignment over mathematical.** Circular avatars and triangular
    glyphs often need -1 to -2px nudges to look aligned. Trust your eye.
14. **Left-edge anchor per slide.** All title/body/labels should share a single
    left edge unless the layout explicitly contrasts. No drifting paragraphs.
15. **Group related items tighter than the gap to the next group.** If stat
    labels are 6px from their numbers but stat groups are 18px apart, the
    grouping reads. 12/12/12 reads as soup.

## Depth & surfaces

16. **Prefer shadow + opacity to borders for depth.** `box-shadow: 0 24px 72px
    rgba(0,0,0,0.4)` on a card with `rgba(255,255,255,0.02)` fill reads lifted
    without the `1px solid rgba(255,255,255,0.12)` outline fighting the bg.
17. **One border weight.** Pick `1px rgba(255,255,255,0.06-0.12)` for all
    surface edges. Varying widths look like different tiers when they aren't.
18. **Glow is earned, not decorated.** `boxShadow: '0 0 24px rgba(107,114,255,
    0.3)'` belongs on the element you want the audience to look at next. On
    every card, it's noise.
19. **Backdrop-filter is a tax.** `blur(12-24px)` is fine on 1-2 floating
    elements; on everything it slows the frame and flattens the hierarchy.

## Motion

20. **Motion communicates state change.** Page transitions, reveal-on-enter,
    hover feedback. Infinite loops (marquees, pulsing everything) usually don't.
21. **Durations 150-500ms, ease-out or custom cubic-bezier.** `linear` is for
    progress bars. `ease-in-out` is for loops. `cubic-bezier(0.32, 0.72, 0, 1)`
    is the Yuno house curve.
22. **Stagger children, not slides.** Slide-level: one crossfade. Child-level:
    60-100ms per child feels alive; 200+ feels laggy. Cap stagger at 5 children.
23. **Reduce motion when requested.** `@media (prefers-reduced-motion: reduce)`
    disables ambient loops. The deck must work silent.

## Data visualization

24. **Chart junk = delete.** Remove: gridlines > 1px, 3D, gradients on bars/
    lines, legends you could inline-label, chartborders, shadows on data.
25. **Label directly at the data point.** A callout reading "98.7% (Stripe)"
    next to the bar beats a separate legend every time.
26. **Encoding redundancy is OK when it helps.** A bar's height + color saturation
    + label all saying "big number" isn't chartjunk — it's emphasis. But color
    without meaning is.
27. **Small multiples > dual-axis.** If you're tempted to plot two units on the
    same chart, split into two aligned small charts instead.

## Presentation conventions

28. **One idea per slide.** Title should be read in 2 seconds and summarize the
    payload. If you need a sub-headline to explain the title, the title is wrong.
29. **No vestigial UI.** If a button/tab/toggle is in a screenshot but doesn't
    matter to the story, crop or dim it. Every pixel is either earning its keep
    or stealing attention.
30. **Bottom-left slide number, bottom-right section label, top-right brand.**
    Consistent wayfinding across the deck — audience can track progress
    without scanning for it.

---

## Yuno brand tokens (source of truth)

| Token | Value | Use |
|---|---|---|
| `--yuno-blue` | `#3E4FE0` | Hero accent, CTA, key stats |
| `--yuno-deep-blue` | `#1726A6` | Deep-blue backgrounds / emphasis |
| `--yuno-mid-blue` | `#5967E4` | Hover / secondary |
| `--yuno-soft-blue` | `#7C89EF` | Borders, faint highlights |
| `--yuno-pale-blue` | `#BDC3F6` | Gradient mid / tertiary text |
| `--yuno-unity-black` | `#282A30` | Elevated surface / card |
| `--yuno-accent-green` | `#E0ED80` | Only non-blue accent — live/ok states |
| `--bg-base` | `#000000` | Deepest canvas (pure black, matches Final Deck) |
| `--bg-elevated` | `#282A30` | Card surfaces |
| `--font` | `Geist Variable` | Body + display |
| `--font-mono` | `Geist Mono Variable` | Numerals, slide counters, timestamps |

**No pink, no purple, no Stripe-palette literals.** The deck is monochromatic
blue + Accent Green for live states + white/gray opacity scale.

The house gradient, if used at all, is mono-blue (`#3E4FE0 → #5967E4`).
Sparingly: one title word per slide, one key stat, or one active UI state.

---

## How to run a design audit

From the project root with the dev server running on `:5173`:

```bash
# Via the subagent (screenshot + full report):
# (invoked by the main agent with the target slide and merchant name)
```

The audit covers: violations per rule #, severity (blocker/polish/nit),
coordinates/region, and a one-line fix. See `.claude/agents/design-review.md`.
