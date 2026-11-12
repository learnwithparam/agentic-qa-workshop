// Pantry Run: the shop, its partner API and its test hooks, in one Hono app.
import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { activeBugs, on } from "./bugs";
import {
  addToLines,
  type Line,
  meetsMinimum,
  priceBasket,
  removeOne,
  setQuantity,
} from "./domain/basket";
import { parseSlotId, type Slot } from "./domain/slots";
import { packLine } from "./domain/substitutions";
import { makeReceipt } from "./receipt";
import { ReplayMiss } from "./replay/model";
import * as S from "./store";
import { suggest } from "./suggester";
import { BasketView, Layout, money, OrderView, ProductCard, release, SlotPicker } from "./ui";

export const PARTNER_KEY = "pantry-partner-key";
const COOKIE = "pr_shopper";

export const app = new Hono();

const who = (c: Context) => {
  const id = getCookie(c, COOKIE);
  return id ? (S.shopper(id) ?? null) : null;
};
const lineCount = (id?: string) => (id ? S.basket(id).lines.length : 0);

function slotFor(id: string): Slot | undefined {
  return S.slots().find((s) => s.slotId === id);
}
function heldSlots(shopperId: string): Slot[] {
  return S.holds(shopperId)
    .map((h) => slotFor(h.slot_id))
    .filter((s): s is Slot => Boolean(s));
}

function priced(shopperId: string) {
  const b = S.basket(shopperId);
  const held = heldSlots(shopperId);
  const voucherPercent =
    b.voucher && b.voucher.toUpperCase() === S.seed.store.voucher.code
      ? S.seed.store.voucher.percent
      : 0;
  const totals = priceBasket(b.lines, S.productMap(), {
    voucherPercent,
    deliveryCents: held.reduce((a, s) => a + s.feeCents, 0),
  });
  const min = S.seed.store.minimumOrderCents;
  let reason = "";
  if (b.lines.length === 0) reason = "Add something to your basket to check out.";
  else if (!meetsMinimum(totals.afterDiscountCents, b.peakCents, min))
    reason = `Spend ${money(min - totals.afterDiscountCents)} more to check out. The minimum order is ${money(min)}.`;
  else if (held.length === 0) reason = "Book a delivery slot to check out.";
  return { b, held, totals, reason, canCheckout: reason === "" };
}

// The highest basket value seen. The min-order bug checks this instead of the basket as it is now.
function trackPeak(shopperId: string) {
  const t = priced(shopperId);
  t.b.peakCents = Math.max(t.b.peakCents, t.totals.afterDiscountCents);
  S.saveBasket(t.b);
}

// Pack every line: decide packed, substituted or not available, as the store picker will.
function packOrder(lines: Line[], allergens: string[]) {
  const all = S.products();
  const map = new Map(all.map((p) => [p.sku, p]));
  return lines.map((l) => {
    const p = map.get(l.sku)!;
    const packed = packLine(l, p, all, allergens);
    return {
      ...l,
      name: p.name,
      totalCents: priceBasket([l], map, { voucherPercent: 0, deliveryCents: 0 }).subtotalCents,
      status: packed.status,
      substituteSku: packed.substituteSku,
      substituteName: packed.substituteName,
    };
  });
}

// ---------- health and test hooks ----------
app.get("/health", (c) =>
  c.json({ ok: true, name: "Pantry Run", bugs: activeBugs(), release: release() }),
);
app.post("/__test/reset", (c) => {
  S.reset();
  return c.json({ ok: true });
});
app.post("/__test/clock", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  try {
    S.setClock(String(body.at));
  } catch (e) {
    return c.json({ error: "bad_clock", message: (e as Error).message }, 400);
  }
  return c.json({ ok: true, clock: S.now().toISOString() });
});
app.get("/__test/state", (c) =>
  c.json({ clock: S.now().toISOString(), orders: S.orders(), booked: S.bookedCounts() }),
);

