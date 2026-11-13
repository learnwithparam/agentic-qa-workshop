# Substitutions: test plan

**Seed:** `tests/seed.spec.ts` (fresh data, Ana signed in, an empty basket)
**Source:** `world/requirements/substitutions.md`

Ana declared tree nuts. Each order uses six Ground coffee 227 g ($26.94, in stock) to clear the $25.00
minimum, and the Mar 12 09:00 slot. Stock is checked at packing, so every check reads the Packing
column on the order page.

### 1. The shopper's choice

#### 1.1 A new line allows substitutes and an out-of-stock item is replaced

**Covers:** SUB-1
**Kind:** happy

**Steps:**

1. Add Whole milk 2 L (out of stock) and Penne 500 g.
2. Open the basket. Leave the switches alone.
3. Add six Ground coffee 227 g, book Mar 12 09:00 and check out.

**Expected:**

- On the basket, "Allow substitutes" is on for Whole milk 2 L and for Penne 500 g.
- The order page shows Whole milk 2 L as "Substituted with Semi-skimmed milk 2 L".
- Penne 500 g and Ground coffee 227 g show "Packed".

#### 1.2 Switching substitutes off is respected for a chilled item

**Covers:** SUB-2
**Kind:** negative

**Steps:**

1. Add Whole milk 2 L (out of stock, chilled).
2. Switch "Allow substitutes" off for it.
3. Add six Ground coffee 227 g, book Mar 12 09:00 and check out.

**Expected:**

- The basket shows the switch off.
- The order page shows Whole milk 2 L as "Not available", with no "Substituted with" on the page.

#### 1.3 Switching substitutes off is respected for an item that is not chilled

**Covers:** SUB-2
**Kind:** negative

**Steps:**

1. Add Oat granola 500 g (out of stock, not chilled).
2. Switch "Allow substitutes" off for it.
3. Add six Ground coffee 227 g, book Mar 12 09:00 and check out.

**Expected:**

- The order page shows Oat granola 500 g as "Not available".

### 2. What a substitute may be

#### 2.1 A substitute comes from the same category

**Covers:** SUB-3
**Kind:** negative

**Steps:**

1. Add Smooth peanut butter 340 g ($2.79, spreads, out of stock).
2. Add six Ground coffee 227 g, book Mar 12 09:00 and check out.

**Expected:**

- The order page shows "Substituted with Crunchy peanut butter 340 g" (spreads).
- It is not Semi-skimmed milk 2 L, which costs exactly $2.79 but is milk.

#### 2.2 A substitute never contains a declared allergen

**Covers:** SUB-4
**Kind:** negative

**Steps:**

1. Add Oat granola 500 g ($3.49, out of stock).
2. Add six Ground coffee 227 g, book Mar 12 09:00 and check out.

**Expected:**

- The order page shows "Substituted with Honey granola 500 g".
- It is not Almond crunch granola 500 g ($3.59, closer in price, contains tree nuts).

#### 2.3 A substitute costs at most 15% more

**Covers:** SUB-5
**Kind:** boundary

**Steps:**

1. Add Orange juice 1 L ($2.25, out of stock). The 15% limit is $2.58.
2. Add six Ground coffee 227 g, book Mar 12 09:00 and check out.

**Expected:**

- The order page shows "Substituted with Pineapple juice 1 L" ($2.39, within the limit).
- It is not Freshly squeezed orange juice 1 L ($3.49, 55% more).

#### 2.4 A substitute is in stock

**Covers:** SUB-6
**Kind:** negative

**Steps:**

1. Add Free range eggs, 6 (out of stock).
2. Add six Ground coffee 227 g, book Mar 12 09:00 and check out.
3. Open the shop.

**Expected:**

- The order page shows "Substituted with Barn eggs, 6", never the out-of-stock item itself.
- On the shop, Barn eggs, 6 has no out-of-stock note, while Free range eggs, 6 still has one.
