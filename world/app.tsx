// Pantry Run: the shop, its partner API and its test hooks, in one Hono app.
import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { activeBugs, on } from "./bugs";
import {
  addToLines,
  type Line,
  meetsMinimum,
  type Product,
  priceBasket,
  removeOne,
  setQuantity,
  type Totals,
} from "./domain/basket";
import { parseSlotId, type Slot } from "./domain/slots";
import { packLine } from "./domain/substitutions";
import { makeReceipt } from "./receipt";
import { ReplayMiss } from "./replay/model";
import * as store from "./store";
import { suggest } from "./suggester";
import { BasketView, Layout, money, OrderView, ProductCard, release, SlotPicker } from "./ui";

export const PARTNER_KEY = "pantry-partner-key";
const COOKIE = "pr_shopper";

export const app = new Hono();

type ProductsBySku = Map<string, Product>;
type BookingProblem = { status: 404 | 409; error: string; message: string };

// ---------- shared helpers ----------

function signedInShopper(context: Context): store.Shopper | null {
  const shopperId = getCookie(context, COOKIE);
  if (!shopperId) return null;
  return store.shopper(shopperId) ?? null;
}

function lineCount(shopperId?: string): number {
  if (!shopperId) return 0;
  return store.basket(shopperId).lines.length;
}

function slotFor(slotId: string): Slot | undefined {
  return store.slots().find((slot) => slot.slotId === slotId);
}

function heldSlots(shopperId: string): Slot[] {
  const holds = store.holds(shopperId);
  const slots = holds.map((hold) => slotFor(hold.slot_id));
  return slots.filter((slot): slot is Slot => Boolean(slot));
}

// A product we already know is in the shop. Throws if it is not, which the error handler reports.
function knownProduct(products: ProductsBySku, sku: string): Product {
  const product = products.get(sku);
  if (!product) throw new Error(`Unknown sku "${sku}".`);
  return product;
}

function voucherPercentFor(code: string | null | undefined): number {
  if (!code) return 0;
  const voucher = store.seed.store.voucher;
  return code.toUpperCase() === voucher.code ? voucher.percent : 0;
}

// The reason the shopper cannot check out yet, or "" when they can.
function checkoutBlocker(basket: store.Basket, totals: Totals, slotCount: number): string {
  const minimum = store.seed.store.minimumOrderCents;
  if (basket.lines.length === 0) return "Add something to your basket to check out.";
  if (!meetsMinimum(totals.afterDiscountCents, basket.peakCents, minimum)) {
    const missing = money(minimum - totals.afterDiscountCents);
    return `Spend ${missing} more to check out. The minimum order is ${money(minimum)}.`;
  }
  if (slotCount === 0) return "Book a delivery slot to check out.";
  return "";
}

function priced(shopperId: string) {
  const basket = store.basket(shopperId);
  const held = heldSlots(shopperId);
  const deliveryCents = held.reduce((total, slot) => total + slot.feeCents, 0);
  const totals = priceBasket(basket.lines, store.productMap(), {
    voucherPercent: voucherPercentFor(basket.voucher),
    deliveryCents,
  });
  const reason = checkoutBlocker(basket, totals, held.length);
  return { basket, held, totals, reason, canCheckout: reason === "" };
}

// The highest basket value seen. The min-order bug checks this instead of the basket as it is now.
function trackPeak(shopperId: string) {
  const current = priced(shopperId);
  current.basket.peakCents = Math.max(current.basket.peakCents, current.totals.afterDiscountCents);
  store.saveBasket(current.basket);
}

// Pack every line: decide packed, substituted or not available, as the store picker will.
function packOrder(lines: Line[], allergens: string[]) {
  const allProducts = store.products();
  const products: ProductsBySku = new Map(allProducts.map((product) => [product.sku, product]));
  const noDiscounts = { voucherPercent: 0, deliveryCents: 0 };
  return lines.map((line) => {
    const product = knownProduct(products, line.sku);
    const packed = packLine(line, product, allProducts, allergens);
    return {
      ...line,
      name: product.name,
      totalCents: priceBasket([line], products, noDiscounts).subtotalCents,
      status: packed.status,
      substituteSku: packed.substituteSku,
      substituteName: packed.substituteName,
    };
  });
}

