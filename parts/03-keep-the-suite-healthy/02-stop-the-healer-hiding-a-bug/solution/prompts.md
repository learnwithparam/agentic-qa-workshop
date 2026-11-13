# How Claude Code got here

You edited no test. You let the healer look at the 7 red tests, read why it stopped, and asked Claude Code for
the bug report.

This solution is a real run: two prompts in one session. The recording is in
`../../recordings/stop-the-healer-hiding-a-bug/`.

## The prompts

With `RELEASE=v2 bun run shop` running, you started `claude` in this step's `problem/` folder and typed:

```text
Seven tests in tests/substitutions.spec.ts still fail on release v2, which is running on http://localhost:4173. Use the playwright-test-healer agent to fix them.
```

Then:

```text
Agreed: keep the tests as they are. Write a bug report for the developers in qa/bugs/SUB-1.md with these headings:
## Steps (numbered, starting from a fresh shop on release v2, signed in as ana@pantryrun.test)
## Expected (quote the rule word for word from ../../../../world/requirements/substitutions.md)
## Actual (what the basket and the order page show, with the exact words)
## Requirement (the ID, and the 7 tests that fail because of it)
Before you write Actual, tick "Allow substitutes" by hand in one test run, so you know whether substitution then works.
Do not change any test.
```

## What Claude Code reported

After the first prompt, the healer made no edit. Claude Code said why:

```text
None of the 7 failures is caused by the tests, so editing them would only have hidden a
real bug in v2. In v2, a new basket item starts with "Allow substitutes" switched off.
The fixes we declined:
- Ticking the switch in tests 2.1-2.4: they would pass, but SUB-1 would no longer be checked.
- Changing the expected text to "Not available" or "unchecked": this would turn the bug
  into the expected behaviour. The guard in qa/guard.ts would also block it.
```

So the guard never had to fire. That is the best case, but you cannot count on it. On another run the healer may
try the flip, and then the guard is what stops it.

After the second prompt, it ticked the box by hand in one run. Every item was then substituted correctly. So the
report says exactly what is broken: only the box's starting value.

## What you checked

- `diff -r ../problem/tests tests` is empty.
- The report quotes SUB-1 word for word and lists all 7 failing tests with their line numbers.
- It says that the two SUB-2 tests cannot reach their own checks yet, so SUB-2 is untested on v2, not broken.

One edit by hand: the report quoted the basket row with em dashes, and the course style has none. They became
commas.

## What you would reject

- Flipping the expect to `not.toBeChecked()`. See `wrong/flipped-the-default/`.
- `test.fixme` on the SUB-1 test. See `wrong/fixme-and-report/`.
- A report with no Expected and no Requirement: "substitutions are broken". See `wrong/vague-report/`.
