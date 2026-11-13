// The pages shoppers see. Server-rendered with Hono JSX, plus a few lines of browser script.

import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import { bugIsOn } from "./bugs";
import type { PricedLine, Product, Totals } from "./domain/basket";
import type { Slot } from "./domain/slots";
import type { Order, Shopper } from "./store";

export const release = () => (process.env.RELEASE ?? "v1").trim();
const isReleaseTwo = () => release() === "v2";

export const money = (cents: number) => {
  const sign = cents < 0 ? "-" : "";
  const dollars = (Math.abs(cents) / 100).toFixed(2);
  return `${sign}$${dollars}`;
};

export const grams = (weight: number) => {
  const isWholeKilograms = weight >= 1000 && weight % 1000 === 0;
  return isWholeKilograms ? `${weight / 1000} kg` : `${weight} g`;
};

export const LABELS = {
  add: () => (isReleaseTwo() ? "Add to basket" : "Add"),
  book: () => (isReleaseTwo() ? "Reserve" : "Book slot"),
  checkout: () => "Checkout",
};

const CSS = `
:root {
  --green:#1f6f4a; --ink:#1d2421; --muted:#5b6660; --line:#dfe5e1; --bg:#f6f8f6; --warn:#a4400b;
}
* { box-sizing: border-box; }
body {
  margin:0; font: 16px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color:var(--ink); background:var(--bg);
}
header {
  background:var(--green); color:#fff; padding:12px 20px; display:flex; gap:20px;
  align-items:center; flex-wrap:wrap;
}
header .brand {
  font-weight:700; font-size:20px; margin-right:auto; color:#fff; text-decoration:none;
}
header a { color:#fff; }
header .who { font-size:14px; opacity:.9; }
main { max-width:1040px; margin:0 auto; padding:20px; }
h1 { font-size:24px; margin:8px 0 16px; }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:14px; }
.card {
  background:#fff; border:1px solid var(--line); border-radius:10px; padding:14px;
  position:relative; display:flex; flex-direction:column; gap:8px;
}
.card h3 { font-size:16px; margin:0; }
.card .row { display:flex; justify-content:space-between; align-items:center; gap:8px; }
.price { font-weight:700; }
.note { font-size:13px; color:var(--warn); }
.badge {
  display:inline-block; background:#fff3c4; border-radius:6px; padding:1px 6px;
  font-size:12px; font-weight:600;
}
button, .button {
  background:var(--green); color:#fff; border:0; border-radius:8px; padding:8px 14px;
  font-size:15px; cursor:pointer; text-decoration:none; display:inline-block;
}
button[disabled] { background:#9aa7a0; cursor:not-allowed; }
button.plain { background:#fff; color:var(--ink); border:1px solid var(--line); padding:4px 10px; }
select, input[type=number], input[type=text], input[type=email], input[type=password] {
  padding:7px; border:1px solid #b9c4be; border-radius:6px; font-size:15px;
}
input[type=number] { width:64px; }
table {
  width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--line);
  border-radius:10px;
}
th, td { text-align:left; padding:10px; border-bottom:1px solid var(--line); vertical-align:top; }
.totals {
  margin-top:16px; background:#fff; border:1px solid var(--line); border-radius:10px;
  padding:14px; max-width:380px; margin-left:auto;
}
.totals div { display:flex; justify-content:space-between; padding:3px 0; }
.totals .grand {
  font-weight:700; font-size:18px; border-top:1px solid var(--line); margin-top:6px;
  padding-top:8px;
}
.panel {
  background:#fff; border:1px solid var(--line); border-radius:10px; padding:14px; margin:14px 0;
}
.toast {
  background:#e5f4ec; border:1px solid #9fd2b5; padding:10px 14px; border-radius:8px;
  margin-bottom:14px;
}
.error {
  background:#fdecea; border:1px solid #f1b5ad; padding:10px 14px; border-radius:8px;
  margin-bottom:14px;
}
fieldset {
  border:1px solid var(--line); border-radius:10px; background:#fff; margin:0 0 14px;
  padding:10px 14px;
}
legend { font-weight:700; padding:0 6px; }
.slots { display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:6px 16px; }
.slot { display:flex; gap:8px; align-items:center; padding:4px 0; }
.slot.unavailable { color:#5b6660; }
.suggestions { margin:6px 0 0; padding-left:18px; font-size:14px; }
dialog {
  border:1px solid var(--line); border-radius:12px; max-width:900px; width:calc(100% - 32px);
}
`;

