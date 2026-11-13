# Pantry Run test suite

You write Playwright tests for Pantry Run, a grocery delivery shop. The written rules are in `requirements/`
(SLOT, BASK and SUB IDs). They are the source of truth: never edit them to match a test.

## The shop

- Open the shop at the `BASE_URL` in the environment, or `http://localhost:4173`.
- Test shopper: `ana@pantryrun.test`, password `pantry`. Sign in at `/signin`.
- `POST /__test/reset` puts the data back to the seed. Call it at the start of every test.
- `POST /__test/clock` with `{ "at": "<ISO time>" }` moves the store clock. The clock is frozen otherwise.
- `tests/seed.spec.ts` shows the start every test copies: reset, sign in, open the basket.

## Plans

One plan per area in `specs/`: `specs/slots.md` and `specs/basket.md`. Under every scenario heading
(`#### 1.1 <title>`) put these two lines, then numbered steps and an Expected part:

```markdown
**Covers:** SLOT-2
**Kind:** boundary
```

`Kind` is `happy`, `boundary` (where a rule flips: the 20th order, 22:00, $25.00) or `negative`. Cover every
requirement ID at least once, and plan at least one boundary per file.

## Tests

- One file per plan: `tests/slots.spec.ts` and `tests/basket.spec.ts`. The first line is `// spec: specs/<plan>.md`.
- Each test title is its scenario title, without the number.
- Find elements with `getByRole`, `getByLabel`, `getByText` or `getByTestId`. No CSS, no XPath.
- No `waitForTimeout`. Let `expect` wait.
- No `test.skip` or `test.fixme`. A test that fails on a rule is a finding: say so, do not hide it.
- Every test checks what the shopper would notice (a total, a message, a state), not only that a click worked.
- Run `bunx playwright test` and keep going until every test passes.
