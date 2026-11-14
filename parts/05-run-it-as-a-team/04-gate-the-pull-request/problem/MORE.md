# Gate the pull request: the second half

Do this after the gate works. Three things keep a team gate fast and honest.

- **Shard**: one slice of the suite. Shards run at the same time on different machines.
- **Trace**: a recording of a failed run. CI keeps it so a person can open it later.
- **Quarantine**: a short list of flaky tests moved out of the gate. Each has an owner and an end date.

Ask Claude Code:

```text
In ci/pull-request.yml add a job that runs playwright test in four shards and skips @quarantine.
On failure, upload playwright-report and test-results. Then write qa/flake-policy.json with
retries 0, a maxQuarantined limit, and for each quarantined test: test, owner, reason, expires.
```

Expect: a `shards` job with `--shard=${{ matrix.shard }}/4`, an upload step with `if: failure()`, and a policy file with an end date on every entry.

Then run `bun run verify gate-the-pull-request`.

Expect: `Done. All 11 rules pass.`
