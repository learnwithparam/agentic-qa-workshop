# Spec: tests for the substitution suggester

## Goal

Tests in tests/ai that prove the suggester never offers an item with an allergen the shopper declared, and that
most answers follow the rules.

## Out of scope

- The look of the suggestion list.
- Exact wording of any answer.

## Questions I answered

- Q: Which answers must never happen? A: Any item with an allergen the shopper declared.
- Q: How many seeds is enough? A: At least 20 for each out-of-stock item.
- Q: What counts as a good answer? A: Same category, in stock, and close in price.

## Stop condition

Run `/goal` with this line: every test in tests/ai passes when you run `bunx playwright test tests/ai`, and the
suite goes red when the ai-allergen bug is on.
