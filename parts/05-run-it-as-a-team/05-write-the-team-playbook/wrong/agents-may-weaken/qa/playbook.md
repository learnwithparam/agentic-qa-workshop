# Pantry Run test playbook

How the Pantry Run team uses Claude Code on its tests. The gate in `qa/gate.ts` enforces the rules it can. People
own the rest.

## Agents may

- Plan scenarios from `requirements/`, with a Covers line and a Kind line for each one.
- Write tests from an approved plan, and run them until they pass on the fixed build.
- Heal a failing test in any way that makes it pass, expected values included.
- Explore the release candidate inside a charter, and turn each finding into a repro test.

## Agents may not

- Edit `requirements/` or `openapi.yaml` to match what the shop does.
- Merge their own pull request.

## Human gates

- The QA lead approves every plan before tests are generated from it.
- A reviewer marks every agent test keep, fix or drop before it merges.
- The QA lead writes the bug report when a healer stops on a real regression, such as SUB-1.
- A person signs `approvedBy` on every flaky test triage.

## Numbers we report

- Assertions removed: from the gate. It must be 0 on every merged pull request.
- Mutation score: from the gate, against Stryker's break threshold of 70.
- Flaky failures: from the gate's 10 runs of every new test. It must be 0.
- New tests that catch a planted bug: from the gate. Every new test must catch one.
- Cost per kept test: from `qa/cost.md`, today $0.08.