// ---------- pages ----------
app.get("/", (c) => {
  const s = who(c);
  const added = c.req.query("added");
  const p = added ? S.product(added) : undefined;
  return c.html(
    <Layout title="Shop" shopper={s} basketLines={lineCount(s?.id)}>
      {p ? (
        <div class="toast" role="status">
          Added {p.name} to your basket
        </div>
      ) : null}
      {c.req.query("error") ? (
        <div class="error" role="alert">
          {c.req.query("error")}
        </div>
      ) : null}
      <h1>Groceries from your Larkford store</h1>
      <div class="grid">
        {S.products().map((x) => (
          <ProductCard p={x} />
        ))}
      </div>
    </Layout>,
  );
});

app.get("/signin", (c) =>
  c.html(
    <Layout title="Sign in" shopper={who(c)}>
      <h1>Sign in</h1>
      {c.req.query("error") ? (
        <div class="error" role="alert">
          Email or password is wrong.
        </div>
      ) : null}
      <form
        method="post"
        action="/signin"
        class="panel"
        style="max-width:380px;display:grid;gap:10px"
      >
        <input type="hidden" name="next" value={c.req.query("next") ?? "/"} />
        <label>
          Email <input type="email" name="email" required />
        </label>
        <label>
          Password <input type="password" name="password" required />
        </label>
        <button type="submit">Sign in</button>
      </form>
    </Layout>,
  ),
);

app.post("/signin", async (c) => {
  const f = await c.req.parseBody();
  const s = S.shoppers().find(
    (x) => x.email === String(f.email).trim().toLowerCase() && x.password === String(f.password),
  );
  const next = String(f.next || "/");
  if (!s) return c.redirect(`/signin?error=1&next=${encodeURIComponent(next)}`, 303);
  setCookie(c, COOKIE, s.id, { path: "/", httpOnly: true, sameSite: "Lax" });
  S.logEvent("signed_in", { shopper: s.id });
  return c.redirect(next.startsWith("/") ? next : "/", 303);
});
app.post("/signout", (c) => {
  deleteCookie(c, COOKIE, { path: "/" });
  return c.redirect("/", 303);
});

const needShopper = (c: Context) => {
  const s = who(c);
  return s ?? null;
};

app.post("/basket/add", async (c) => {
  const s = needShopper(c);
  if (!s) return c.redirect("/signin?next=/", 303);
  const f = await c.req.parseBody();
  const p = S.product(String(f.sku));
  if (!p) return c.redirect("/?error=Unknown product", 303);
  const amount = p.unit === "kg" ? Number(f.grams ?? 500) : Number(f.qty ?? 1);
  const b = S.basket(s.id);
  const isNew = !b.lines.some((l) => l.sku === p.sku);
  b.lines = addToLines(b.lines, p, amount);
  // Release v2 ships a real regression: new lines start with substitutes switched off (breaks SUB-1).
  if (release() === "v2" && isNew) b.lines.find((l) => l.sku === p.sku)!.substitutes = false;
  S.saveBasket(b);
  trackPeak(s.id);
  S.logEvent("basket_add", { shopper: s.id, sku: p.sku, amount });
  return c.redirect(`/?added=${p.sku}`, 303);
});

app.get("/basket", (c) => {
  const s = needShopper(c);
  if (!s) return c.redirect("/signin?next=/basket", 303);
  const t = priced(s.id);
  S.logEvent("basket_viewed", {
    shopper: s.id,
    lines: t.b.lines.length,
    totalCents: t.totals.totalCents,
  });
  const err = c.req.query("error");
  return c.html(
    <Layout title="Basket" shopper={s} basketLines={t.b.lines.length}>
      {c.req.query("booked") ? (
        <div class="toast" role="status">
          Slot booked
        </div>
      ) : null}
      {err ? (
        <div class="error" role="alert">
          {err}
        </div>
      ) : null}
      <BasketView
        totals={t.totals}
        heldSlots={t.held}
        canCheckout={t.canCheckout}
        reason={t.reason}
        token={t.b.token}
        voucher={t.b.voucher}
        shopperId={s.id}
      />
    </Layout>,
  );
});

