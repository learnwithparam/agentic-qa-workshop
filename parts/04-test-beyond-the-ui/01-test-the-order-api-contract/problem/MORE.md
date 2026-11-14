# Test the order API contract: the second half

Do this after the API tests pass. A **mock** is a call your test answers itself, so you can make a service fail on purpose.

Ask Claude Code:

```text
Add tests/mocked/slot-booking.spec.ts. Sign in as Ana, open /slots, and use page.route to
answer POST **/api/slots/*/book with status 503 and a message. Pick a slot, press Book,
and expect the alert to show that message and the page to stay on /slots.
```

```bash
bunx playwright test tests/mocked
```

Expect: `1 passed`

Then run `bun run verify test-the-order-api-contract`.

Expect: `Done. All 8 rules pass.`
