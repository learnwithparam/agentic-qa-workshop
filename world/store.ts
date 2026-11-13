// The system of record: one SQLite file and one event log per running shop.
// PANTRY_DATA picks the folder, so checks can run several shops side by side.
import { Database } from "bun:sqlite";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Line, Product } from "./domain/basket";
import { addDays, localParts } from "./domain/clock";
import { listSlots, type Slot } from "./domain/slots";
import seedJson from "./seed.json";

export type Seed = typeof seedJson;
export type Shopper = {
  id: string;
  email: string;
  password: string;
  name: string;
  allergens: string[];
};
export type Order = {
  orderId: string;
  shopper: string;
  slotId: string;
  status: "placed";
  placedAt: string;
  token: string | null;
  lines: (Line & {
    name: string;
    totalCents: number;
    status: string;
    substituteSku?: string;
    substituteName?: string;
  })[];
  subtotalCents: number;
  discountCents: number;
  deliveryCents: number;
  totalCents: number;
  voucher: string | null;
};
export type Basket = {
  shopper: string;
  lines: Line[];
  voucher: string | null;
  peakCents: number;
  token: string;
};

export const seed: Seed = seedJson;
export const DATA_DIR = process.env.PANTRY_DATA ?? join(import.meta.dir, ".data");
const DB_PATH = join(DATA_DIR, "shop.db");
export const EVENTS_PATH = join(DATA_DIR, "events.jsonl");

