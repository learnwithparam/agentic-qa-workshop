# Pantry Run API tests

- The contract is `../../../../world/openapi.yaml`. It is the source of truth, not the running shop.
- API tests live in `tests/api/` and start with `// spec: world/openapi.yaml`.
- Use Playwright's `request` fixture. Never open a page in an API test.
- Reset the shop before each test with `request.post("/__test/reset")`.
- The partner key is `pantry-partner-key`, sent as `Authorization: Bearer pantry-partner-key`.
- Never write a test that expects what the shop does today when the contract says something else.
