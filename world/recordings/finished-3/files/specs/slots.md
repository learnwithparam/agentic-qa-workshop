# Delivery slots test plan

Source: `requirements/slots.md` (SLOT-1 to SLOT-8). Seed: `tests/seed.spec.ts` (reset, sign in as Ana, open the
empty basket). Every scenario starts from the seed.

## Notes from exploring the shop

- The slot picker is `/slots`, with the heading "Choose a delivery slot", reached from the nav link "Delivery
  slots". It says "Times are Larkford store time."
- Each slot is a radio named like `Wed, Mar 11 17:00 to 18:00, $4.99, 1 left`, with `, Full` or `, Closed` added
  when it applies. Full and Closed radios are disabled. "Book slot" books the chosen slot and opens `/basket`, which
  shows "Slot booked" and, under Delivery, a line like `Thu, Mar 12, 17:00 to 18:00 ($4.99)`.
- After a reset the store clock is Tue Mar 10 2026, before 22:00 Central. The dates offered are Wed Mar 11, Thu
  Mar 12 and Fri Mar 13. Central is UTC-5 on these dates, so 22:00 store time is `2026-03-10T22:00:00-05:00`.
- Seed occupancy: Wed 10:00 has 3 left, Wed 17:00 has 1 left, Wed 18:00 and Thu 18:00 are Full. No seed slot has
  exactly 4 left.
- Six "Extra mature farmhouse cheddar 400 g" ($4.25 each, $25.50) reach the $25.00 minimum.
- With no slot and a basket of $25.00 or more, Checkout is disabled and the page says "Book a delivery slot to
  check out."
- No discrepancy with SLOT-1 to SLOT-8 was seen while exploring. Placing a real order (1.4) was not tried.

## Scenarios

### 1. Delivery slots

#### 1.1 Slot picker lists 08:00 to 19:00 slots for three dates

**Covers:** SLOT-1
**Kind:** happy

1. Click the nav link "Delivery slots".

**Expected**

- The heading "Choose a delivery slot" is visible.
- There are 36 slot radios, 12 for each of Wed, Mar 11, Thu, Mar 12 and Fri, Mar 13, and no other date.
- Fri, Mar 13 has slots "08:00 to 09:00" and "19:00 to 20:00". No slot starts at 07:00 or 20:00.

#### 1.2 First 08:00 and last 19:00 slots are bookable

**Covers:** SLOT-1
**Kind:** boundary

1. On `/slots`, choose "Fri, Mar 13 08:00 to 09:00, $2.99" and click "Book slot".
2. Go back to `/slots`, choose "Fri, Mar 13 19:00 to 20:00, $2.99" and click "Book slot".

**Expected**

- After step 1: Delivery shows "Fri, Mar 13, 08:00 to 09:00 ($2.99)".
- After step 2: Delivery shows "Fri, Mar 13, 19:00 to 20:00 ($2.99)".

#### 1.3 Slots with 3 or fewer places left show N left

**Covers:** SLOT-8
**Kind:** boundary

1. Open `/slots`.

**Expected**

- "Wed, Mar 11 10:00 to 11:00, $2.99, 3 left" is shown and can be chosen. 3 is where the label starts.
- "Wed, Mar 11 17:00 to 18:00, $4.99, 1 left" is shown and can be chosen.
- "Wed, Mar 11 09:00 to 10:00, $2.99" has no "left" label, and no slot shows 4 or more left.

#### 1.4 Booking the 20th order fills a slot

**Covers:** SLOT-2
**Kind:** boundary

1. Add "Extra mature farmhouse cheddar 400 g" six times ($25.50).
2. On `/slots`, book "Wed, Mar 11 17:00 to 18:00, $4.99, 1 left". That slot has 19 orders.
3. On `/basket`, click Checkout and place the order.
4. Open `/slots` again.

**Expected**

- The order is placed and the shopper sees a confirmation.
- "Wed, Mar 11 17:00 to 18:00" now shows "Full" and cannot be chosen.

#### 1.5 Full slots cannot be booked

**Covers:** SLOT-2
**Kind:** negative

1. Open `/slots`.
2. Try to choose "Wed, Mar 11 18:00 to 19:00, $4.99, Full".

**Expected**

