# How Claude Code got here

You wrote no code. You saw the old gate merge a bad pull request. Then you asked for a gate with five stages,
and tried it on all five planted pull requests.

## The prompt

You started `claude` in this step's `problem/` folder and typed:

```text
Rewrite qa/gate.ts as CLAUDE.md describes. Run these stages in order and stop at the first
block: 1. qa/guard.ts on the diff of every test file between tests/ and the pull's tests/.
2. the mutation score from the pull's report against thresholds.break. 3. the pull's suite
on a fixed shop. 4. the new tests 10 times in a row on one shop. 5. each new test with each
requirement bug on: it must go red at least once. Print PASS or BLOCKED per stage and the
numbers. Then write ci/pull-request.yml that runs bun run gate on every pull request.
Show me the plan first.
```

## The plan Claude Code showed

```text
1. guard: diff -u each test file, main against the pull; reasonToReject on each diff.
2. mutation: (Killed + Timeout) / (Killed + Timeout + Survived + NoCoverage), against break.
3. suite: a private shop with BUGS=none, the pull's tests with TESTS_DIR and BASE_URL.
4. steady: only the new tests, --repeat-each=10, on one fresh shop.
5. catches: each new test alone, with each of the 8 requirement bugs, until one goes red.
Numbers: assertions removed, mutation score, flaky failures, new tests that catch a bug.
```

## What you checked

```text
clean-pull         MERGE: every stage passed.
removes-an-expect  BLOCKED at guard: basket.spec.ts: an expect was removed
mutation-drop      BLOCKED at mutation: mutation score 61 (break at 70)
flaky-test         BLOCKED at steady: new tests failed 9 of 10 runs on the fixed build
catches-nothing    BLOCKED at catches: "the shop lists bananas" catches no planted bug
```

- The flaky test passes once and fails after that, because it never resets the shop. One run would merge it.
- The gate never calls `claude`. It gives the same answer every time.

## What you would reject

- No guard: a deleted `expect` merges. See `wrong/no-guard/`.
- No mutation stage: a score of 61 merges. See `wrong/no-mutation-stage/`.
- New tests run once: the flaky test merges. See `wrong/runs-new-tests-once/`.
