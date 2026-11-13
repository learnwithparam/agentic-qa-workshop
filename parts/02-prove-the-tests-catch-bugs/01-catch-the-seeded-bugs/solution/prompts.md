# How Claude Code got here

You wrote no test. You read the grid, saw that both misses were substitution rules, and gave Claude Code one job:
plan the substitution rules, then write tests that read the packing note.

This solution is a real run. Claude Code wrote `specs/substitutions.md` and `tests/substitutions.spec.ts` in 28
turns. The recording is in `../../recordings/catch-the-seeded-bugs/`.

## The prompt

You started `claude` in this step's `problem/` folder and typed:

```text
The suite in tests/ is green, but it never checks the substitution rules, so planted substitution bugs go through.
Read ../../../../world/requirements/substitutions.md.
First plan: write specs/substitutions.md in the same format as specs/basket.md, with a scenario for each of SUB-1 to SUB-6. Each scenario has **Covers:** and **Kind:** lines.
Then write tests/substitutions.spec.ts from that plan, in the style of tests/basket.spec.ts.
Each test must check what the shopper sees, for example the exact packing note on the order page ("Not available" or "Substituted with ..."), never only that the order was placed.
Ana (ana@pantryrun.test) declared tree nuts.
Run bunx playwright test and make sure every test passes on the fixed build. Do not change the existing tests.
```

## The plan Claude Code showed

At the end, Claude Code listed one line per scenario and what the order page must show. A short version:

```text
1.1 SUB-1 happy     new lines allow substitutes; Whole milk 2 L is "Substituted with Semi-skimmed milk 2 L"
1.2 SUB-2 negative  substitutes off on Whole milk 2 L (chilled): "Not available"
1.3 SUB-2 negative  the same for Oat granola 500 g, which is not chilled
2.1 SUB-3 negative  peanut butter is replaced by peanut butter, not by milk at the same price
2.2 SUB-4 negative  Oat granola is "Substituted with Honey granola 500 g"; no "Almond" anywhere
2.3 SUB-5 boundary  Orange juice ($2.25, limit $2.58) gets Pineapple juice, not the $3.49 one
2.4 SUB-6 negative  Free range eggs get Barn eggs, which are in stock
```

It also said what it could not prove: it never ran the tests with a bug on. That is your job, and the grid
does it for you.

## What you checked

- Each new test ends in an `expect` on the packing note, the number or line a shopper sees.
- 1.2 and 2.2 read the exact words that change when `sub-optout-chilled` and `sub-allergen` are on.
- Claude Code changed no existing test. `git diff tests/basket.spec.ts tests/slots.spec.ts` is empty.
- The grid now says `8 of 8 bugs caught`, and the fixed build is still green.

## What you would reject

- Tests that place an order and check only "Order placed". They stay green with every bug on. See
  `wrong/checks-the-order-only/`.
- A test written from what the buggy release showed, such as "Substituted with Almond crunch granola". It is
  red on the fixed build, so the grid proves nothing. See `wrong/expects-the-bug/`.