- "Wed, Mar 11 18:00 to 19:00" and "Thu, Mar 12 18:00 to 19:00" show "Full" and are disabled.
- The Full slot does not become selected, and the basket still says "No delivery slot booked."
- "Fri, Mar 13 18:00 to 19:00" is not full and can be chosen.

#### 1.6 Next-day slots are still open at 21:59 store time

**Covers:** SLOT-3
**Kind:** boundary

1. Set the clock to `2026-03-10T21:59:00-05:00` and open `/slots`.
2. Book "Wed, Mar 11 08:00 to 09:00, $2.99".

**Expected**

- No slot shows "Closed".
- Delivery shows "Wed, Mar 11, 08:00 to 09:00 ($2.99)".

#### 1.7 Next-day slots show Closed at 22:00 store time

**Covers:** SLOT-3
**Kind:** boundary

1. Set the clock to `2026-03-10T22:00:00-05:00` and open `/slots`.

**Expected**

- All 12 Wed, Mar 11 slots show "Closed" and are disabled.
- "Thu, Mar 12 08:00 to 09:00, $2.99" can still be chosen.

#### 1.8 A closed slot cannot be booked

**Covers:** SLOT-3
**Kind:** negative

1. Set the clock to `2026-03-10T23:30:00-05:00` and open `/slots`.
2. Try to choose "Wed, Mar 11 08:00 to 09:00, $2.99, Closed" and click "Book slot".

**Expected**

- The Closed slot is disabled and does not become selected.
- No slot is booked, and the basket says "No delivery slot booked."

#### 1.9 Booked slot date, time and fee appear in the basket

**Covers:** SLOT-4
**Kind:** happy

1. On `/slots`, book "Thu, Mar 12 09:00 to 10:00, $2.99".
2. Reload `/basket`.

**Expected**

- The page shows "Slot booked". Delivery shows "Thu, Mar 12, 09:00 to 10:00 ($2.99)" and the delivery fee is $2.99.
- After the reload the same slot is still shown.

#### 1.10 Fee is $2.99 at 16:00 and $4.99 at 17:00

**Covers:** SLOT-5
**Kind:** boundary

1. Book "Fri, Mar 13 16:00 to 17:00".
2. Book "Fri, Mar 13 17:00 to 18:00".

**Expected**

- After step 1: Delivery shows "Fri, Mar 13, 16:00 to 17:00 ($2.99)" and the delivery fee is $2.99.
- After step 2: Delivery shows "Fri, Mar 13, 17:00 to 18:00 ($4.99)" and the delivery fee is $4.99.

#### 1.11 Fee is $4.99 at 18:00 and $2.99 again at 19:00

**Covers:** SLOT-5
**Kind:** boundary

1. Book "Fri, Mar 13 18:00 to 19:00".
2. Book "Fri, Mar 13 19:00 to 20:00".
3. Open `/slots` and read every slot's fee.

**Expected**

- After step 1: the delivery fee is $4.99. After step 2: it is $2.99.
- Only the six 17:00 and 18:00 slots cost $4.99. The other 30 cost $2.99.

#### 1.12 Checkout is blocked without a booked slot

**Covers:** SLOT-6
**Kind:** negative

1. Add "Extra mature farmhouse cheddar 400 g" six times and open `/basket`.
2. Book "Thu, Mar 12 09:00 to 10:00, $2.99" and return to `/basket`.

**Expected**

- After step 1: "No delivery slot booked." and Checkout is disabled. The page says "Book a delivery slot to check
  out."
- After step 2: Checkout is enabled and the message is gone.

#### 1.13 Slot times are store time in another browser time zone

**Covers:** SLOT-7
**Kind:** happy

1. Use a browser in time zone "Asia/Tokyo" (store time is UTC-5, Tokyo is UTC+9). Reset, sign in and open `/slots`.
2. Book "Thu, Mar 12 17:00 to 18:00, $4.99".
3. Set the clock to `2026-03-10T22:00:00-05:00` (Mar 11 12:00 in Tokyo) and open `/slots`.

**Expected**

- After step 1: the first slot is "Wed, Mar 11 08:00 to 09:00, $2.99", the same labels as in store time.
- After step 2: Delivery shows "Thu, Mar 12, 17:00 to 18:00 ($4.99)", with no shift in date or time.
- After step 3: the Wed, Mar 11 slots show "Closed", which follows store time.
