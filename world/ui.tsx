// The pages shoppers see. Server-rendered with Hono JSX, plus a few lines of browser script.

import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import { on } from "./bugs";
import type { Product, Totals } from "./domain/basket";
import type { Slot } from "./domain/slots";
import type { Order, Shopper } from "./store";

export const release = () => (process.env.RELEASE ?? "v1").trim();
const v2 = () => release() === "v2";
export const money = (c: number) => `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toFixed(2)}`;
export const grams = (g: number) => (g >= 1000 && g % 1000 === 0 ? `${g / 1000} kg` : `${g} g`);
export const LABELS = {
  add: () => (v2() ? "Add to basket" : "Add"),
  book: () => (v2() ? "Reserve" : "Book slot"),
  checkout: () => "Checkout",
};

const CSS = `
:root { --green:#1f6f4a; --ink:#1d2421; --muted:#5b6660; --line:#dfe5e1; --bg:#f6f8f6; --warn:#a4400b; }
* { box-sizing: border-box; }
body { margin:0; font: 16px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color:var(--ink); background:var(--bg); }
header { background:var(--green); color:#fff; padding:12px 20px; display:flex; gap:20px; align-items:center; flex-wrap:wrap; }
header .brand { font-weight:700; font-size:20px; margin-right:auto; color:#fff; text-decoration:none; }
header a { color:#fff; }
header .who { font-size:14px; opacity:.9; }
main { max-width:1040px; margin:0 auto; padding:20px; }
h1 { font-size:24px; margin:8px 0 16px; }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:14px; }
.card { background:#fff; border:1px solid var(--line); border-radius:10px; padding:14px; position:relative; display:flex; flex-direction:column; gap:8px; }
.card h3 { font-size:16px; margin:0; }
.card .row { display:flex; justify-content:space-between; align-items:center; gap:8px; }
.price { font-weight:700; }
.note { font-size:13px; color:var(--warn); }
.badge { display:inline-block; background:#fff3c4; border-radius:6px; padding:1px 6px; font-size:12px; font-weight:600; }
button, .button { background:var(--green); color:#fff; border:0; border-radius:8px; padding:8px 14px; font-size:15px; cursor:pointer; text-decoration:none; display:inline-block; }
button[disabled] { background:#9aa7a0; cursor:not-allowed; }
button.plain { background:#fff; color:var(--ink); border:1px solid var(--line); padding:4px 10px; }
select, input[type=number], input[type=text], input[type=email], input[type=password] { padding:7px; border:1px solid #b9c4be; border-radius:6px; font-size:15px; }
input[type=number] { width:64px; }
table { width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--line); border-radius:10px; }
th, td { text-align:left; padding:10px; border-bottom:1px solid var(--line); vertical-align:top; }
.totals { margin-top:16px; background:#fff; border:1px solid var(--line); border-radius:10px; padding:14px; max-width:380px; margin-left:auto; }
.totals div { display:flex; justify-content:space-between; padding:3px 0; }
.totals .grand { font-weight:700; font-size:18px; border-top:1px solid var(--line); margin-top:6px; padding-top:8px; }
.panel { background:#fff; border:1px solid var(--line); border-radius:10px; padding:14px; margin:14px 0; }
.toast { background:#e5f4ec; border:1px solid #9fd2b5; padding:10px 14px; border-radius:8px; margin-bottom:14px; }
.error { background:#fdecea; border:1px solid #f1b5ad; padding:10px 14px; border-radius:8px; margin-bottom:14px; }
fieldset { border:1px solid var(--line); border-radius:10px; background:#fff; margin:0 0 14px; padding:10px 14px; }
legend { font-weight:700; padding:0 6px; }
.slots { display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:6px 16px; }
.slot { display:flex; gap:8px; align-items:center; padding:4px 0; }
.slot.unavailable { color:#5b6660; }
.suggestions { margin:6px 0 0; padding-left:18px; font-size:14px; }
dialog { border:1px solid var(--line); border-radius:12px; max-width:900px; width:calc(100% - 32px); }
`;