// The planted visual bug: on narrow screens the price leaves its row and sits on the button.
const BUG_CSS = `@media (max-width: 400px) {
  .card .price { position:absolute; right:22px; bottom:20px; font-size:20px; background:#fff; }
}`;

function pageStyles(): string {
  if (bugIsOn("price-overlap")) return CSS + BUG_CSS;
  return CSS;
}

function SignedInAs({ shopper }: { shopper: Shopper }) {
  const allergens = shopper.allergens;
  const allergenNote = allergens.length ? ` (allergens: ${allergens.join(", ")})` : "";
  return (
    <span class="who">
      Signed in as {shopper.name}
      {allergenNote}{" "}
      <form method="post" action="/signout" style="display:inline">
        <button class="plain" type="submit">
          Sign out
        </button>
      </form>
    </span>
  );
}

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
        <style>{raw(pageStyles())}</style>
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
          {props.shopper ? <SignedInAs shopper={props.shopper} /> : <a href="/signin">Sign in</a>}
        </header>
        <main>{props.children}</main>
      </body>
    </html>
  );
}

const WEIGHT_CHOICES = [250, 500, 750, 1000, 1500, 2000];

function WeightPicker({ product }: { product: Product }) {
  return (
    <label>
      Weight{" "}
      <select name="grams" aria-label={`Weight of ${product.name}`}>
        {WEIGHT_CHOICES.map((weight) => (
          <option value={String(weight)} selected={weight === 500}>
            {grams(weight)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const isWeighed = product.unit === "kg";
  const price = isWeighed ? `${money(product.priceCents)} / kg` : money(product.priceCents);
  return (
    <article class="card" aria-label={product.name}>
      <h3>{product.name}</h3>
      {product.offer === "3for2" ? <span class="badge">3 for 2</span> : null}
      {product.stock <= 0 ? (
        <span class="note">Out of stock: we will substitute unless you say no</span>
      ) : null}
      <form method="post" action="/basket/add" class="row">
        <span class="price">{price}</span>
        <input type="hidden" name="sku" value={product.sku} />
        {isWeighed ? (
          <WeightPicker product={product} />
        ) : (
          <input type="hidden" name="qty" value="1" />
        )}
        <button type="submit">{LABELS.add()}</button>
      </form>
    </article>
  );
}

// The short note after a slot's time and fee: full, closed, a few left, or nothing.
function slotNote(slot: Slot): string {
  if (slot.status === "full") return "Full";
  if (slot.status === "closed") return "Closed";
  if (slot.remaining <= 3) return `${slot.remaining} left`;
  return "";
}

function SlotOption({ slot, held }: { slot: Slot; held: string[] }) {
  const inputId = `slot-${slot.slotId}`;
  const note = slotNote(slot);
  const noteText = note ? `, ${note}` : "";
  const text = `${slot.start} to ${slot.end}, ${money(slot.feeCents)}${noteText}`;
  const isOpen = slot.status === "open";
  return (
    <div class={`slot${isOpen ? "" : " unavailable"}`} data-slot={slot.slotId}>
      <input
        type="radio"
        name="slot"
        id={inputId}
        value={slot.slotId}
        disabled={!isOpen}
        checked={held.includes(slot.slotId)}
      />
      {bugIsOn("missing-label") ? (
        <span>{text}</span>
      ) : (
        <label for={inputId}>{`${slot.dateText} ${text}`}</label>
      )}
    </div>
  );
}

function SlotDay({ slots, held }: { slots: Slot[]; held: string[] }) {
  return (
    <fieldset>
      <legend>{slots[0].dateText}</legend>
      <div class="slots">
        {slots.map((slot) => (
          <SlotOption slot={slot} held={held} />
        ))}
      </div>
    </fieldset>
  );
}

// In the correct build the button ignores a second click while the first booking is on its way.
function slotPickerScript(): string {
  const guard = bugIsOn("double-book")
    ? ""
    : "if (busy) return; busy = true; document.getElementById('book').disabled = true;";
  return `
const slotForm = document.getElementById('slot-form'); let busy = false;
slotForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  ${guard}
  const chosen = new FormData(slotForm).get('slot');
  const errorBox = document.getElementById('slot-error');
  const showError = (message) => {
    errorBox.textContent = message; errorBox.hidden = false; busy = false;
    document.getElementById('book').disabled = false;
  };
  if (!chosen) { showError('Choose a slot first.'); return; }
  const response = await fetch('/api/slots/' + chosen + '/book', { method: 'POST' });
  if (response.ok) { location.href = '/basket?booked=' + chosen; return; }
  const reply = await response.json().catch(() => ({}));
  showError(reply.message || 'That slot could not be booked.');
});`;
}

export function SlotPicker({ slots, held }: { slots: Slot[]; held: string[] }) {
  const dates = [...new Set(slots.map((slot) => slot.date))];
  const form = (
    <form id="slot-form">
      {dates.map((date) => (
        <SlotDay slots={slots.filter((slot) => slot.date === date)} held={held} />
      ))}
      <div role="alert" id="slot-error" class="error" hidden></div>
      <button type="submit" id="book">
        {LABELS.book()}
      </button>
    </form>
  );
  const script = slotPickerScript();
  // Release v2 moves the picker into a dialog.
  if (isReleaseTwo()) {
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

function OutOfStockNote({ line }: { line: PricedLine }) {
  return (
    <div>
      <span class="note">Out of stock at the store</span>{" "}
      <button
        class="plain"
        type="button"
        data-suggest={line.sku}
        aria-label={`Suggest replacements for ${line.name}`}
      >
        Suggest replacements
      </button>
      <ul class="suggestions" data-testid={`suggestions-${line.sku}`}></ul>
    </div>
  );
}

function QuantityForm({ line }: { line: PricedLine }) {
  if (line.unit === "kg") return <span data-testid="line-weight">{grams(line.grams)}</span>;
  return (
    <form method="post" action={`/basket/lines/${line.sku}/qty`} style="display:inline">
      <input
        type="number"
        name="qty"
        value={String(line.qty)}
        aria-label={`Quantity of ${line.name}`}
      />{" "}
      <button class="plain" type="submit" aria-label={`Update ${line.name}`}>
        Update
      </button>
    </form>
  );
}

function QuantityCell({ line }: { line: PricedLine }) {
  return (
    <td>
      <form method="post" action={`/basket/lines/${line.sku}/decrement`} style="display:inline">
        <button class="plain" type="submit" aria-label={`Remove one ${line.name}`}>
          -
        </button>
      </form>{" "}
      <QuantityForm line={line} />{" "}
      <form method="post" action={`/basket/lines/${line.sku}/remove`} style="display:inline">
        <button class="plain" type="submit" aria-label={`Remove ${line.name}`}>
          Remove
        </button>
      </form>
    </td>
  );
}

function SubstitutesCell({ line }: { line: PricedLine }) {
  return (
    <td>
      <form method="post" action={`/basket/lines/${line.sku}/substitutes`}>
        <input type="hidden" name="allow" value={line.substitutes ? "no" : "yes"} />
        <label>
          <input
            type="checkbox"
            checked={line.substitutes}
            onchange="this.form.submit()"
            aria-label={`Allow substitutes for ${line.name}`}
          />{" "}
          Allow substitutes
        </label>
      </form>
    </td>
  );
}

function BasketRow({ line }: { line: PricedLine }) {
  return (
    <tr data-testid="basket-line" data-sku={line.sku}>
      <td>
        <strong>{line.name}</strong>
        {line.outOfStock ? <OutOfStockNote line={line} /> : null}
      </td>
      <QuantityCell line={line} />
      <SubstitutesCell line={line} />
      <td>
        <span data-testid="line-total">{money(line.totalCents)}</span>
        {line.offerCents ? <div class="badge">3 for 2: {money(-line.offerCents)}</div> : null}
      </td>
    </tr>
  );
}

function BasketTable({ lines }: { lines: PricedLine[] }) {
  if (lines.length === 0) return <p data-testid="empty-basket">Your basket is empty.</p>;
  return (
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
        {lines.map((line) => (
          <BasketRow line={line} />
        ))}
      </tbody>
    </table>
  );
}

function DeliveryPanel({ heldSlots }: { heldSlots: Slot[] }) {
  return (
    <div class="panel">
      <strong>Delivery</strong>
      {heldSlots.length ? (
        <ul data-testid="held-slots">
          {heldSlots.map((slot) => (
            <li>
              {slot.label} ({money(slot.feeCents)})
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No delivery slot booked. <a href="/slots">Choose a slot</a>
        </p>
      )}
    </div>
  );
}

type CheckoutProps = { token: string; canCheckout: boolean; reason: string };

function BasketTotals({ totals, checkout }: { totals: Totals; checkout: CheckoutProps }) {
  return (
    <div class="totals" data-testid="totals">
      <div>
        <span>Subtotal</span>
        <span data-testid="subtotal">{money(totals.subtotalCents)}</span>
      </div>
      <div>
        <span>Offers</span>
        <span data-testid="offers">{money(-totals.offerCents)}</span>
      </div>
      <div>
        <span>Voucher</span>
        <span data-testid="voucher">{money(-totals.voucherCents)}</span>
      </div>
      <div>
        <span>Delivery</span>
        <span data-testid="delivery">{money(totals.deliveryCents)}</span>
      </div>
      <div class="grand">
        <span>Total</span>
        <span data-testid="total">{money(totals.totalCents)}</span>
      </div>
      <form method="post" action="/checkout" style="margin-top:10px">
        <input type="hidden" name="token" value={checkout.token} />
        <button type="submit" disabled={!checkout.canCheckout}>
          {LABELS.checkout()}
        </button>
        {checkout.reason ? <p data-testid="checkout-blocked">{checkout.reason}</p> : null}
      </form>
    </div>
  );
}

// The browser asks for replacement ideas when the shopper clicks "Suggest replacements".
function suggestScript(shopperId: string): string {
  return `
const showPrice = (cents) => '$' + (cents / 100).toFixed(2);
const suggestionItems = (reply) => {
  const items = reply.suggestions.map(
    (pick) => '<li>' + pick.name + ' (' + showPrice(pick.priceCents) + ')</li>',
  );
  return items.join('') || '<li>No suggestion</li>';
};
const askForSuggestions = async (button) => {
  const sku = button.dataset.suggest;
  const list = document.querySelector('[data-testid="suggestions-' + sku + '"]');
  list.innerHTML = '<li>Thinking...</li>';
  // The suggester takes a moment, and not always the same moment.
  const delay = 100 + Math.floor(Math.random() * 700);
  await new Promise((resolve) => setTimeout(resolve, delay));
  const response = await fetch('/api/suggest?sku=' + sku + '&shopper=${shopperId}&seed=1');
  const reply = await response.json();
  if (response.ok) list.innerHTML = suggestionItems(reply);
  else list.innerHTML = '<li>' + (reply.message || 'No suggestion') + '</li>';
};
document.querySelectorAll('[data-suggest]').forEach((button) => {
  button.addEventListener('click', () => askForSuggestions(button));
});`;
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
  const checkout = { token: props.token, canCheckout: props.canCheckout, reason: props.reason };
  return (
    <div>
      <h1>Your basket</h1>
      <BasketTable lines={props.totals.lines} />
      <DeliveryPanel heldSlots={props.heldSlots} />
      <form method="post" action="/basket/voucher" class="panel">
        <label>
          Voucher code <input type="text" name="code" value={props.voucher ?? ""} />
        </label>{" "}
        <button type="submit">Apply</button>
      </form>
      <BasketTotals totals={props.totals} checkout={checkout} />
      <script>{raw(suggestScript(props.shopperId))}</script>
    </div>
  );
}

// What the store picker did with one order line.
function packingText(line: Order["lines"][number]): string {
  if (line.status === "packed") return "Packed";
  if (line.status === "substituted") return `Substituted with ${line.substituteName}`;
  return "Not available";
}

function OrderTotals({ order }: { order: Order }) {
  return (
    <div class="totals">
      <div>
        <span>Subtotal</span>
        <span>{money(order.subtotalCents)}</span>
      </div>
      <div>
        <span>Discounts</span>
        <span>{money(-order.discountCents)}</span>
      </div>
      <div>
        <span>Delivery</span>
        <span>{money(order.deliveryCents)}</span>
      </div>
      <div class="grand">
        <span>Total</span>
        <span data-testid="order-total">{money(order.totalCents)}</span>
      </div>
    </div>
  );
}

export function OrderView({ order, slot }: { order: Order; slot?: Slot }) {
  return (
    <div>
      <h1>Order {order.orderId} placed</h1>
      <p data-testid="order-slot">Delivery: {slot ? slot.label : order.slotId}</p>
      <p>
        <a href={`/orders/${order.orderId}/receipt`} download="receipt.json">
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
          {order.lines.map((line) => (
            <tr data-testid="order-line" data-sku={line.sku}>
              <td>{line.name}</td>
              <td>{line.grams ? grams(line.grams) : String(line.qty)}</td>
              <td data-testid="packing">{packingText(line)}</td>
              <td>{money(line.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <OrderTotals order={order} />
    </div>
  );
}