function bookingProblem(slotId: string): BookingProblem | null {
  const slot = slotFor(slotId);
  if (!slot) return { status: 404, error: "slot_not_found", message: "There is no such slot." };
  if (slot.status === "closed") {
    return { status: 409, error: "slot_closed", message: "That slot is closed for booking." };
  }
  if (slot.status === "full") {
    return { status: 409, error: "slot_full", message: "That slot is full. Choose another." };
  }
  return null;
}

function redirectWithError(context: Context, page: string, message: string) {
  return context.redirect(`${page}?error=${encodeURIComponent(message)}`, 303);
}

// ---------- health and test hooks ----------
app.get("/health", (context) =>
  context.json({ ok: true, name: "Pantry Run", bugs: activeBugs(), release: release() }),
);
app.post("/__test/reset", (context) => {
  store.reset();
  return context.json({ ok: true });
});
app.post("/__test/clock", async (context) => {
  const body = await context.req.json().catch(() => ({}));
  try {
    store.setClock(String(body.at));
  } catch (error) {
    return context.json({ error: "bad_clock", message: (error as Error).message }, 400);
  }
  return context.json({ ok: true, clock: store.now().toISOString() });
});
app.get("/__test/state", (context) =>
  context.json({
    clock: store.now().toISOString(),
    orders: store.orders(),
    booked: store.bookedCounts(),
  }),
);

// ---------- pages ----------
app.get("/", (context) => {
  const shopper = signedInShopper(context);
  const addedSku = context.req.query("added");
  const added = addedSku ? store.product(addedSku) : undefined;
  const error = context.req.query("error");
  return context.html(
    <Layout title="Shop" shopper={shopper} basketLines={lineCount(shopper?.id)}>
      {added ? (
        <div class="toast" role="status">
          Added {added.name} to your basket
        </div>
      ) : null}
      {error ? (
        <div class="error" role="alert">
          {error}
        </div>
      ) : null}
      <h1>Groceries from your Larkford store</h1>
      <div class="grid">
        {store.products().map((product) => (
          <ProductCard product={product} />
        ))}
      </div>
    </Layout>,
  );
});