// The planted visual bug: at narrow widths the price is pulled out of the row and sits on the button.
const BUG_CSS = `@media (max-width: 400px) { .card .price { position:absolute; right:22px; bottom:20px; font-size:20px; background:#fff; } }`;

export function Layout(props: {
  title: string;
  shopper?: Shopper | null;
  basketLines?: number;
  children: Child;
}) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${props.title} | Pantry Run`}</title>
        <style>{raw(CSS + (on("price-overlap") ? BUG_CSS : ""))}</style>
      </head>
      <body>
        <header>
          <a class="brand" href="/">
            Pantry Run
          </a>
          <nav style="display:flex;gap:16px">
            <a href="/">Shop</a>
            <a href="/slots">Delivery slots</a>
            <a href="/basket">
              Basket (<span data-testid="basket-count">{props.basketLines ?? 0}</span>)
            </a>
            {props.shopper ? <a href="/orders">Orders</a> : null}
          </nav>
          {props.shopper ? (
            <span class="who">
              Signed in as {props.shopper.name}
              {props.shopper.allergens.length
                ? ` (allergens: ${props.shopper.allergens.join(", ")})`
                : ""}{" "}
              <form method="post" action="/signout" style="display:inline">
                <button class="plain" type="submit">
                  Sign out
                </button>
              </form>
            </span>
          ) : (
            <a href="/signin">Sign in</a>
          )}
        </header>
        <main>{props.children}</main>
      </body>
    </html>
  );
}

export function ProductCard({ p }: { p: Product }) {
  return (
    <article class="card" aria-label={p.name}>
      <h3>{p.name}</h3>
      {p.offer === "3for2" ? <span class="badge">3 for 2</span> : null}
      {p.stock <= 0 ? (
        <span class="note">Out of stock: we will substitute unless you say no</span>
      ) : null}
      <form method="post" action="/basket/add" class="row">
        <span class="price">
          {p.unit === "kg" ? `${money(p.priceCents)} / kg` : money(p.priceCents)}
        </span>
        <input type="hidden" name="sku" value={p.sku} />
        {p.unit === "kg" ? (
          <label>
            Weight{" "}
            <select name="grams" aria-label={`Weight of ${p.name}`}>
              {[250, 500, 750, 1000, 1500, 2000].map((g) => (
                <option value={String(g)} selected={g === 500}>
                  {grams(g)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="qty" value="1" />
        )}
        <button type="submit">{LABELS.add()}</button>
      </form>
    </article>
  );
}

export function SlotPicker({ slots, held }: { slots: Slot[]; held: string[] }) {
  const dates = [...new Set(slots.map((s) => s.date))];
  const unlabeled = on("missing-label");
  const form = (
    <form id="slot-form">
      {dates.map((d) => {
        const ds = slots.filter((s) => s.date === d);
        return (
          <fieldset>
            <legend>{ds[0].dateText}</legend>
            <div class="slots">
              {ds.map((s) => {
                const id = `slot-${s.slotId}`;
                const extra =
                  s.status === "full"
                    ? "Full"
                    : s.status === "closed"
                      ? "Closed"
                      : s.remaining <= 3
                        ? `${s.remaining} left`
                        : "";
                const text = `${s.start} to ${s.end}, ${money(s.feeCents)}${extra ? `, ${extra}` : ""}`;
                return (
                  <div
                    class={`slot${s.status === "open" ? "" : " unavailable"}`}
                    data-slot={s.slotId}
                  >
                    <input
                      type="radio"
                      name="slot"
                      id={id}
                      value={s.slotId}
                      disabled={s.status !== "open"}
                      checked={held.includes(s.slotId)}
                    />
                    {unlabeled ? (
                      <span>{text}</span>
                    ) : (
                      <label for={id}>{`${s.dateText} ${text}`}</label>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      <div role="alert" id="slot-error" class="error" hidden></div>
      <button type="submit" id="book">
        {LABELS.book()}
      </button>
    </form>
  );
  // In the correct build the button ignores a second click while the first booking is on its way.
  const script = `
