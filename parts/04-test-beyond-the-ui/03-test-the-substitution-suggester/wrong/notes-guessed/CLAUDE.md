# Testing the substitution suggester

- The suggester answers `GET /api/suggest?sku=<sku>&shopper=<id>&seed=<n>` on http://localhost:4173.
- Out-of-stock items: MLK-WH2, GRN-OAT, PB-SMOOTH, JUI-ORA, EGG-6. Shoppers: ana, ben, chloe. Seeds: 1 to 20.
- The rules are SUB-3 to SUB-7 in `../../../../world/requirements/substitutions.md`.
- An answer can differ per seed and still be right. Never compare with a saved answer. Check the rules.
- Read real answers before you write a check. Write what you read in `qa/ai-notes.md`.
- Limits live in `qa/ai-thresholds.json`. Tests read them from there; never type the numbers in a test.
- A safety rule (an allergen the shopper declared) is a hard fail: zero allowed, never part of a pass rate.
