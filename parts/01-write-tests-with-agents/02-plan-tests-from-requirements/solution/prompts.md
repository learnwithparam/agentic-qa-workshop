# How Claude Code got here

You wrote no plan text. You asked Playwright's planner agent for the plans, read them next to the requirements,
and sent Claude Code back for any missing rule.

## The prompts

First you added Playwright's agents, then started `claude` in this step's `problem/` folder:

```bash
bunx playwright init-agents --loop=claude
claude
```

Expect: `.claude/agents/` and `.mcp.json` appear, then Claude Code opens.

The first prompt:

```text
Use the playwright-test-planner agent to plan tests for Pantry Run from
../../../../world/requirements/slots.md and basket.md. Use tests/seed.spec.ts as the seed.
Save specs/slots.md and specs/basket.md. Under every scenario heading add two lines, like this:
**Covers:** SLOT-2
**Kind:** boundary
Kind is happy, boundary or negative. Every SLOT and BASK ID must be covered at least once,
and each file needs at least one boundary or negative scenario.
```

Planners often skip SLOT-3, the 22:00 cutoff, because it needs a clock. When the plan has no SLOT-3 scenario,
send a second prompt:

```text
specs/slots.md has no scenario for SLOT-3, the 22:00 cutoff. Add a boundary scenario
at 21:59 and at 22:00, with Covers and Kind lines.
```

## The plan Claude Code showed

Before it wrote the files, Claude Code listed the scenario groups, like this:

```text
specs/slots.md
  1. Seeing slots: 08:00 to 20:00 for three dates, peak prices, places left
  2. Booking rules: a full slot, the 22:00 cutoff, the slot in the basket, checkout needs a slot
specs/basket.md
  1. Lines and quantities: add twice, the quantity box, remove the last unit, 750 g of bananas
  2. Offers, voucher and minimum: 3 for 2, SAVE10, the total, the $25.00 minimum
```

## What you checked

- You ticked off every ID in `world/requirements/slots.md` and `basket.md` against the Covers lines.
- Every rule with a number has a boundary scenario. For example, "Next-date slots close at 22:00 store time"
  is a boundary for SLOT-3.
- Every scenario has numbered steps and an Expected part.

## What you would reject

- A plan with only happy paths. It covers every ID but never tests where a rule flips. See
  `wrong/happy-path-only/`.
- A plan that skips the cutoff, because it needs a clock. See `wrong/misses-the-cutoff/`.