const f = document.getElementById('slot-form'); let busy = false;
f.addEventListener('submit', async (e) => {
  e.preventDefault();
  ${on("double-book") ? "" : "if (busy) return; busy = true; document.getElementById('book').disabled = true;"}
  const v = new FormData(f).get('slot'); const err = document.getElementById('slot-error');
  if (!v) { err.textContent = 'Choose a slot first.'; err.hidden = false; busy = false; document.getElementById('book').disabled = false; return; }
  const r = await fetch('/api/slots/' + v + '/book', { method: 'POST' });
  if (r.ok) { location.href = '/basket?booked=' + v; return; }
  const j = await r.json().catch(() => ({}));
  err.textContent = j.message || 'That slot could not be booked.'; err.hidden = false; busy = false; document.getElementById('book').disabled = false;
});`;
  // Release v2 moves the picker into a dialog.
  if (v2()) {
    return (
      <div>
        <button type="button" onclick="document.getElementById('slot-dialog').showModal()">
          Choose a delivery time
        </button>
        <dialog id="slot-dialog" aria-label="Choose a delivery time">
          {form}
        </dialog>
        <script>{raw(script)}</script>
      </div>
    );
  }
  return (
    <div>
      {form}
      <script>{raw(script)}</script>
    </div>
  );
}

export function BasketView(props: {
  totals: Totals;
  heldSlots: Slot[];
  canCheckout: boolean;
  reason: string;
  token: string;
  voucher: string | null;
  shopperId: string;
}) {
  const t = props.totals;
  return (
    <div>
      <h1>Your basket</h1>
      {t.lines.length === 0 ? (
        <p data-testid="empty-basket">Your basket is empty.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Substitutes</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {t.lines.map((l) => (
              <tr data-testid="basket-line" data-sku={l.sku}>
                <td>
                  <strong>{l.name}</strong>
                  {l.outOfStock ? (
                    <div>
                      <span class="note">Out of stock at the store</span>{" "}
                      <button
                        class="plain"
                        type="button"
                        data-suggest={l.sku}
                        aria-label={`Suggest replacements for ${l.name}`}
                      >
                        Suggest replacements
                      </button>
                      <ul class="suggestions" data-testid={`suggestions-${l.sku}`}></ul>
                    </div>
                  ) : null}
                </td>
                <td>
                  <form
                    method="post"
                    action={`/basket/lines/${l.sku}/decrement`}
                    style="display:inline"
                  >
                    <button class="plain" type="submit" aria-label={`Remove one ${l.name}`}>
                      -
                    </button>
                  </form>{" "}
                  {l.unit === "kg" ? (
                    <span data-testid="line-weight">{grams(l.grams)}</span>
                  ) : (
                    <form
                      method="post"
                      action={`/basket/lines/${l.sku}/qty`}
                      style="display:inline"
                    >
                      <input
                        type="number"
                        name="qty"
                        value={String(l.qty)}
                        aria-label={`Quantity of ${l.name}`}
                      />{" "}
                      <button class="plain" type="submit" aria-label={`Update ${l.name}`}>
                        Update
                      </button>
                    </form>
                  )}{" "}
                  <form
                    method="post"
                    action={`/basket/lines/${l.sku}/remove`}
                    style="display:inline"
                  >
                    <button class="plain" type="submit" aria-label={`Remove ${l.name}`}>
                      Remove
                    </button>
                  </form>
                </td>
                <td>
                  <form method="post" action={`/basket/lines/${l.sku}/substitutes`}>
                    <input type="hidden" name="allow" value={l.substitutes ? "no" : "yes"} />
                    <label>
                      <input
                        type="checkbox"
                        checked={l.substitutes}
                        onchange="this.form.submit()"
                        aria-label={`Allow substitutes for ${l.name}`}
                      />{" "}
                      Allow substitutes
                    </label>
                  </form>
                </td>
                <td>
                  <span data-testid="line-total">{money(l.totalCents)}</span>
                  {l.offerCents ? <div class="badge">3 for 2: {money(-l.offerCents)}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div class="panel">
        <strong>Delivery</strong>
        {props.heldSlots.length ? (
          <ul data-testid="held-slots">
            {props.heldSlots.map((s) => (
              <li>
                {s.label} ({money(s.feeCents)})
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No delivery slot booked. <a href="/slots">Choose a slot</a>
          </p>
        )}
      </div>
      <form method="post" action="/basket/voucher" class="panel">
        <label>
          Voucher code <input type="text" name="code" value={props.voucher ?? ""} />
        </label>{" "}
        <button type="submit">Apply</button>
      </form>
      <div class="totals" data-testid="totals">
        <div>
          <span>Subtotal</span>
          <span data-testid="subtotal">{money(t.subtotalCents)}</span>
        </div>
        <div>
          <span>Offers</span>
          <span data-testid="offers">{money(-t.offerCents)}</span>
        </div>
        <div>
          <span>Voucher</span>
          <span data-testid="voucher">{money(-t.voucherCents)}</span>
        </div>
        <div>
          <span>Delivery</span>
          <span data-testid="delivery">{money(t.deliveryCents)}</span>
        </div>
        <div class="grand">
          <span>Total</span>
          <span data-testid="total">{money(t.totalCents)}</span>
        </div>
        <form method="post" action="/checkout" style="margin-top:10px">
          <input type="hidden" name="token" value={props.token} />
          <button type="submit" disabled={!props.canCheckout}>
            {LABELS.checkout()}
          </button>
          {props.reason ? <p data-testid="checkout-blocked">{props.reason}</p> : null}
        </form>
      </div>
      <script>
        {raw(`
