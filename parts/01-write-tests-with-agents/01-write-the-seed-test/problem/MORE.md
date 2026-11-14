# Write the seed test: the second half

Do this after the seed passes. A **saved sign-in** is a file of cookies made with `storageState`. A test that loads it starts already signed in, so it skips the Sign in page.

Ask Claude Code:

```text
Add tests/saved-sign-in.spec.ts. One test signs in as Ana and saves it with
page.context().storageState({ path: ".auth/ana.json" }). A second test uses
test.use({ storageState: ".auth/ana.json" }), opens /basket, and expects "Signed in as".
```

Run the tests again:

```bash
bunx playwright test
```

Expect: `3 passed`

Then run `bun run verify write-the-seed-test`.

Expect: `Done. All 8 rules pass.`
