// The system of record: one SQLite file and one event log per running shop.
// PANTRY_DATA picks the folder, so checks can run several shops side by side.
import { Database } from "bun:sqlite";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import seedJson from "./seed.json";
import { addDays, localParts } from "./domain/clock";
import type { Line, Product } from "./domain/basket";
import { listSlots, type Slot } from "./domain/slots";

export type Seed = typeof seedJson;
export type Shopper = { id: string; email: string; password: string; name: string; allergens: string[] };
export type Order = {
  orderId: string; shopper: string; slotId: string; status: "placed"; placedAt: string; token: string | null;
  lines: (Line & { name: string; totalCents: number; status: string; substituteSku?: string; substituteName?: string })[];
  subtotalCents: number; discountCents: number; deliveryCents: number; totalCents: number; voucher: string | null;
};
export type Basket = { shopper: string; lines: Line[]; voucher: string | null; peakCents: number; token: string };

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
CREATE TABLE IF NOT EXISTS bookings (id INTEGER PRIMARY KEY AUTOINCREMENT, slot_id TEXT NOT NULL, shopper TEXT, order_id TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS baskets (shopper TEXT PRIMARY KEY, json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, shopper TEXT NOT NULL, token TEXT, json TEXT NOT NULL, seq INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

export function logEvent(type: string, data: Record<string, unknown> = {}) {
  appendFileSync(EVENTS_PATH, JSON.stringify({ at: new Date().toISOString(), storeTime: now().toISOString(), type, ...data }) + "\n");
}

export function readEvents(dir = DATA_DIR): { type: string; [k: string]: unknown }[] {
  const p = join(dir, "events.jsonl");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// Store clock: frozen at the seed time unless a test moves it.
export function now(): Date {
  const row = db.query("SELECT value FROM meta WHERE key = 'clock'").get() as { value: string } | null;
  return new Date(row?.value ?? seed.store.clock);
}
export function setClock(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new RangeError(`"${iso}" is not a date and time`);
  db.query("INSERT OR REPLACE INTO meta (key, value) VALUES ('clock', ?)").run(d.toISOString());
  logEvent("clock_set", { clock: d.toISOString() });
}

export function reset() {
  db.exec("DROP TABLE IF EXISTS products; DROP TABLE IF EXISTS shoppers; DROP TABLE IF EXISTS bookings; DROP TABLE IF EXISTS baskets; DROP TABLE IF EXISTS orders; DROP TABLE IF EXISTS meta;");
  db.exec(SCHEMA);
  const ip = db.prepare("INSERT INTO products (sku, json) VALUES (?, ?)");
  for (const p of seed.products) ip.run(p.sku, JSON.stringify(p));
  const is = db.prepare("INSERT INTO shoppers (id, json) VALUES (?, ?)");
  for (const s of seed.shoppers) is.run(s.id, JSON.stringify(s));
  const today = localParts(new Date(seed.store.clock), seed.store.timeZone).date;
  const ib = db.prepare("INSERT INTO bookings (slot_id, shopper, order_id, created_at) VALUES (?, NULL, 'seed', ?)");
  for (const b of seed.slotBookings) {
    const id = `${addDays(today, b.dateOffset)}T${String(b.hour).padStart(2, "0")}`;
    for (let i = 0; i < b.booked; i++) ib.run(id, seed.store.clock);
  }
  // The event log survives a reset, so a check can see every run, not only the last one.
  logEvent("reset");
}

export function ensureSeeded() {
  db.exec(SCHEMA);
  const n = (db.query("SELECT COUNT(*) AS n FROM products").get() as { n: number }).n;
  if (n === 0) reset();
}

export function products(): Product[] {
  return (db.query("SELECT json FROM products ORDER BY rowid").all() as { json: string }[]).map((r) => JSON.parse(r.json));
}
export const productMap = () => new Map(products().map((p) => [p.sku, p]));
export function product(sku: string): Product | undefined {
  const r = db.query("SELECT json FROM products WHERE sku = ?").get(sku) as { json: string } | null;
  return r ? JSON.parse(r.json) : undefined;
}

export function shoppers(): Shopper[] {
  return (db.query("SELECT json FROM shoppers ORDER BY rowid").all() as { json: string }[]).map((r) => JSON.parse(r.json));
}
export const shopper = (id: string) => shoppers().find((s) => s.id === id);

export function bookedCounts(): Record<string, number> {
  const rows = db.query("SELECT slot_id, COUNT(*) AS n FROM bookings GROUP BY slot_id").all() as { slot_id: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.slot_id, r.n]));
}
export function slots(): Slot[] {
  return listSlots(now(), seed.store.timeZone, bookedCounts(), seed.store.slotCapacity);
}

// Slot holds: bookings a shopper made that no order has used yet.
export function holds(shopperId: string): { id: number; slot_id: string }[] {
  return db.query("SELECT id, slot_id FROM bookings WHERE shopper = ? AND order_id IS NULL ORDER BY id").all(shopperId) as { id: number; slot_id: string }[];
}
export function addHold(shopperId: string, slotId: string) {
  db.query("INSERT INTO bookings (slot_id, shopper, order_id, created_at) VALUES (?, ?, NULL, ?)").run(slotId, shopperId, now().toISOString());
}
export function dropHolds(shopperId: string) {
  db.query("DELETE FROM bookings WHERE shopper = ? AND order_id IS NULL").run(shopperId);
}
export function useHolds(shopperId: string, orderId: string) {
  db.query("UPDATE bookings SET order_id = ? WHERE shopper = ? AND order_id IS NULL").run(orderId, shopperId);
}

const newToken = () => crypto.randomUUID();
export function basket(shopperId: string): Basket {
  const r = db.query("SELECT json FROM baskets WHERE shopper = ?").get(shopperId) as { json: string } | null;
  return r ? JSON.parse(r.json) : { shopper: shopperId, lines: [], voucher: null, peakCents: 0, token: newToken() };
}
export function saveBasket(b: Basket) {
  db.query("INSERT OR REPLACE INTO baskets (shopper, json) VALUES (?, ?)").run(b.shopper, JSON.stringify(b));
}
export function clearBasket(shopperId: string) {
  saveBasket({ shopper: shopperId, lines: [], voucher: null, peakCents: 0, token: newToken() });
}

export function nextOrderId(): string {
  const n = (db.query("SELECT COUNT(*) AS n FROM orders").get() as { n: number }).n;
  return `PR-${String(1001 + n)}`;
}
export function saveOrder(o: Order) {
  const seq = (db.query("SELECT COUNT(*) AS n FROM orders").get() as { n: number }).n;
  db.query("INSERT INTO orders (id, shopper, token, json, seq) VALUES (?, ?, ?, ?, ?)").run(o.orderId, o.shopper, o.token, JSON.stringify(o), seq);
}
export function order(id: string): Order | undefined {
  const r = db.query("SELECT json FROM orders WHERE id = ?").get(id) as { json: string } | null;
  return r ? JSON.parse(r.json) : undefined;
}
export function orderByToken(token: string): Order | undefined {
  const r = db.query("SELECT json FROM orders WHERE token = ?").get(token) as { json: string } | null;
  return r ? JSON.parse(r.json) : undefined;
}
export function orders(shopperId?: string): Order[] {
  const rows = (shopperId
    ? db.query("SELECT json FROM orders WHERE shopper = ? ORDER BY seq").all(shopperId)
    : db.query("SELECT json FROM orders ORDER BY seq").all()) as { json: string }[];
  return rows.map((r) => JSON.parse(r.json));
}
