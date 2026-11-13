# What the agents cost

Three `claude -p` runs on the basket area of Pantry Run. Every number comes from a result in `qa/runs/`. Cost is
Claude Code's own estimate, `total_cost_usd`. On a Claude plan it is not a bill, but it is the right size.

| Agent    | Tokens | Minutes | Cost (USD) |
| -------- | ------ | ------- | ---------- |
| plan     | 468729 | 3.1     | 0.81       |
| generate | 243529 | 2.7     | 0.55       |

Total cost: $1.35

Kept tests: 21

Cost per kept test: $0.06

## What we learned

- Planning cost the most. The planner walked the shop in a browser to write 21 scenarios.
- The number to watch is cost per kept test. A cheap run that writes tests we later drop is not cheap.