app.post("/basket/lines/:sku/:action", async (c) => {
  const s = needShopper(c);
  if (!s) return c.redirect("/signin?next=/basket", 303);
  const p = S.product(c.req.param("sku"));
  if (!p) return c.redirect("/basket?error=Unknown product", 303);
  const b = S.basket(s.id);
  const action = c.req.param("action");
  const f = await c.req.parseBody();
  try {
    if (action === "decrement") b.lines = removeOne(b.lines, p);
    else if (action === "remove") b.lines = b.lines.filter((l) => l.sku !== p.sku);
    else if (action === "qty") b.lines = setQuantity(b.lines, p, Number(f.qty));
    else if (action === "substitutes") {
      const l = b.lines.find((x) => x.sku === p.sku);
      if (l) l.substitutes = f.allow === "yes";
    } else return c.redirect("/basket?error=Unknown action", 303);
  } catch (e) {
    return c.redirect(`/basket?error=${encodeURIComponent((e as Error).message)}`, 303);
  }
  S.saveBasket(b);
  trackPeak(s.id);
  S.logEvent("basket_change", { shopper: s.id, sku: p.sku, action });
  return c.redirect("/basket", 303);
});

app.post("/basket/voucher", async (c) => {
  const s = needShopper(c);
  if (!s) return c.redirect("/signin?next=/basket", 303);
  const code = String((await c.req.parseBody()).code ?? "").trim();
  if (code && code.toUpperCase() !== S.seed.store.voucher.code)
    return c.redirect("/basket?error=That voucher code is not valid.", 303);
  const b = S.basket(s.id);
  b.voucher = code || null;
  S.saveBasket(b);
  return c.redirect("/basket", 303);
});

app.get("/slots", (c) => {
  const s = who(c);
  return c.html(
    <Layout title="Delivery slots" shopper={s} basketLines={lineCount(s?.id)}>
      <h1>Choose a delivery slot</h1>
      <p>
        Times are Larkford store time. Slots for the next delivery date close at 22:00 the evening
        before.
      </p>
      {s ? (
        <SlotPicker slots={S.slots()} held={S.holds(s.id).map((h) => h.slot_id)} />
      ) : (
        <p>
          <a href="/signin?next=/slots">Sign in</a> to book a slot.
        </p>
      )}
    </Layout>,
  );
});

function bookingProblem(
  slotId: string,
): { status: 404 | 409; error: string; message: string } | null {
  const slot = slotFor(slotId);
  if (!slot) return { status: 404, error: "slot_not_found", message: "There is no such slot." };
  if (slot.status === "closed")
    return { status: 409, error: "slot_closed", message: "That slot is closed for booking." };
  if (slot.status === "full")
    return { status: 409, error: "slot_full", message: "That slot is full. Choose another." };
  return null;
}

app.post("/api/slots/:id/book", (c) => {
  const s = who(c);
  if (!s) return c.json({ error: "signed_out", message: "Sign in to book a slot." }, 401);
  const id = c.req.param("id");
  const bad = bookingProblem(id);
  if (bad) return c.json({ error: bad.error, message: bad.message }, bad.status);
  if (!on("double-book")) S.dropHolds(s.id);
  S.addHold(s.id, id);
  S.logEvent("slot_booked", { shopper: s.id, slotId: id });
  return c.json({ ok: true, slotId: id });
});

app.post("/checkout", async (c) => {
  const s = needShopper(c);
  if (!s) return c.redirect("/signin?next=/basket", 303);
  const token = String((await c.req.parseBody()).token ?? "");
  const t = priced(s.id);
  if (!on("back-resubmit") && token !== t.b.token) {
    const done = S.orderByToken(token);
    return c.redirect(
      done
        ? `/orders/${done.orderId}`
        : "/basket?error=Your basket changed. Check it and try again.",
      303,
    );
  }
  if (!t.canCheckout) return c.redirect(`/basket?error=${encodeURIComponent(t.reason)}`, 303);
  const orderId = S.nextOrderId();
  const order: S.Order = {
    orderId,
    shopper: s.id,
    slotId: t.held[0].slotId,
    status: "placed",
    placedAt: S.now().toISOString(),
    token,
    lines: packOrder(t.b.lines, s.allergens),
    subtotalCents: t.totals.subtotalCents,
    discountCents: t.totals.offerCents + t.totals.voucherCents,
    deliveryCents: t.totals.deliveryCents,
    totalCents: t.totals.totalCents,
    voucher: t.b.voucher,
  };
  S.saveOrder(order);
  if (!on("back-resubmit")) {
    S.useHolds(s.id, orderId);
    S.clearBasket(s.id);
  }
  S.logEvent("order_placed", {
    shopper: s.id,
    orderId,
    via: "shop",
    totalCents: order.totalCents,
    lines: order.lines.map((l) => ({
      sku: l.sku,
      status: l.status,
      substituteSku: l.substituteSku,
    })),
  });
  return c.redirect(`/orders/${orderId}`, 303);
});