app.get("/signin", (context) =>
  context.html(
    <Layout title="Sign in" shopper={signedInShopper(context)}>
      <h1>Sign in</h1>
      {context.req.query("error") ? (
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
        <input type="hidden" name="next" value={context.req.query("next") ?? "/"} />
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

app.post("/signin", async (context) => {
  const form = await context.req.parseBody();
  const email = String(form.email).trim().toLowerCase();
  const password = String(form.password);
  const shopper = store
    .shoppers()
    .find((candidate) => candidate.email === email && candidate.password === password);
  const next = String(form.next || "/");
  if (!shopper) return context.redirect(`/signin?error=1&next=${encodeURIComponent(next)}`, 303);
  setCookie(context, COOKIE, shopper.id, { path: "/", httpOnly: true, sameSite: "Lax" });
  store.logEvent("signed_in", { shopper: shopper.id });
  return context.redirect(next.startsWith("/") ? next : "/", 303);
});
app.post("/signout", (context) => {
  deleteCookie(context, COOKIE, { path: "/" });
  return context.redirect("/", 303);
});

app.post("/basket/add", async (context) => {
  const shopper = signedInShopper(context);
  if (!shopper) return context.redirect("/signin?next=/", 303);
  const form = await context.req.parseBody();
  const product = store.product(String(form.sku));
  if (!product) return context.redirect("/?error=Unknown product", 303);
  const amount = product.unit === "kg" ? Number(form.grams ?? 500) : Number(form.qty ?? 1);
  const basket = store.basket(shopper.id);
  const isNew = !basket.lines.some((line) => line.sku === product.sku);
  basket.lines = addToLines(basket.lines, product, amount);
  // Release v2 ships a real regression: new lines start with substitutes off (breaks SUB-1).
  if (release() === "v2" && isNew) {
    const newLine = basket.lines.find((line) => line.sku === product.sku);
    if (newLine) newLine.substitutes = false;
  }
  store.saveBasket(basket);
  trackPeak(shopper.id);
  store.logEvent("basket_add", { shopper: shopper.id, sku: product.sku, amount });
  return context.redirect(`/?added=${product.sku}`, 303);
});

app.get("/basket", (context) => {
  const shopper = signedInShopper(context);
  if (!shopper) return context.redirect("/signin?next=/basket", 303);
  const current = priced(shopper.id);
  store.logEvent("basket_viewed", {
    shopper: shopper.id,
    lines: current.basket.lines.length,
    totalCents: current.totals.totalCents,
  });
  const error = context.req.query("error");
  return context.html(
    <Layout title="Basket" shopper={shopper} basketLines={current.basket.lines.length}>
      {context.req.query("booked") ? (
        <div class="toast" role="status">
          Slot booked
        </div>
      ) : null}
      {error ? (
        <div class="error" role="alert">
          {error}
        </div>
      ) : null}
      <BasketView
        totals={current.totals}
        heldSlots={current.held}
        canCheckout={current.canCheckout}
        reason={current.reason}
        token={current.basket.token}
        voucher={current.basket.voucher}
        shopperId={shopper.id}
      />
    </Layout>,
  );
});

// Applies one change to the basket lines. Returns false when the action is not one we know.
function changeLines(
  basket: store.Basket,
  product: Product,
  action: string,
  form: Record<string, unknown>,
): boolean {
  if (action === "decrement") basket.lines = removeOne(basket.lines, product);
  else if (action === "remove") {
    basket.lines = basket.lines.filter((line) => line.sku !== product.sku);
  } else if (action === "qty") basket.lines = setQuantity(basket.lines, product, Number(form.qty));
  else if (action === "substitutes") {
    const line = basket.lines.find((candidate) => candidate.sku === product.sku);
    if (line) line.substitutes = form.allow === "yes";
  } else return false;
  return true;
}

app.post("/basket/lines/:sku/:action", async (context) => {
  const shopper = signedInShopper(context);
  if (!shopper) return context.redirect("/signin?next=/basket", 303);
  const product = store.product(context.req.param("sku"));
  if (!product) return context.redirect("/basket?error=Unknown product", 303);
  const basket = store.basket(shopper.id);
  const action = context.req.param("action");
  const form = await context.req.parseBody();
  try {
    const known = changeLines(basket, product, action, form);
    if (!known) return context.redirect("/basket?error=Unknown action", 303);
  } catch (error) {
    return redirectWithError(context, "/basket", (error as Error).message);
  }
  store.saveBasket(basket);
  trackPeak(shopper.id);
  store.logEvent("basket_change", { shopper: shopper.id, sku: product.sku, action });
  return context.redirect("/basket", 303);
});

app.post("/basket/voucher", async (context) => {
  const shopper = signedInShopper(context);
  if (!shopper) return context.redirect("/signin?next=/basket", 303);
  const form = await context.req.parseBody();
  const code = String(form.code ?? "").trim();
  if (code && code.toUpperCase() !== store.seed.store.voucher.code) {
    return context.redirect("/basket?error=That voucher code is not valid.", 303);
  }
  const basket = store.basket(shopper.id);
  basket.voucher = code || null;
  store.saveBasket(basket);
  return context.redirect("/basket", 303);
});

app.get("/slots", (context) => {
  const shopper = signedInShopper(context);
  return context.html(
    <Layout title="Delivery slots" shopper={shopper} basketLines={lineCount(shopper?.id)}>
      <h1>Choose a delivery slot</h1>
      <p>
        Times are Larkford store time. Slots for the next delivery date close at 22:00 the evening
        before.
      </p>
      {shopper ? (
        <SlotPicker
          slots={store.slots()}
          held={store.holds(shopper.id).map((hold) => hold.slot_id)}
        />
      ) : (
        <p>
          <a href="/signin?next=/slots">Sign in</a> to book a slot.
        </p>
      )}
    </Layout>,
  );
});

app.post("/api/slots/:id/book", (context) => {
  const shopper = signedInShopper(context);
  if (!shopper) {
    return context.json({ error: "signed_out", message: "Sign in to book a slot." }, 401);
  }
  const slotId = context.req.param("id");
  const problem = bookingProblem(slotId);
  if (problem) {
    return context.json({ error: problem.error, message: problem.message }, problem.status);
  }
  if (!on("double-book")) store.dropHolds(shopper.id);
  store.addHold(shopper.id, slotId);
  store.logEvent("slot_booked", { shopper: shopper.id, slotId });
  return context.json({ ok: true, slotId });
});

// ---------- checkout ----------

type PricedBasket = ReturnType<typeof priced>;

function orderFromBasket(shopper: store.Shopper, token: string, current: PricedBasket) {
  const totals = current.totals;
  const order: store.Order = {
    orderId: store.nextOrderId(),
    shopper: shopper.id,
    slotId: current.held[0].slotId,
    status: "placed",
    placedAt: store.now().toISOString(),
    token,
    lines: packOrder(current.basket.lines, shopper.allergens),
    subtotalCents: totals.subtotalCents,
    discountCents: totals.offerCents + totals.voucherCents,
    deliveryCents: totals.deliveryCents,
    totalCents: totals.totalCents,
    voucher: current.basket.voucher,
  };
  return order;
}

function logShopOrder(order: store.Order) {
  store.logEvent("order_placed", {
    shopper: order.shopper,
    orderId: order.orderId,
    via: "shop",
    totalCents: order.totalCents,
    lines: order.lines.map((line) => ({
      sku: line.sku,
      status: line.status,
      substituteSku: line.substituteSku,
    })),
  });
}

// A token from an older basket: show the order it already placed, or ask the shopper to look again.
function redirectStaleCheckout(context: Context, token: string) {
  const done = store.orderByToken(token);
  if (done) return context.redirect(`/orders/${done.orderId}`, 303);
  return context.redirect("/basket?error=Your basket changed. Check it and try again.", 303);
}

app.post("/checkout", async (context) => {
  const shopper = signedInShopper(context);
  if (!shopper) return context.redirect("/signin?next=/basket", 303);
  const form = await context.req.parseBody();
  const token = String(form.token ?? "");
  const current = priced(shopper.id);
  if (!on("back-resubmit") && token !== current.basket.token) {
    return redirectStaleCheckout(context, token);
  }
  if (!current.canCheckout) return redirectWithError(context, "/basket", current.reason);
  const order = orderFromBasket(shopper, token, current);
  store.saveOrder(order);
  if (!on("back-resubmit")) {
    store.useHolds(shopper.id, order.orderId);
    store.clearBasket(shopper.id);
  }
  logShopOrder(order);
  return context.redirect(`/orders/${order.orderId}`, 303);
});

// ---------- orders ----------

app.get("/orders", (context) => {
  const shopper = signedInShopper(context);
  if (!shopper) return context.redirect("/signin?next=/orders", 303);
  const orders = store.orders(shopper.id);
  return context.html(
    <Layout title="Orders" shopper={shopper} basketLines={lineCount(shopper.id)}>
      <h1>Your orders</h1>
      {orders.length === 0 ? (
        <p>No orders yet.</p>
      ) : (
        <ul data-testid="order-list">
          {orders.map((order) => (
            <li>
              <a href={`/orders/${order.orderId}`}>{order.orderId}</a>, {money(order.totalCents)}
            </li>
          ))}
        </ul>
      )}
    </Layout>,
  );
});

// The order named in the URL, but only when it belongs to this shopper.
function ownOrder(context: Context, shopper: store.Shopper): store.Order | null {
  const order = store.order(context.req.param("id") ?? "");
  if (!order || order.shopper !== shopper.id) return null;
  return order;
}

app.get("/orders/:id", (context) => {
  const shopper = signedInShopper(context);
  if (!shopper) return context.redirect("/signin?next=/orders", 303);
  const order = ownOrder(context, shopper);
  if (!order) return context.notFound();
  return context.html(
    <Layout title={`Order ${order.orderId}`} shopper={shopper} basketLines={lineCount(shopper.id)}>
      <OrderView order={order} slot={slotFor(order.slotId)} />
    </Layout>,
  );
});

app.get("/orders/:id/receipt", (context) => {
  const shopper = signedInShopper(context);
  if (!shopper) return context.redirect("/signin?next=/orders", 303);
  const order = ownOrder(context, shopper);
  if (!order) return context.notFound();
  context.header("Content-Disposition", `attachment; filename="receipt.json"`);
  const receipt = JSON.stringify(makeReceipt(order), null, 2);
  return context.body(`${receipt}\n`, 200, { "Content-Type": "application/json" });
});

// ---------- partner API (openapi.yaml) ----------

function isPartner(context: Context): boolean {
  return context.req.header("authorization") === `Bearer ${PARTNER_KEY}`;
}

function unauthorized(context: Context) {
  return context.json(
    { error: "unauthorized", message: "Send Authorization: Bearer <partner key>." },
    401,
  );
}

function invalidRequest(context: Context, message: string) {
  return context.json({ error: "invalid_request", message }, 400);
}

function shapeOrder(order: store.Order) {
  const { token, voucher, ...rest } = order;
  if (!on("api-field-rename")) return rest;
  const { slotId, ...others } = rest;
  // Partners on the old field name expect snake case here, so the key keeps its outside spelling.
  const renamed: Record<string, unknown> = { ...others };
  renamed.slot_id = slotId;
  return renamed;
}

app.get("/api/products", (context) => context.json(store.products()));
app.get("/api/slots", (context) =>
  context.json(
    store.slots().map(({ slotId, date, start, end, feeCents, remaining, status }) => ({
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

const wholeNumber = z.number().int();
const quantity = wholeNumber.min(1).max(20);
const weightInGrams = wholeNumber.min(250).max(5000);

const OrderBody = z.object({
  shopper: z.string(),
  slotId: z.string(),
  voucher: z.string().optional(),
  lines: z
    .array(
      z.object({
        sku: z.string(),
        qty: quantity.optional(),
        grams: weightInGrams.optional(),
        substitutes: z.boolean().optional(),
      }),
    )
    .min(1),
});
type OrderRequest = z.infer<typeof OrderBody>;

function describeIssues(issues: z.ZodError["issues"]): string {
  const sentences = issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  return sentences.join("; ");
}

// The slot problem for a partner order as a reply, or null when the slot can be booked.
function partnerSlotProblem(context: Context, slotId: string) {
  if (!parseSlotId(slotId)) {
    return context.json({ error: "slot_not_found", message: "There is no such slot." }, 404);
  }
  const problem = bookingProblem(slotId);
  if (problem?.error === "slot_full" && on("api-status")) throw new Error("capacity exceeded");
  if (problem) {
    return context.json({ error: problem.error, message: problem.message }, problem.status);
  }
  return null;
}

function partnerLines(request: OrderRequest, products: ProductsBySku): Line[] {
  return request.lines.map((line) => {
    const isWeighed = knownProduct(products, line.sku).unit === "kg";
    return {
      sku: line.sku,
      qty: isWeighed ? 1 : (line.qty ?? 1),
      grams: isWeighed ? (line.grams ?? 500) : 0,
      substitutes: line.substitutes ?? true,
    };
  });
}

function belowMinimum(context: Context) {
  const minimum = money(store.seed.store.minimumOrderCents);
  return context.json(
    { error: "below_minimum", message: `The minimum order is ${minimum} after discounts.` },
    422,
  );
}

function partnerTotals(request: OrderRequest, lines: Line[]): Totals {
  return priceBasket(lines, store.productMap(), {
    voucherPercent: voucherPercentFor(request.voucher),
    deliveryCents: slotFor(request.slotId)?.feeCents ?? 0,
  });
}

function savePartnerOrder(
  request: OrderRequest,
  shopper: store.Shopper,
  lines: Line[],
  totals: Totals,
) {
  const order: store.Order = {
    orderId: store.nextOrderId(),
    shopper: shopper.id,
    slotId: request.slotId,
    status: "placed",
    placedAt: store.now().toISOString(),
    token: null,
    lines: packOrder(lines, shopper.allergens),
    subtotalCents: totals.subtotalCents,
    discountCents: totals.offerCents + totals.voucherCents,
    deliveryCents: totals.deliveryCents,
    totalCents: totals.totalCents,
    voucher: request.voucher ?? null,
  };
  store.saveOrder(order);
  const booking =
    "INSERT INTO bookings (slot_id, shopper, order_id, created_at) VALUES (?, ?, ?, ?)";
  const bookedAt = store.now().toISOString();
  store.db.query(booking).run(request.slotId, shopper.id, order.orderId, bookedAt);
  return order;
}

function placePartnerOrder(context: Context, request: OrderRequest) {
  const shopper = store.shopper(request.shopper);
  if (!shopper) return invalidRequest(context, `Unknown shopper "${request.shopper}".`);
  const products = store.productMap();
  const unknownLine = request.lines.find((line) => !products.has(line.sku));
  if (unknownLine) return invalidRequest(context, `Unknown sku "${unknownLine.sku}".`);
  const slotProblem = partnerSlotProblem(context, request.slotId);
  if (slotProblem) return slotProblem;
  const lines = partnerLines(request, products);
  const totals = partnerTotals(request, lines);
  const minimum = store.seed.store.minimumOrderCents;
  if (totals.afterDiscountCents < minimum) return belowMinimum(context);
  const order = savePartnerOrder(request, shopper, lines, totals);
  store.logEvent("order_placed", {
    shopper: shopper.id,
    orderId: order.orderId,
    via: "api",
    totalCents: order.totalCents,
  });
  return context.json(shapeOrder(order), 201);
}

app.post("/api/orders", async (context) => {
  if (!isPartner(context)) return unauthorized(context);
  const parsed = OrderBody.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) return invalidRequest(context, describeIssues(parsed.error.issues));
  return placePartnerOrder(context, parsed.data);
});

app.get("/api/orders", (context) => {
  if (!isPartner(context)) return unauthorized(context);
  const orders = store.orders(context.req.query("shopper"));
  return context.json(orders.map(shapeOrder));
});
app.get("/api/orders/:id", (context) => {
  if (!isPartner(context)) return unauthorized(context);
  const order = store.order(context.req.param("id"));
  if (!order) {
    return context.json({ error: "order_not_found", message: "There is no such order." }, 404);
  }
  return context.json(shapeOrder(order));
});

// ---------- suggestions ----------

function suggestionReply(product: Product, shopper: store.Shopper, seed: number, picks: Product[]) {
  return {
    sku: product.sku,
    shopper: shopper.id,
    allergens: shopper.allergens,
    seed,
    suggestions: picks.map(({ sku, name, category, priceCents, allergens, stock }) => ({
      sku,
      name,
      category,
      priceCents,
      allergens,
      stock,
    })),
  };
}

app.get("/api/suggest", async (context) => {
  const product = store.product(context.req.query("sku") ?? "");
  const shopper = store.shopper(context.req.query("shopper") ?? "");
  const seed = Number(context.req.query("seed") ?? 1);
  if (!product || !shopper || !Number.isInteger(seed)) {
    return invalidRequest(context, "Send sku, shopper and a whole-number seed.");
  }
  try {
    const picks = await suggest(product, store.products(), shopper.allergens, seed);
    store.logEvent("suggested", {
      shopper: shopper.id,
      sku: product.sku,
      seed,
      suggestions: picks.map((pick) => pick.sku),
    });
    return context.json(suggestionReply(product, shopper, seed, picks));
  } catch (error) {
    if (error instanceof ReplayMiss) {
      return context.json({ error: "no_recorded_reply", message: error.message }, 503);
    }
    throw error;
  }
});

app.onError((error, context) => {
  store.logEvent("server_error", { path: context.req.path, message: error.message });
  return context.json({ error: "internal", message: "Something went wrong." }, 500);
});
