# Pantry Run test playbook

How the Pantry Run team uses Claude Code on its tests. The gate in `qa/gate.ts` enforces the rules it can. People
own the rest.

## Agents may

- Plan scenarios from `requirements/`, with a Covers line and a Kind line for each one.
- Write tests from an approved plan, and run them until they pass on the fixed build.
- Heal a test when the shop moved or renamed something: change locators and nothing else.
- Explore the release candidate inside a charter, and turn each finding into a repro test.

## Agents may not

- Remove an expect, or change an expected value, to make a test pass. The guard blocks it.
- Add test.skip or test.fixme, or raise retries, to hide a failing test.
- Edit `requirements/` or `openapi.yaml` to match what the shop does.
- Merge their own pull request.

## Human gates

- The QA lead approves every plan before tests are generated from it.
- A reviewer marks every agent test keep, fix or drop before it merges.
- The QA lead writes the bug report when a healer stops on a real regression, such as SUB-1.
- A person signs `approvedBy` on every flaky test triage.

## Numbers we report

- Tests written by AI: 21 this month.
- Mutation score: from the gate, against Stryker's break threshold of 70.
- Number of tests in the suite: 25.
- Cost per kept test: from `qa/cost.md`, today $0.08.
