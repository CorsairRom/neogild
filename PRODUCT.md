# Product

## Register

product

## Users

Richard, self-hosted single-user (MVP). Checks the dashboard periodically —
plausibly at night — to see where the month's money went, review
auto-categorized transactions, and reconcile bank statements (cartolas) for
Chilean bank accounts. Not a multi-tenant product; every screen is designed
for one person managing their own finances, not for onboarding strangers.

## Product Purpose

Track personal finances automatically without manual data entry: ingest bank
emails, auto-categorize transactions (LLM-first), reconcile monthly bank
statements against recorded movements, and surface spending across the
necesidades/consumo/ahorro buckets. Success looks like near-zero manual
bookkeeping — the user only intervenes to review low-confidence
categorizations or resolve statement discrepancies.

## Brand Personality

Sobrio y confiable. Calm, banking-serious, no surprises — inspires trust
with the user's own numbers. Warm enough to feel like a personal tool, not a
distant institution.

## Anti-references

Cold corporate banking UI: overly institutional, distant blue-corporate
chrome, form-over-substance chrome that makes a personal tool feel like a
teller window.

## Design Principles

- **Los números primero.** Hard data (amounts, balances, deltas) always
  outranks decoration. Charts and cards exist to make numbers scannable, not
  to look impressive.
- **Calma, no urgencia.** Review queues and discrepancies are surfaced
  clearly but without alarm — no aggressive red badges or gamified nudges.
- **Confianza sin frialdad.** Sober like a bank statement, but this is the
  user's own tool for their own money — approachable, not distant.
- **Modo oscuro con la misma atención que el claro.** Likely used at night;
  dark mode is a first-class target, not an afterthought media query.
- **Menos fricción, no menos claridad.** Utilitarian and fast, but never at
  the cost of hierarchy or legibility.

## Accessibility & Inclusion

Standard good practice: sufficient contrast, visible focus states, semantic
HTML. No additional formal requirement (e.g. WCAG level) beyond that.
