# Playwright MCP or Playwright CLI

The token numbers come from a blog post we read, not from our runs.

|               | MCP   | CLI    |
| ------------- | ----- | ------ |
| Tokens        | 27000 | 114000 |
| Turns         | 24    | 16     |
| Seconds       | 43    | 77     |
| Cost (USD)    | 0.38  | 0.34   |
| Findings      | 3     | 3      |
| Real findings | 3     | 2      |

Tokens are input, output, cache writes and cache reads added up. Cost is Claude Code's own estimate in
`total_cost_usd`. On a Claude plan it is not a bill.

## What we saw

- Both runs found the two bugs the task aimed at: the quantity box takes -1, and a double click books two slots.
- The MCP run also found a real bug outside the task: the slot radio buttons have no name (`missing-label`).
- The CLI run reported one false finding. It said an empty basket charges for delivery. That was the two
  slots it had just booked twice, so it is the same double-book bug, not a new one.
- The CLI run used fewer turns but more tokens, because it read large page snapshots with `cat`.

## Choice

The team uses MCP for exploring. On this shop it found more real bugs, with no false finding, and it was faster.
Its token count was lower too. We use the CLI when an agent writes tests, where short commands keep the context
small. We run this comparison again when Playwright or the shop changes.
