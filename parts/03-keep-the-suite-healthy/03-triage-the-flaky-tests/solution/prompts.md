# How Claude Code got here

You edited no file. You asked for a diagnosis, checked it, corrected one mistake, and approved the fixes in your
own name.

This solution is a real run: two prompts in one session. The recording is in
`../../recordings/triage-the-flaky-tests/`.

## The prompts

You started `claude` in this step's `problem/` folder and typed:

```text
The legacy suite in tests/ fails now and then, and nobody trusts a red run any more.
Find the flaky tests. Run bunx playwright test --repeat-each=20 --shuffle, and run single tests with --grep.
For each flaky test, find the cause. Use one of these words: race (the test does not wait for what it checks), shared-data (it needs another test to run first), or clock (it depends on the real time of day). Some causes do not show up in every run, so read each test too.
For each one, show me the cause, the evidence and the fix you propose. Do not change any file yet.
```

After you read the diagnosis:

```text
Approved, with one change. For the clock test, 2026-03-10T21:59:00-06:00 is 22:59 in Larkford: on March 10 the store is on daylight time, -05:00. Use the shop's own seeded time instead, 2026-03-10T15:00:00-05:00.
Apply the three fixes. Rules: no retries, no waitForTimeout, no removed expect, and keep each test's title.
Then write qa/triage.json: an array with one entry per flaky test, { "test", "cause", "evidence", "fix", "approvedBy" }. "test" is the exact test title, "cause" is race, shared-data or clock, and "approvedBy" is "Priya Raman (QA lead)".
Prove it: run bunx playwright test --repeat-each=20 --shuffle --grep on the three titles, and show me the result.
```

## The plan Claude Code showed

```text
1. "suggestions appear for out of stock milk": race. It waits a fixed 500 ms, but the
   suggester waits a random 100-800 ms. Failed 13 of 20 with Received string "Thinking...".
   Fix: expect(...).toContainText("Semi-skimmed milk 2 L"), which keeps retrying.
2. "orders page lists my order": shared-data. It needs PR-1001 from another test.
   Fails after a reset. Fix: reset first, and place its own order.
3. "next-date slots are open when the store clock is now": clock. It sets the store
   clock to the real time, so it fails between 22:00 and midnight store time.
   Fix: pin the clock to 2026-03-10T21:59:00-06:00.
```

## What you checked

- Fix 3 was wrong. On March 10 the store is on daylight time, -05:00, so `21:59:00-06:00` is 22:59, after the
  cutoff. You asked for the seeded time, `2026-03-10T15:00:00-05:00`.
- The proof: `--repeat-each=20 --shuffle` on the three titles gave `60 passed`.
- Claude Code said the clock fix cannot be proven by a run at this hour. It is safe because the time is now
  fixed. That is an honest limit, so you accepted it.
- `approvedBy` is a person, Priya Raman (QA lead), not the agent.

## What you would reject

- `retries: 2` in the config. Every run looks green, and nothing is fixed. See `wrong/raised-retries/`.
- `waitForTimeout(1000)` for the race. It is slower and still a guess. See `wrong/longer-sleep/`.
- `approvedBy: "Claude Code"`, and the clock test filed as a race. See `wrong/agent-approved/`.
