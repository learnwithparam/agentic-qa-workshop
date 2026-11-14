# Test the substitution suggester

## The problem

When an item is out of stock, the suggester picks up to three replacements. It is an AI feature, so a different seed can give a different answer. A **seed** is a number that picks one answer. So `toEqual` cannot test it: two good answers can differ. Almond drink is never fine for Ana, because she declared tree nuts (SUB-4).

```mermaid
flowchart LR
  R[read 20 real answers] --> T[tests/ai/suggester.spec.ts]
  T -->|5 items x 3 shoppers x 20 seeds| S[/api/suggest]
  T --> A{any allergen?}
  A -->|yes| X[red: hard fail]
  A -->|no| P{pass rate at least<br/>minPassRate?}
  P -->|yes| G[green]
  P -->|no| X
```

## Watch it done

For example, semi-skimmed milk is fine for Ana when whole milk is out.

## Your turn

Get Claude Code to read 20 real answers and note how they fail. Then get a test of the rules, not exact answers. You write no test code.

Start the release candidate in one terminal:

```bash
BUGS=release bun run shop
```

Expect: `Pantry Run ready on http://localhost:4173 (bugs: 16 on)`

Start Claude Code in this folder:

```bash
claude
```

Expect: Claude Code reads `CLAUDE.md`.

Ask it to read before it tests:

```text
Call /api/suggest on http://localhost:4173 for 20 answers: MLK-WH2 for ana, seeds 1 to 10,
and JUI-ORA for ana, seeds 1 to 10. For each answer, check SUB-3 to SUB-7 and fill one row
in the table in qa/ai-notes.md: the suggestions, pass or fail, and the rules it breaks.
Then list each failure kind under ## Failure kinds. Write no test yet.
```

Check a row yourself, for example `http://localhost:4173/api/suggest?sku=MLK-WH2&shopper=ana&seed=1`. Then:

```text
Write qa/ai-thresholds.json with seeds 20, minPassRate 0.95 and hardFail ["allergen"].
Then write tests/ai/suggester.spec.ts. Ask every out-of-stock item for every shopper and
seed. Allergens are a hard fail: collect every hit and expect none. The other rules count
toward the pass rate. Read both limits from qa/ai-thresholds.json.
```

Restart the shop, then run:

```bash
bunx playwright test tests/ai
```

Expect: `1 passed`

## Write the spec first

Have Claude Code interview you first, then save `SPEC.md` with a Goal, Out of scope, Questions and a Stop condition for `/goal`.

## Do it on your work

Write down the rules of one AI feature in your app before any test.

## Done when

- `qa/ai-notes.md` has 20 rows that match the real answers, and names 2 failure kinds.
- `qa/ai-thresholds.json` has 20 seeds, a pass rate from 0.9 to below 1, and `allergen` in `hardFail`.
- The test passes on the fixed build, goes red on `ai-allergen`, and goes red on a single allergen.
- It stays green when a good answer comes back in another order.
- `SPEC.md` has a goal, what is out of scope, three answered questions and a stop condition for `/goal`.

Run the check from the repo root:

```bash
bun run verify test-the-substitution-suggester
```

Expect: `Done. All 11 rules pass.`

![The check passing](../images/expected.png)

## Solution

The finished answer is in `solution/`. Read it after you pass, not before.

## If you get stuck

| What you see                               | Fix                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| A wrong row for `MLK-WH2`, ana, seed 1     | Ask Claude Code to call that seed again.                                 |
| `FAIL one allergen in all the answers ...` | The allergen sits inside the pass rate. Ask for a separate list of hits. |
| `FAIL a different but valid answer ...`    | The test compares with saved answers. Ask it to check the rules instead. |