app.get("/orders", (c) => {
  const s = needShopper(c);
  if (!s) return c.redirect("/signin?next=/orders", 303);
  const os = S.orders(s.id);
  return c.html(
    <Layout title="Orders" shopper={s} basketLines={lineCount(s.id)}>
      <h1>Your orders</h1>
      {os.length === 0 ? (
        <p>No orders yet.</p>
      ) : (
        <ul data-testid="order-list">
          {os.map((o) => (
            <li>
              <a href={`/orders/${o.orderId}`}>{o.orderId}</a>, {money(o.totalCents)}
            </li>
          ))}
        </ul>
      )}
    </Layout>,
  );
});

app.get("/orders/:id", (c) => {
  const s = needShopper(c);
  if (!s) return c.redirect("/signin?next=/orders", 303);
  const o = S.order(c.req.param("id"));
  if (!o || o.shopper !== s.id) return c.notFound();
  return c.html(
    <Layout title={`Order ${o.orderId}`} shopper={s} basketLines={lineCount(s.id)}>
      <OrderView o={o} slot={slotFor(o.slotId)} />
    </Layout>,
  );
});

app.get("/orders/:id/receipt", (c) => {
  const s = needShopper(c);
  if (!s) return c.redirect("/signin?next=/orders", 303);
  const o = S.order(c.req.param("id"));
  if (!o || o.shopper !== s.id) return c.notFound();
  c.header("Content-Disposition", `attachment; filename="receipt.json"`);
  return c.body(JSON.stringify(makeReceipt(o), null, 2) + "\n", 200, {
    "Content-Type": "application/json",
  });
});

// ---------- partner API (openapi.yaml) ----------
const partner = (c: Context) => c.req.header("authorization") === `Bearer ${PARTNER_KEY}`;
const shapeOrder = (o: S.Order) => {
  const { token, voucher, ...rest } = o;
  if (!on("api-field-rename")) return rest;
  const { slotId, ...others } = rest;
  return { ...others, slot_id: slotId };
};

app.get("/api/products", (c) => c.json(S.products()));
app.get("/api/slots", (c) =>
  c.json(
    S.slots().map(({ slotId, date, start, end, feeCents, remaining, status }) => ({
      slotId,
      date,
      start,
      end,
      feeCents,
      remaining,
      status,
    })),
  ),
);

const OrderBody = z.object({
  shopper: z.string(),
  slotId: z.string(),
  voucher: z.string().optional(),
  lines: z
    .array(
      z.object({
        sku: z.string(),
        qty: z.number().int().min(1).max(20).optional(),
        grams: z.number().int().min(250).max(5000).optional(),
        substitutes: z.boolean().optional(),
      }),
    )
    .min(1),
});

