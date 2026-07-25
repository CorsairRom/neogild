---
name: Neogild
description: Sober, restrained dashboard for self-hosted Chilean personal finance tracking.
colors:
  background: "oklch(0.985 0.004 30)"
  foreground: "oklch(0.19 0.012 30)"
  accent: "oklch(0.38 0.09 325)"
  accent-hover: "oklch(0.32 0.09 325)"
  accent-foreground: "oklch(0.98 0.005 325)"
  positive: "#059669"
  warn: "#d97706"
  negative: "#e11d48"
  transfer-info: "#2563eb"
typography:
  body:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.05em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
---

# Design System: Neogild

## 1. Overview

**Creative North Star: "The Quiet Ledger"**

Neogild is a single-user financial dashboard, not a marketing surface — the design serves the task of seeing where money went and confirming it's right. The system is deliberately restrained: near-neutral surfaces, one deep accent used sparingly for primary actions, and semantic color (emerald/amber/rose/blue) reserved strictly for financial state, never for decoration. This rejects two failure modes named explicitly in PRODUCT.md's anti-references: the cold, distant "corporate banking" chrome (avoided by warming the neutrals and giving the product one considered accent instead of institutional blue-gray), and, by extension, the generic unstyled-scaffold look the project shipped with before this pass (flat Tailwind zinc grays with no committed identity).

**Key Characteristics:**
- Restrained color strategy: tinted neutrals + one accent, used on primary actions and current-selection only
- Flat by default; borders (not shadows) separate surfaces
- One type family end to end — no display/body pairing, because this is a tool, not a story
- Dark mode is a first-class target, not a media-query afterthought

## 2. Colors

The palette is almost entirely neutral, warmed by a single hue (325, a muted plum) that carries both the brand accent and the neutral tint — so the whole system reads as one considered decision, not a gray shell with a color bolted on.

### Primary
- **Quiet Plum** (`oklch(0.38 0.09 325)` light / `oklch(0.62 0.11 325)` dark): the only brand-carrying color. Used for primary buttons and their hover state only — never for decoration, never for more than one element per screen. Verified contrast against its own foreground: 9.9:1 (light), 5.1:1 (dark).

### Neutral
- **Warm Paper** (`oklch(0.985 0.004 30)` light / `oklch(0.16 0.006 30)` dark): page background, tinted toward the brand's own hue rather than generic gray or AI-default cream.
- **Warm Ink** (`oklch(0.19 0.012 30)` light / `oklch(0.94 0.004 30)` dark): body text and headings.
- Borders and secondary text continue to use Tailwind's zinc scale (200/300/500/800) at low opacity — unchanged, already coherent.

### Semantic (financial state — not decorative)
- **Positive** (`#059669`, emerald): income, positive deltas, "matches the cartola."
- **Warn** (`#d97706`, amber): needs review, unreconciled, pending — never blocking, always calm.
- **Negative** (`#e11d48`, rose): expenses, overspend, mismatched reconciliation.
- **Transfer info** (`#2563eb`, blue): transfer-type badges only. This is the one place blue appears; it is never used as a primary/brand color, precisely because PRODUCT.md names "distant blue-corporate chrome" as an anti-reference.

### Named Rules
**The One Accent Rule.** Quiet Plum appears on primary actions and nowhere else. If a screen has more than one plum element, something has drifted.
**The Semantic Lock Rule.** Emerald/amber/rose/blue mean income/warn/expense/transfer everywhere, always. Never repurpose a state color for a non-state UI element (buttons, nav, decoration).

## 3. Typography

**Body/UI Font:** Geist Sans (with `system-ui, sans-serif` fallback)
**Tabular/Mono Font:** Geist Mono (loaded as a token; reserved for future dense-numeric or code contexts, not yet applied anywhere distinct from body)

**Character:** One family carries headings, labels, body, and financial data — deliberately, per product-register convention. The tool should disappear into the task; a second display face would be a costume, not a hierarchy.

### Hierarchy
- **Title** (semibold, `text-2xl`/`1.5rem`, tight tracking): page titles in AppShell.
- **Body** (regular, `text-sm`/`0.875rem`): all prose, descriptions, table cells.
- **Label** (medium, `text-xs`/`0.75rem`, uppercase, `0.05em` tracking): the "NEOGILD" wordmark and column headers only.
- **Numeric** (semibold, `tabular-nums`): all monetary values, so digits align in columns regardless of typeface — this is the one deliberate typographic rule beyond the single-family default.

