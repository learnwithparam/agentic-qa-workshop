---
paths: tests/api/**
---

# Rules for the API tests

- Use Playwright's `request` fixture. Never open a page in an API test.
- Start each file with `// spec: world/openapi.yaml`.
- Reset the shop before each test with `request.post("/__test/reset")`.
- Send the partner key as a Bearer token in the `Authorization` header.
- Never expect what the shop does today when the contract says something else.
