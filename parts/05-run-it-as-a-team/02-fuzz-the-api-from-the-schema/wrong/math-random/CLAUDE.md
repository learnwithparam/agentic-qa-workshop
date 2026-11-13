# Fuzzing the Pantry Run partner API

- The contract is `../../../../world/openapi.yaml`. Fuzz `POST /api/orders` against its `OrderIn` schema.
- Fuzz tests live in `tests/fuzz/` and use Playwright's `request` fixture. Reset the shop once at the start.
- The partner key is `pantry-partner-key`, sent as `Authorization: Bearer pantry-partner-key`.
- Every answer must be a status the contract lists for that path. A 500 is never allowed.
- Random must be repeatable: a small generator that starts from a fixed seed, never `Math.random`.
- Draw values from the shop's real data too (`GET /api/slots`, `GET /api/products`), not only random text.
- On a failure, print the seed and the exact order body, so anyone can replay it.