app.post("/api/orders", async (c) => {
  if (!partner(c))
    return c.json(
      { error: "unauthorized", message: "Send Authorization: Bearer <partner key>." },
      401,
    );
  const parsed = OrderBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json(
      {
        error: "invalid_request",
        message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      },
      400,
    );
  const body = parsed.data;
  const s = S.shopper(body.shopper);
  if (!s)
    return c.json({ error: "invalid_request", message: `Unknown shopper "${body.shopper}".` }, 400);
  const map = S.productMap();
  const unknown = body.lines.find((l) => !map.has(l.sku));
  if (unknown)
    return c.json({ error: "invalid_request", message: `Unknown sku "${unknown.sku}".` }, 400);
  if (!parseSlotId(body.slotId))
    return c.json({ error: "slot_not_found", message: "There is no such slot." }, 404);
  const bad = bookingProblem(body.slotId);
  if (bad?.error === "slot_full" && on("api-status")) throw new Error("capacity exceeded");
  if (bad) return c.json({ error: bad.error, message: bad.message }, bad.status);
  const lines: Line[] = body.lines.map((l) => {
    const p = map.get(l.sku)!;
    return {
      sku: l.sku,
      qty: p.unit === "kg" ? 1 : (l.qty ?? 1),
      grams: p.unit === "kg" ? (l.grams ?? 500) : 0,
      substitutes: l.substitutes ?? true,
    };
  });
  const voucherPercent =
    body.voucher?.toUpperCase() === S.seed.store.voucher.code ? S.seed.store.voucher.percent : 0;
  const slot = slotFor(body.slotId)!;
  const t = priceBasket(lines, map, { voucherPercent, deliveryCents: slot.feeCents });
  if (t.afterDiscountCents < S.seed.store.minimumOrderCents)
    return c.json(
      {
        error: "below_minimum",
        message: `The minimum order is ${money(S.seed.store.minimumOrderCents)} after discounts.`,
      },
      422,
    );
  const orderId = S.nextOrderId();
  const order: S.Order = {
    orderId,
    shopper: s.id,
    slotId: body.slotId,
    status: "placed",
    placedAt: S.now().toISOString(),
    token: null,
    lines: packOrder(lines, s.allergens),
    subtotalCents: t.subtotalCents,
    discountCents: t.offerCents + t.voucherCents,
    deliveryCents: t.deliveryCents,
    totalCents: t.totalCents,
    voucher: body.voucher ?? null,
  };
  S.saveOrder(order);
  S.db
    .query("INSERT INTO bookings (slot_id, shopper, order_id, created_at) VALUES (?, ?, ?, ?)")
    .run(body.slotId, s.id, orderId, S.now().toISOString());
  S.logEvent("order_placed", { shopper: s.id, orderId, via: "api", totalCents: order.totalCents });
  return c.json(shapeOrder(order), 201);
});

app.get("/api/orders", (c) => {
  if (!partner(c))
    return c.json(
      { error: "unauthorized", message: "Send Authorization: Bearer <partner key>." },
      401,
    );
  return c.json(S.orders(c.req.query("shopper")).map(shapeOrder));
});
app.get("/api/orders/:id", (c) => {
  if (!partner(c))
    return c.json(
      { error: "unauthorized", message: "Send Authorization: Bearer <partner key>." },
      401,
    );
  const o = S.order(c.req.param("id"));
  return o
    ? c.json(shapeOrder(o))
    : c.json({ error: "order_not_found", message: "There is no such order." }, 404);
});

app.get("/api/suggest", async (c) => {
  const p = S.product(c.req.query("sku") ?? "");
  const s = S.shopper(c.req.query("shopper") ?? "");
  const seed = Number(c.req.query("seed") ?? 1);
  if (!p || !s || !Number.isInteger(seed))
    return c.json(
      { error: "invalid_request", message: "Send sku, shopper and a whole-number seed." },
      400,
    );
  try {
    const picks = await suggest(p, S.products(), s.allergens, seed);
    S.logEvent("suggested", {
      shopper: s.id,
      sku: p.sku,
      seed,
      suggestions: picks.map((x) => x.sku),
    });
    return c.json({
      sku: p.sku,
      shopper: s.id,
      allergens: s.allergens,
      seed,
      suggestions: picks.map(({ sku, name, category, priceCents, allergens, stock }) => ({
        sku,
        name,
        category,
        priceCents,
        allergens,
        stock,
      })),
    });
  } catch (e) {
    if (e instanceof ReplayMiss)
      return c.json({ error: "no_recorded_reply", message: e.message }, 503);
    throw e;
  }
});

app.onError((e, c) => {
  S.logEvent("server_error", { path: c.req.path, message: e.message });
  return c.json({ error: "internal", message: "Something went wrong." }, 500);
});
