# Pantry Run - Delivery slots test plan

## Application Overview

Plan for requirements/slots.md (SLOT-1 to SLOT-8). Every scenario starts from tests/seed.spec.ts: POST /__test/reset, sign in as ana@pantryrun.test / pantry at /signin, open /basket (empty basket, "No delivery slot booked.").

Exploration notes for the generator:
- Default (reset) store clock: after reset the picker shows Wed Mar 11, Thu Mar 12 and Fri Mar 13 (2026) and nothing is Closed, so the clock is earlier than Tue Mar 10 22:00 CDT. GET /__test/clock does not exist (404); POST returns {"ok":true,"clock":"<UTC ISO>"}. Reset also resets the clock. Mar 10 2026 is CDT (UTC-5), so send "2026-03-10T21:59:00-05:00" and "2026-03-10T22:00:00-05:00" (= 02:59Z / 03:00Z on Mar 11).
- The picker is a form on /slots: one radio per slot, then a "Book slot" button. Radio accessible name is the full label, e.g. "Wed, Mar 11 17:00 to 18:00, $4.99, 1 left" or "Wed, Mar 11 18:00 to 19:00, $4.99, Full" (disabled). Use getByRole('radio', { name: /Wed, Mar 11 17:00 to 18:00/ }). Day groups are role=group named "Wed, Mar 11", etc. Page intro text: "Times are Larkford store time. Slots for the next delivery date close at 22:00 the evening before."
- Seeded state (the shop's own seed, nothing to set up): Wed Mar 11 10:00 = "3 left"; Wed Mar 11 17:00 = "1 left"; Wed Mar 11 18:00 = Full; Thu Mar 12 18:00 = Full. All other slots show no count. No seeded slot has exactly 4 left, so a "4 left vs 3 left" boundary cannot be reached from the seed (counts only go down); the 3 left to 2 left and 1 left to Full transitions are reachable by booking.
- Booking: select a radio, click "Book slot". The app redirects to /basket?booked=<slot> and shows "Slot booked". The Delivery panel (data-testid="held-slots", a list) shows e.g. "Thu, Mar 12, 17:00 to 18:00 ($4.99)"; the totals row data-testid="delivery" and Total include the fee. Booking a second slot replaces the first.
- Booking a slot reserves a place: after booking Wed 10:00, the picker shows "2 left" and that radio is checked; after booking Wed 17:00 (1 left) it shows "Full" (disabled, checked).
- Checkout: data-testid="checkout-blocked" paragraph holds the reason. With a basket of 7 Sourdough loaf plus Vine tomatoes 500 g ($25.00; add each from the shop page, tomatoes default to 500 g) and no slot, the button "Checkout" is disabled and the text is "Book a delivery slot to check out." With a slot booked, Checkout works and lands on /orders/PR-1001 showing "Delivery: Thu, Mar 12, 08:00 to 09:00".
- Timezone: use test.use({ timezoneId: 'Asia/Tokyo' }); the shop renders store time server side. No deviation was observed in the slot picker, basket Delivery panel or order page.
- Fees: $4.99 only for 17:00 and 18:00 starts, $2.99 otherwise (all seeded days).
- Observed deviations from requirements in this area: none.

## Test Scenarios

### 1. Delivery slots

**Seed:** `tests/seed.spec.ts`

#### 1.1 Slot picker lists one-hour slots 08:00 to 19:00 for three delivery dates

**Covers:** SLOT-1
**Kind:** happy

**File:** `tests/slots.spec.ts`

**Steps:**
  1. Start from the seed (reset, signed in, /basket). Click the 'Delivery slots' link in the header.
    - expect: Heading 'Choose a delivery slot' is visible
    - expect: Exactly three day groups: 'Wed, Mar 11', 'Thu, Mar 12', 'Fri, Mar 13'
  2. In each group count the radios and read the first and last labels.
    - expect: 12 radios per group (36 in total)
    - expect: First is '<day> 08:00 to 09:00', last is '<day> 19:00 to 20:00'
    - expect: No radio exists for 20:00 to 21:00 or 07:00 to 08:00

#### 1.2 Slot picker moves to the next three dates when the store clock advances

**Covers:** SLOT-1
**Kind:** happy

**File:** `tests/slots.spec.ts`

**Steps:**
  1. POST /__test/clock with {"at":"2026-03-11T08:00:00-05:00"} then open /slots.
    - expect: Groups are 'Thu, Mar 12', 'Fri, Mar 13', 'Sat, Mar 14' (Wed Mar 11 no longer offered), 12 slots each

#### 1.3 Full slot at 20 orders shows Full and cannot be booked

**Covers:** SLOT-2
**Kind:** negative

**File:** `tests/slots.spec.ts`

**Steps:**
  1. Open /slots from the seed. Locate radios 'Wed, Mar 11 18:00 to 19:00, $4.99, Full' and 'Thu, Mar 12 18:00 to 19:00, $4.99, Full'.
    - expect: Both show the text 'Full' and are disabled
    - expect: Neither can be checked, so 'Book slot' cannot book them
  2. Compare with 'Fri, Mar 13 18:00 to 19:00, $4.99'.
    - expect: Fri 18:00 has no Full label and is enabled

#### 1.4 Booking the last place in a slot turns it from 1 left to Full

**Covers:** SLOT-2, SLOT-8
**Kind:** boundary

**File:** `tests/slots.spec.ts`

**Steps:**
  1. Open /slots. Confirm 'Wed, Mar 11 17:00 to 18:00, $4.99, 1 left' is enabled. Select it and click 'Book slot'.
    - expect: Redirect to /basket, 'Slot booked' shown, Delivery shows 'Wed, Mar 11, 17:00 to 18:00 ($4.99)'
  2. Return to /slots.
    - expect: The same slot now reads 'Wed, Mar 11 17:00 to 18:00, $4.99, Full' (the 20th order fills it) and is disabled

#### 1.5 Next day slots stay open at 21:59 and close at 22:00 the evening before

**Covers:** SLOT-3
**Kind:** boundary

**File:** `tests/slots.spec.ts`

**Steps:**
  1. POST /__test/clock {"at":"2026-03-10T21:59:00-05:00"}, open /slots.
    - expect: No slot shows 'Closed'; 'Wed, Mar 11 08:00 to 09:00, $2.99' is enabled
  2. POST /__test/clock {"at":"2026-03-10T22:00:00-05:00"}, reload /slots.
    - expect: All 12 Wed Mar 11 slots show 'Closed' and are disabled (e.g. 'Wed, Mar 11 08:00 to 09:00, $2.99, Closed')
    - expect: Thu Mar 12 and Fri Mar 13 slots are still enabled

#### 1.6 Closed slot cannot be booked and Closed replaces Full

**Covers:** SLOT-3
**Kind:** negative

**File:** `tests/slots.spec.ts`

**Steps:**
  1. Set clock to 2026-03-10T22:00:00-05:00, open /slots.
    - expect: 'Wed, Mar 11 10:00 to 11:00' (was 3 left) reads 'Closed' and is disabled
    - expect: 'Wed, Mar 11 18:00 to 19:00' (seeded Full) reads 'Closed' and is disabled
  2. Try to select a closed radio and click 'Book slot'; then open /basket.
    - expect: Nothing is booked: Delivery still says 'No delivery slot booked.'

#### 1.7 Cutoff moves to the following evening for the next delivery date

**Covers:** SLOT-3
**Kind:** boundary

**File:** `tests/slots.spec.ts`

**Steps:**
  1. Set clock to 2026-03-11T21:59:00-05:00, open /slots.
    - expect: Groups Thu Mar 12 - Sat Mar 14; no slot is Closed
  2. Set clock to 2026-03-11T22:00:00-05:00, reload /slots.
    - expect: All 12 Thu Mar 12 slots are Closed; Fri Mar 13 and Sat Mar 14 are open

#### 1.8 Booked slot date, time and fee appear under Delivery on the basket page

**Covers:** SLOT-4
**Kind:** happy

**File:** `tests/slots.spec.ts`

**Steps:**
  1. Open /slots, select 'Fri, Mar 13 08:00 to 09:00, $2.99', click 'Book slot'.
    - expect: Basket page shows 'Slot booked'
    - expect: Delivery panel (getByTestId('held-slots')) contains 'Fri, Mar 13, 08:00 to 09:00 ($2.99)'
    - expect: Totals: Delivery $2.99, Total $2.99 for an empty basket
  2. Reload /basket.
    - expect: Booking persists; header still 'Basket (0)'

#### 1.9 Booking a second slot replaces the first under Delivery

**Covers:** SLOT-4
**Kind:** happy

**File:** `tests/slots.spec.ts`

**Steps:**
  1. Book 'Thu, Mar 12 17:00 to 18:00, $4.99', then return to /slots and book 'Fri, Mar 13 08:00 to 09:00, $2.99'.
    - expect: Delivery lists only 'Fri, Mar 13, 08:00 to 09:00 ($2.99)'; Delivery total is $2.99

#### 1.10 Slot picker prices only the 17:00 and 18:00 slots at 4.99

**Covers:** SLOT-5
**Kind:** happy

**File:** `tests/slots.spec.ts`

**Steps:**
  1. Open /slots and read the price in the label of every Fri Mar 13 slot.
    - expect: 17:00 to 18:00 is $4.99; 18:00 to 19:00 is $4.99; every other slot (08:00 to 17:00 and 19:00 to 20:00) is $2.99

#### 1.11 Delivery fee flips at 17:00 and again at 19:00 when booking

**Covers:** SLOT-5
**Kind:** boundary

**File:** `tests/slots.spec.ts`

**Steps:**
  1. Book 'Fri, Mar 13 16:00 to 17:00, $2.99'. Read getByTestId('delivery') in the totals.
    - expect: $2.99
  2. Book 'Fri, Mar 13 17:00 to 18:00, $4.99'.
    - expect: Delivery $4.99; Delivery panel 'Fri, Mar 13, 17:00 to 18:00 ($4.99)'; Total $4.99
  3. Book 'Fri, Mar 13 18:00 to 19:00, $4.99', then 'Fri, Mar 13 19:00 to 20:00, $2.99'.
    - expect: 18:00 gives $4.99; 19:00 gives $2.99

#### 1.12 Checkout is blocked without a slot and works after booking one

**Covers:** SLOT-6
**Kind:** negative

**File:** `tests/slots.spec.ts`

**Steps:**
  1. From the shop page add 'Sourdough loaf' 7 times and 'Vine tomatoes, loose' once (default 500 g) so the subtotal is $25.00. Open /basket without booking a slot.
    - expect: 'Checkout' button is disabled
    - expect: getByTestId('checkout-blocked') reads 'Book a delivery slot to check out.'
    - expect: Delivery panel: 'No delivery slot booked.' with a 'Choose a slot' link to /slots
  2. Click 'Choose a slot', book 'Thu, Mar 12 08:00 to 09:00, $2.99', return to /basket.
    - expect: Checkout is enabled; Total is $27.99
  3. Click 'Checkout'.
    - expect: Order page 'Order PR-1001 placed' shows 'Delivery: Thu, Mar 12, 08:00 to 09:00'

#### 1.13 Times show store time for a shopper in the Asia/Tokyo time zone

**Covers:** SLOT-7
**Kind:** happy

**File:** `tests/slots.spec.ts`

**Steps:**
  1. In the spec call test.use({ timezoneId: 'Asia/Tokyo' }), run the seed steps and open /slots.
    - expect: Groups are still 'Wed, Mar 11', 'Thu, Mar 12', 'Fri, Mar 13' (not shifted a day)
    - expect: First slot reads 'Wed, Mar 11 08:00 to 09:00, $2.99'; last Wed slot is '19:00 to 20:00'
  2. Book 'Thu, Mar 12 17:00 to 18:00, $4.99'.
    - expect: Basket Delivery shows 'Thu, Mar 12, 17:00 to 18:00 ($4.99)' unchanged

#### 1.14 Cutoff follows store time when the shopper time zone is ahead of the store

**Covers:** SLOT-7, SLOT-3
**Kind:** boundary

**File:** `tests/slots.spec.ts`

**Steps:**
  1. test.use({ timezoneId: 'Asia/Tokyo' }). Set clock to 2026-03-10T21:59:00-05:00 (11:59 on Mar 11 in Tokyo), open /slots.
    - expect: Wed Mar 11 slots are open
  2. Set clock to 2026-03-10T22:00:00-05:00 and reload.
    - expect: Wed Mar 11 slots are all 'Closed'

#### 1.15 Placed order shows the delivery time in store time for a Tokyo shopper

**Covers:** SLOT-7
**Kind:** happy

**File:** `tests/slots.spec.ts`

**Steps:**
  1. test.use({ timezoneId: 'Asia/Tokyo' }). Build the $25.00 basket (7 Sourdough loaf + Vine tomatoes 500 g), book 'Thu, Mar 12 08:00 to 09:00, $2.99', click 'Checkout', then open /orders.
    - expect: Order page shows 'Delivery: Thu, Mar 12, 08:00 to 09:00', not a Tokyo-shifted time
  2. On /orders (which lists 'PR-1001, $27.99', no time) open the order again.
    - expect: It still shows 'Delivery: Thu, Mar 12, 08:00 to 09:00'

#### 1.16 Slot with 3 places left shows 3 left and drops to 2 left after a booking

**Covers:** SLOT-8
**Kind:** boundary

**File:** `tests/slots.spec.ts`

**Steps:**
  1. Open /slots from the seed.
    - expect: 'Wed, Mar 11 10:00 to 11:00, $2.99, 3 left' is visible and enabled
  2. Book the 10:00 slot and reopen /slots.
    - expect: The slot reads '2 left', is checked and enabled

#### 1.17 Slots with more than 3 places left show no N left label

**Covers:** SLOT-8
**Kind:** negative

**File:** `tests/slots.spec.ts`

**Steps:**
  1. Open /slots from the seed and read 'Wed, Mar 11 09:00 to 10:00, $2.99' and 'Fri, Mar 13 17:00 to 18:00, $4.99'.
    - expect: Neither label contains 'left' or 'Full'
    - expect: Only Wed 10:00 (3 left) and Wed 17:00 (1 left) show a 'left' label; Wed 18:00 shows 'Full', not '0 left'
