# SUB-1: New basket lines start with "Allow substitutes" switched off

Release v2. Every new basket line starts with "Allow substitutes" switched off. That includes
in-stock items such as Ground coffee 227 g. As a result, out-of-stock items show "Not available"
on the order page when they should be substituted. Substitution itself still works: if the
shopper ticks the switch by hand, every line is substituted correctly.

## Steps

1. Start from a fresh shop on release v2 (`POST http://localhost:4173/__test/reset`).
2. Sign in at `/signin` as `ana@pantryrun.test` with password `pantry`. The page shows "Signed in
   as Ana Torres".
3. On the shop (`/`), click "Add" on Whole milk 2 L. This item is out of stock.
4. Open the basket (`/basket`). Leave the "Allow substitutes" switch alone.
5. Add Ground coffee 227 g, set its quantity to 6 and click "Update Ground coffee 227 g". This
   brings the order above the $25.00 minimum.
6. Go to `/slots`. Click "Choose a delivery time", pick "Mar 12 09:00 to 10:00", then click
   "Reserve".
7. On the basket, click "Checkout".

## Expected

From `world/requirements/substitutions.md`:

> SUB-1: Every new basket line starts with "Allow substitutes" switched on.

So at step 4, "Allow substitutes" should be ticked for Whole milk 2 L. At step 7, the order page
should show Whole milk 2 L as "Substituted with Semi-skimmed milk 2 L".

## Actual

**Basket (step 4).** The "Allow substitutes" checkbox for Whole milk 2 L is unticked. Its
accessible name is "Allow substitutes for Whole milk 2 L". Every other line added in a fresh
session is unticked as well. I checked Smooth peanut butter 340 g, Oat granola 500 g, Orange juice
1 L, Free range eggs, 6 and Ground coffee 227 g, which is in stock. The out-of-stock lines read:

> Whole milk 2 L, Out of stock at the store, Suggest replacements, Allow substitutes (unticked)

**Order page (step 7).** The Packing cell for Whole milk 2 L reads:

> Not available

The expected text is "Substituted with Semi-skimmed milk 2 L". The other out-of-stock items behave
the same way. Smooth peanut butter 340 g, Oat granola 500 g, Orange juice 1 L and Free range
eggs, 6 all show "Not available".

**With the switch ticked by hand.** I ran the steps once more with five out-of-stock items in the
basket. This time I ticked "Allow substitutes" for each one before checking out. Each tick sends
`POST /basket/lines/<id>/substitutes` with the body `allow=yes`. The switch stays ticked after a
reload. The order (`/orders/PR-1001`) then showed:

| Item                       | Packing                                      |
| -------------------------- | -------------------------------------------- |
| Whole milk 2 L             | Substituted with Semi-skimmed milk 2 L       |
| Smooth peanut butter 340 g | Substituted with Crunchy peanut butter 340 g |
| Oat granola 500 g          | Substituted with Honey granola 500 g         |
| Orange juice 1 L           | Substituted with Pineapple juice 1 L         |
| Free range eggs, 6         | Substituted with Barn eggs, 6                |
| Ground coffee 227 g        | Packed                                       |

These are exactly the substitutes that SUB-3 to SUB-6 call for. The fault is only the switch's
starting value for a new line. Choosing a substitute and the switch itself both work.

## Requirement

**SUB-1.** These 7 tests in `tests/substitutions.spec.ts` fail on v2 because of it:

| Test                                                                                          | Line | How it fails                                                                                    |
| --------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------- |
| The shopper's choice › A new line allows substitutes and an out-of-stock item is replaced     | 59   | `toBeChecked()` on "Allow substitutes for Whole milk 2 L": expected checked, received unchecked |
| The shopper's choice › Switching substitutes off is respected for a chilled item              | 73   | Times out switching the box off. It is already off, so no form post and no basket reload happen |
| The shopper's choice › Switching substitutes off is respected for an item that is not chilled | 81   | Same timeout as line 73                                                                         |
| What a substitute may be › A substitute comes from the same category                          | 93   | Expected "Substituted with Crunchy peanut butter 340 g", received "Not available"               |
| What a substitute may be › A substitute never contains a declared allergen                    | 102  | Expected "Substituted with Honey granola 500 g", received "Not available"                       |
| What a substitute may be › A substitute costs at most 15% more                                | 112  | Expected "Substituted with Pineapple juice 1 L", received "Not available"                       |
| What a substitute may be › A substitute is in stock                                           | 122  | Expected "Substituted with Barn eggs, 6", received "Not available"                              |

The tests at lines 73 and 81 cover SUB-2. They can't reach their SUB-2 checks until SUB-1 is
fixed, so SUB-2 is untested on v2 rather than known to be broken. The tests are correct as written
and should not be changed. They should pass once new lines start switched on.