document.querySelectorAll('[data-suggest]').forEach((b) => b.addEventListener('click', async () => {
  const sku = b.dataset.suggest; const ul = document.querySelector('[data-testid="suggestions-' + sku + '"]');
  ul.innerHTML = '<li>Thinking...</li>';
  // The suggester takes a moment, and not always the same moment.
  await new Promise((r) => setTimeout(r, 100 + Math.floor(Math.random() * 700)));
  const r = await fetch('/api/suggest?sku=' + sku + '&shopper=${props.shopperId}&seed=1');
  const j = await r.json();
  ul.innerHTML = r.ok ? j.suggestions.map((s) => '<li>' + s.name + ' (' + '$' + (s.priceCents / 100).toFixed(2) + ')</li>').join('') || '<li>No suggestion</li>' : '<li>' + (j.message || 'No suggestion') + '</li>';
}));`)}
      </script>
    </div>
  );
}

const STATUS_TEXT = (l: Order["lines"][number]) =>
  l.status === "packed"
    ? "Packed"
    : l.status === "substituted"
      ? `Substituted with ${l.substituteName}`
      : "Not available";

export function OrderView({ o, slot }: { o: Order; slot?: Slot }) {
  return (
    <div>
      <h1>Order {o.orderId} placed</h1>
      <p data-testid="order-slot">Delivery: {slot ? slot.label : o.slotId}</p>
      <p>
        <a href={`/orders/${o.orderId}/receipt`} download="receipt.json">
          Download receipt
        </a>
      </p>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Amount</th>
            <th>Packing</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {o.lines.map((l) => (
            <tr data-testid="order-line" data-sku={l.sku}>
              <td>{l.name}</td>
              <td>{l.grams ? grams(l.grams) : String(l.qty)}</td>
              <td data-testid="packing">{STATUS_TEXT(l)}</td>
              <td>{money(l.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div class="totals">
        <div>
          <span>Subtotal</span>
          <span>{money(o.subtotalCents)}</span>
        </div>
        <div>
          <span>Discounts</span>
          <span>{money(-o.discountCents)}</span>
        </div>
        <div>
          <span>Delivery</span>
          <span>{money(o.deliveryCents)}</span>
        </div>
        <div class="grand">
          <span>Total</span>
          <span data-testid="order-total">{money(o.totalCents)}</span>
        </div>
      </div>
    </div>
  );
}
