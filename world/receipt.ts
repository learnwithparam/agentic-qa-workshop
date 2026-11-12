// A receipt is an order the shop signed, so a check can tell a real order from a typed one.
import { createHmac } from "node:crypto";
import type { Order } from "./store";

const KEY = "pantry-run-receipts";
export type Receipt = { shop: "Pantry Run"; order: Omit<Order, "token">; signature: string };

const sign = (o: unknown) => createHmac("sha256", KEY).update(JSON.stringify(o)).digest("hex");

export function makeReceipt(o: Order): Receipt {
  const { token, ...order } = o;
  return { shop: "Pantry Run", order, signature: sign(order) };
}

export function verifyReceipt(r: unknown): r is Receipt {
  const x = r as Receipt;
  return Boolean(x && x.shop === "Pantry Run" && x.order && typeof x.signature === "string" && sign(x.order) === x.signature);
}
