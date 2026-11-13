# The pull request gate

- `bun run gate <pull-folder>` decides if a pull request may merge. Exit 0 merges, exit 1 blocks.
- This folder's `tests/` is main. A pull folder holds the suite as the pull request leaves it, in `tests/`, and
  the report Stryker wrote for it, in `reports/mutation/mutation.json`.
- `../pulls/` holds five planted pull requests to try the gate on. Never edit them.
- `qa/guard.ts` is the assertion guard from Part 2: `reasonToReject(diff)` returns why a diff is bad, or null.
- The break threshold is `thresholds.break` in `stryker.config.json`.
- Requirement bugs to switch on: slot-cutoff, slot-capacity, weighted-price, promo-stacking, min-order,
  ghost-line, sub-allergen, sub-optout-chilled. Start a private shop with `bun world/server.ts` from the repo root,
  with PORT, BUGS and PANTRY_DATA set. Run the tests with TESTS_DIR and BASE_URL set.
- The gate never calls `claude`. It must give the same answer every time.
