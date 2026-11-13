# Pantry Run: Delivery slots

Source: `requirements/slots.md` (SLOT-1 to SLOT-8). Seed: `tests/seed.spec.ts`. Test file: `tests/slots.spec.ts`.

## Notes for the generator

- Store time is Larkford, US Central. In March 2026 that is CDT, UTC-5.
- The default clock is before 22:00 on Tue 10 Mar 2026, so the next delivery date is Wed, Mar 11 and its slots are open.
  Tests that depend on the time set it with `POST /__test/clock` `{ "at": "2026-03-10T21:59:00-05:00" }` (pass `data`).
- Seed capacity:
  - Wed, Mar 11 10:00 shows "3 left".
  - Wed, Mar 11 17:00 shows "1 left" (one more order is the 20th).
  - Wed, Mar 11 18:00 and Thu, Mar 12 18:00 are "Full".
  - No other slot shows a count.
- Slot radios are named like `Wed, Mar 11 17:00 to 18:00, $4.99, 1 left`. Full and Closed slots end in `, Full` or `, Closed` and the radio is disabled.
  Each date is a `group` named like `Wed, Mar 11`. The button is "Book slot". After booking, the page goes to /basket with status "Slot booked".
- Basket Delivery with a slot reads `Wed, Mar 11, 17:00 to 18:00 ($4.99)`. Without one it reads "No delivery slot booked." with a "Choose a slot" link.
- $25+ basket helper:
  1. On `/`, Add "Extra mature farmhouse cheddar 400 g" ($4.25).
  2. On /basket, fill "Quantity of Extra mature farmhouse cheddar 400 g" with 6.
  3. Click "Update Extra mature farmhouse cheddar 400 g" (the line is $25.50).
- Checkout places an order and opens "Order PR-1001 placed".

## Scenarios

#### 1.1 Slot picker lists 08:00 to 19:00 slots for three dates
**Covers:** SLOT-1
**Kind:** happy

1. Start from the seed, then click the "Delivery slots" header link.
2. Read the date groups and their slot radios.

**Expected**
- Heading "Choose a delivery slot" is visible.
- There are exactly three date groups: "Wed, Mar 11", "Thu, Mar 12" and "Fri, Mar 13".
- Each group has 12 slot radios. The first is "08:00 to 09:00" and the last is "19:00 to 20:00". No slot starts at 07:00 or 20:00.

#### 1.2 Booking a slot shows date, time and fee in the basket
**Covers:** SLOT-4, SLOT-5
**Kind:** happy

1. Open /slots and check "Fri, Mar 13 10:00 to 11:00, $2.99".
2. Click "Book slot".

**Expected**
- The status "Slot booked" shows on /basket.
- Delivery shows "Fri, Mar 13, 10:00 to 11:00 ($2.99)".
- The Delivery row in the totals is $2.99.

#### 1.3 17:00 and 18:00 slots cost $4.99, 16:00 and 19:00 cost $2.99
**Covers:** SLOT-5
**Kind:** boundary

1. Open /slots and read the Fri, Mar 13 radios.
2. Book Fri 16:00 and read the basket Delivery row.
3. Book Fri 17:00 and read the row.
4. Book Fri 18:00 and read the row.
5. Book Fri 19:00 and read the row.

**Expected**
- The radios for 08:00 to 16:00 and for 19:00 end with "$2.99". The radios for 17:00 and 18:00 end with "$4.99".
- The basket Delivery row shows $2.99, $4.99, $4.99, then $2.99.

#### 1.4 Slots with 3 or fewer places left show N left
**Covers:** SLOT-8
**Kind:** boundary

1. Open /slots.
2. Read the radios for Wed, Mar 11 10:00, Wed, Mar 11 17:00 and Thu, Mar 12 10:00.
3. Place one order in Wed, Mar 11 10:00 using the $25+ helper, book that slot and click Checkout. Then open /slots again.

**Expected**
- Wed 10:00 shows "3 left" and Wed 17:00 shows "1 left". Both are enabled.
- Thu 10:00 shows no "left" text.
- After the order, Wed 10:00 shows "2 left".

#### 1.5 The 20th order fills a slot, which shows Full and cannot be booked
**Covers:** SLOT-2, SLOT-8
**Kind:** boundary

1. Build a $25.50 basket with the helper.
2. Book "Wed, Mar 11 17:00 to 18:00, $4.99, 1 left".
3. Click Checkout.
4. Open /slots.

**Expected**
- The page shows "Order PR-1001 placed".
- Wed 17:00 is now named "Wed, Mar 11 17:00 to 18:00, $4.99, Full" and is disabled.

#### 1.6 Seeded Full slots show Full and cannot be selected
**Covers:** SLOT-2
**Kind:** negative

1. Open /slots.
2. Read the radios for Wed, Mar 11 18:00 and Thu, Mar 12 18:00.
3. Open /basket.

**Expected**
- Both radios end with "Full" and are disabled.
- The basket still says "No delivery slot booked.".

#### 1.7 Next-day slots still open at 21:59
**Covers:** SLOT-3
**Kind:** boundary

1. Set the clock to 2026-03-10T21:59:00-05:00.
2. Open /slots.
3. Book "Wed, Mar 11 08:00 to 09:00, $2.99".

**Expected**
- No slot reads "Closed".
- The booking succeeds. Delivery shows "Wed, Mar 11, 08:00 to 09:00 ($2.99)".

#### 1.8 Next-day slots Closed at 22:00 and after
**Covers:** SLOT-3
**Kind:** boundary

1. Set the clock to 2026-03-10T22:00:00-05:00.
2. Open /slots.

**Expected**
- All 12 Wed, Mar 11 radios end with "Closed" and are disabled.
- Thu, Mar 12 and Fri, Mar 13 slots are not Closed, and a Thu slot can be booked.

#### 1.9 Cannot check out without a booked slot
**Covers:** SLOT-6
**Kind:** negative

1. Build a $25.50 basket with the helper. Do not book a slot.
2. Read the basket.
3. Book any slot and return to the basket.

**Expected**
- Delivery says "No delivery slot booked." with a "Choose a slot" link.
- "Book a delivery slot to check out." is visible, and Checkout does not place an order.
- After booking, the message is gone and Checkout is enabled.

#### 1.10 Times are store time whatever the browser time zone
**Covers:** SLOT-7, SLOT-4
**Kind:** negative

1. Create a browser context with timezoneId "Pacific/Auckland" and sign in as Ana.
2. Open /slots and read the groups and radios.
3. Book "Thu, Mar 12 17:00 to 18:00, $4.99".
4. Read Delivery on /basket.

**Expected**
- Groups and slots match store time: Wed, Mar 11 to Fri, Mar 13, 08:00 to 19:00.
- Delivery shows "Thu, Mar 12, 17:00 to 18:00 ($4.99)". It is not shifted to the shopper's time zone.