mkdirSync(DATA_DIR, { recursive: true });
export const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode = WAL;");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (sku TEXT PRIMARY KEY, json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS shoppers (id TEXT PRIMARY KEY, json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id TEXT NOT NULL,
  shopper TEXT,
  order_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS baskets (shopper TEXT PRIMARY KEY, json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  shopper TEXT NOT NULL,
  token TEXT,
  json TEXT NOT NULL,
  seq INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

const TABLES = ["products", "shoppers", "bookings", "baskets", "orders", "meta"];

// Most rows keep the whole record as JSON text in one column.
type JsonRow = { json: string };
type CountRow = { count: number };

export function logEvent(type: string, data: Record<string, unknown> = {}) {
  const event = {
    at: new Date().toISOString(),
    storeTime: now().toISOString(),
    type,
    ...data,
  };
  appendFileSync(EVENTS_PATH, `${JSON.stringify(event)}\n`);
}

export function readEvents(dir = DATA_DIR): { type: string; [field: string]: unknown }[] {
  const path = join(dir, "events.jsonl");
  if (!existsSync(path)) {
    return [];
  }
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n").filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}

// Store clock: frozen at the seed time unless a test moves it.
export function now(): Date {
  const query = db.query("SELECT value FROM meta WHERE key = 'clock'");
  const row = query.get() as { value: string } | null;
  return new Date(row?.value ?? seed.store.clock);
}
export function setClock(iso: string) {
  const moment = new Date(iso);
  if (Number.isNaN(moment.getTime())) {
    throw new RangeError(`"${iso}" is not a date and time`);
  }
  const clock = moment.toISOString();
  db.query("INSERT OR REPLACE INTO meta (key, value) VALUES ('clock', ?)").run(clock);
  logEvent("clock_set", { clock });
}

function insertSeedRecords() {
  const insertProduct = db.prepare("INSERT INTO products (sku, json) VALUES (?, ?)");
  for (const seedProduct of seed.products) {
    insertProduct.run(seedProduct.sku, JSON.stringify(seedProduct));
  }
  const insertShopper = db.prepare("INSERT INTO shoppers (id, json) VALUES (?, ?)");
  for (const seedShopper of seed.shoppers) {
    insertShopper.run(seedShopper.id, JSON.stringify(seedShopper));
  }
}

// The seed fills some slots in advance, so a full slot is there to find from the start.
function insertSeedBookings() {
  const today = localParts(new Date(seed.store.clock), seed.store.timeZone).date;
  const insertBooking = db.prepare(
    "INSERT INTO bookings (slot_id, shopper, order_id, created_at) VALUES (?, NULL, 'seed', ?)",
  );
  for (const booking of seed.slotBookings) {
    const date = addDays(today, booking.dateOffset);
    const hour = String(booking.hour).padStart(2, "0");
    const slotId = `${date}T${hour}`;
    for (let i = 0; i < booking.booked; i++) {
      insertBooking.run(slotId, seed.store.clock);
    }
  }
}

export function reset() {
  const dropStatements = TABLES.map((table) => `DROP TABLE IF EXISTS ${table};`);
  db.exec(dropStatements.join(" "));
  db.exec(SCHEMA);
  insertSeedRecords();
  insertSeedBookings();
  // The event log survives a reset, so a check can see every run, not only the last one.
  logEvent("reset");
}

function countRows(table: string): number {
  const row = db.query(`SELECT COUNT(*) AS count FROM ${table}`).get() as CountRow;
  return row.count;
}

export function ensureSeeded() {
  db.exec(SCHEMA);
  if (countRows("products") === 0) {
    reset();
  }
}

function parseRows<Item>(rows: JsonRow[]): Item[] {
  return rows.map((row) => JSON.parse(row.json));
}

function parseRow<Item>(row: JsonRow | null): Item | undefined {
  if (!row) {
    return undefined;
  }
  return JSON.parse(row.json);
}

export function products(): Product[] {
  const rows = db.query("SELECT json FROM products ORDER BY rowid").all() as JsonRow[];
  return parseRows<Product>(rows);
}
export const productMap = () => {
  const allProducts = products();
  return new Map(allProducts.map((item) => [item.sku, item]));
};
export function product(sku: string): Product | undefined {
  const row = db.query("SELECT json FROM products WHERE sku = ?").get(sku) as JsonRow | null;
  return parseRow<Product>(row);
}

export function shoppers(): Shopper[] {
  const rows = db.query("SELECT json FROM shoppers ORDER BY rowid").all() as JsonRow[];
  return parseRows<Shopper>(rows);
}
export const shopper = (id: string) => shoppers().find((person) => person.id === id);

export function bookedCounts(): Record<string, number> {
  const query = db.query(
    "SELECT slot_id AS slotId, COUNT(*) AS count FROM bookings GROUP BY slot_id",
  );
  const rows = query.all() as { slotId: string; count: number }[];
  return Object.fromEntries(rows.map((row) => [row.slotId, row.count]));
}
export function slots(): Slot[] {
  return listSlots(now(), seed.store.timeZone, bookedCounts(), seed.store.slotCapacity);
}

// Slot holds: bookings a shopper made that no order has used yet.
// The rows keep the database column name slot_id, because world/app.tsx reads it.
// biome-ignore lint/style/useNamingConvention: database column names use snake_case
type Hold = { id: number; slot_id: string };
export function holds(shopperId: string): Hold[] {
  const query = db.query(
    "SELECT id, slot_id FROM bookings WHERE shopper = ? AND order_id IS NULL ORDER BY id",
  );
  return query.all(shopperId) as Hold[];
}
export function addHold(shopperId: string, slotId: string) {
  const query = db.query(
    "INSERT INTO bookings (slot_id, shopper, order_id, created_at) VALUES (?, ?, NULL, ?)",
  );
  query.run(slotId, shopperId, now().toISOString());
}
export function dropHolds(shopperId: string) {
  db.query("DELETE FROM bookings WHERE shopper = ? AND order_id IS NULL").run(shopperId);
}
export function useHolds(shopperId: string, orderId: string) {
  const sql = `
    UPDATE bookings SET order_id = ?
    WHERE shopper = ? AND order_id IS NULL`;
  db.query(sql).run(orderId, shopperId);
}

const newToken = () => crypto.randomUUID();
const emptyBasket = (shopperId: string): Basket => ({
  shopper: shopperId,
  lines: [],
  voucher: null,
  peakCents: 0,
  token: newToken(),
});
export function basket(shopperId: string): Basket {
  const query = db.query("SELECT json FROM baskets WHERE shopper = ?");
  const row = query.get(shopperId) as JsonRow | null;
  return parseRow<Basket>(row) ?? emptyBasket(shopperId);
}
export function saveBasket(shopperBasket: Basket) {
  const query = db.query("INSERT OR REPLACE INTO baskets (shopper, json) VALUES (?, ?)");
  query.run(shopperBasket.shopper, JSON.stringify(shopperBasket));
}
export function clearBasket(shopperId: string) {
  saveBasket(emptyBasket(shopperId));
}

export function nextOrderId(): string {
  return `PR-${String(1001 + countRows("orders"))}`;
}
export function saveOrder(newOrder: Order) {
  const seq = countRows("orders");
  const query = db.query(
    "INSERT INTO orders (id, shopper, token, json, seq) VALUES (?, ?, ?, ?, ?)",
  );
  query.run(newOrder.orderId, newOrder.shopper, newOrder.token, JSON.stringify(newOrder), seq);
}
export function order(id: string): Order | undefined {
  const row = db.query("SELECT json FROM orders WHERE id = ?").get(id) as JsonRow | null;
  return parseRow<Order>(row);
}
export function orderByToken(token: string): Order | undefined {
  const query = db.query("SELECT json FROM orders WHERE token = ?");
  const row = query.get(token) as JsonRow | null;
  return parseRow<Order>(row);
}
export function orders(shopperId?: string): Order[] {
  let rows: JsonRow[];
  if (shopperId) {
    const query = db.query("SELECT json FROM orders WHERE shopper = ? ORDER BY seq");
    rows = query.all(shopperId) as JsonRow[];
  } else {
    rows = db.query("SELECT json FROM orders ORDER BY seq").all() as JsonRow[];
  }
  return parseRows<Order>(rows);
}
