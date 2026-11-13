# Exploring Pantry Run

- The shop runs on http://localhost:4173. Sign in as ana@pantryrun.test with password pantry.
- Reset the shop with `curl -X POST http://localhost:4173/__test/reset` before each idea you try.
- Explore with the `playwright` MCP browser. Stay inside the charter in `qa/explore/charter.md`.
- Write down what you saw before you guess why. A finding is a step list, what you expected and what happened.
- Each finding becomes one repro test in `qa/explore/<finding>.spec.ts`. It starts with `// finding: <one line>`.
- A repro test checks what should happen. It must pass on a fixed shop and fail on the shop you explored.
- Shared steps go in `qa/explore/shop.ts`. Use getByRole, getByLabel and getByTestId, never CSS.