### Named Rules
**The Tabular Money Rule.** Every rendered amount uses `tabular-nums`. Financial figures must align vertically; this is non-negotiable in a ledger-shaped product.

## 4. Elevation

Neogild is flat by default. Surfaces are separated by a 1px border (`border-zinc-200` / `dark:border-zinc-800`), not shadow — consistent with the Restrained strategy and with a product register where density matters more than depth cues. The two exceptions are functional, not decorative: the primary button carries a subtle `shadow-sm` to read as raised/actionable, and floating chart tooltips use `shadow-lg` because they sit above content with no border context to anchor them.

### Named Rules
**The Border-Not-Shadow Rule.** Card and container separation is a 1px border. Reach for shadow only when an element floats above content with nothing else to anchor it (tooltips, not cards).

## 5. Components

### Buttons
- **Shape:** rounded corners, 6px radius.
- **Primary:** Quiet Plum background, `accent-foreground` text, `shadow-sm`, hover darkens (light) / lightens (dark) toward `accent-hover`. Disabled: reduced opacity, cursor-not-allowed. Two sizes — `md` (`px-4 py-2 text-sm`) for standalone actions, `sm` (`px-2.5 py-1 text-xs`) for inline/table-row actions.
- **Secondary:** transparent background, 1px zinc border, subtle background on hover. Used for every non-primary action (cancel, secondary sync mode, nav-adjacent actions).
- Extracted to `apps/web/src/components/ui/button.tsx` (`Button`, `buttonClasses`) so both variants stay in one place instead of drifting per file.

### Cards / Containers
- **Corner style:** 12px radius (`rounded-xl`).
- **Background:** page background; StatCard tone variants add a tinted `bg-zinc-50/50` (dark: `bg-zinc-900/30`).
- **Border:** 1px, zinc-200/800, or the tone-specific amber/emerald border for StatCard warn/positive states.
- **Internal padding:** 16px (`p-4`).

### Inputs / Fields
- **Style:** 1px zinc border, `rounded-md`, `px-3 py-2`, `bg-white` / `dark:bg-zinc-950`.
- **Focus:** browser-default focus ring today (a real gap — see Do's and Don'ts).
- **Error:** inline red text below the field, not a red border; kept calm rather than alarming per the "sobrio, no urgente" principle.

### Navigation
- **AppNav:** pill-shaped segmented control. Active tab: solid white/zinc-800 background with shadow-sm. Inactive: transparent, muted text, hover darkens text only — never a color change, staying inside the neutral palette.

### StatCard (signature component)
The dashboard's core primitive. Three tones — `default` (neutral border), `warn` (amber border, used for anything needing attention: overspend, unreconciled, pending review), `positive` (emerald border, income). Tone communicates financial state only, per the Semantic Lock Rule; it never carries brand color.

## 6. Do's and Don'ts

### Do:
- **Do** use Quiet Plum only for primary actions and current-selection — never as decoration or a repeated accent.
- **Do** keep emerald/amber/rose meaning income/warn/expense identically everywhere in the app.
- **Do** use `tabular-nums` on every rendered monetary value.
- **Do** separate surfaces with a 1px border, not a shadow.
- **Do** route every primary/secondary button through `components/ui/button.tsx` instead of hand-rolling `bg-zinc-900`/`bg-zinc-100` per file — that drift is exactly what this system replaces.

### Don't:
- **Don't** introduce blue as a brand/primary color. PRODUCT.md names "distant blue-corporate chrome" as the explicit anti-reference; blue stays confined to the transfer-type badge.
- **Don't** use red/rose for anything except negative financial state (expense, overspend, error). It must never become a generic "important" or "delete" color.
- **Don't** add a second display typeface. One family, per the product register's own permission to stay boring on purpose.
- **Don't** use aggressive/alarming treatments (bright red banners, shouting copy) for review queues or discrepancies — the brand personality is "calma, no urgencia," confirmed in PRODUCT.md.
- **Don't** reintroduce the pre-existing pattern of one-off button styling per file; if a new primary action doesn't fit `Button`'s two variants, that's a signal to extend the component, not bypass it.
