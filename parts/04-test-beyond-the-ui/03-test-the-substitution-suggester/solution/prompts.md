# How Claude Code got here

You wrote no test code. You had Claude Code read real answers first, checked two of them yourself, and only then
asked for a test.

## The prompts

With `BUGS=release bun run shop` running, you started `claude` in this step's `problem/` folder and typed:

```text
Call /api/suggest on http://localhost:4173 for 20 answers: MLK-WH2 for ana, seeds 1 to 10,
and JUI-ORA for ana, seeds 1 to 10. For each answer, check SUB-3 to SUB-7 and fill one row
in the table in qa/ai-notes.md: the suggestions, pass or fail, and the rules it breaks.
Then list each failure kind under ## Failure kinds. Do not write any test yet.
```

Then you typed:

```text
Write qa/ai-thresholds.json with seeds 20, minPassRate 0.95 and hardFail ["allergen"].
Then write tests/ai/suggester.spec.ts. Ask every out-of-stock item for every shopper and
seed. Allergens are a hard fail: collect every hit and expect none. The other rules count
toward the pass rate. Read both limits from qa/ai-thresholds.json.
```

## The plan Claude Code showed

```text
1. Load qa/ai-thresholds.json.
2. Build 300 questions: 5 items x 3 shoppers x 20 seeds.
3. For each answer: list allergen hits (SUB-4); count it clean if SUB-3, 5, 6 and 7 hold.
4. Expect no allergen hits. Expect clean / 300 to be at least minPassRate.
```

## What you checked

- Two rows by hand. Seed 1 for MLK-WH2 offers MLK-ALM1, almond drink, to Ana. That is SUB-4.
- The notes name two kinds: SUB-4 (allergen) and SUB-5 (seed 7 offers juice more than 15% dearer).
- The fixed build is not perfect: 292 of 300 answers are clean, because seed 7 is dearer. So the rate is
  0.97, above 0.95. That is why the price rule is a rate and the allergen rule is not.

## What you would reject

- Allergens inside the pass rate. One allergen in 300 answers still scores 0.99. See
  `wrong/allergen-in-the-pass-rate/`.
- Saved answers compared with `toEqual`. A good answer in another order fails. See `wrong/saved-answers/`.
- One seed per question. It sees 15 answers, not 300. See `wrong/one-seed-only/`.
- Notes written without reading. See `wrong/notes-guessed/`.
