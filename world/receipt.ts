// A receipt is an order the shop signed, so a check can tell a real order from a typed one.
import { createHmac } from "node:crypto";
import type { Order } from "./store";

const KEY = "pantry-run-receipts";
export type Receipt = { shop: "Pantry Run"; order: Omit<Order, "token">; signature: string };

function sign(content: unknown): string {
  const hmac = createHmac("sha256", KEY);
  hmac.update(JSON.stringify(content));
  return hmac.digest("hex");
}

export function makeReceipt(placedOrder: Order): Receipt {
  // The token is a secret for the shopper's browser, so it stays out of the receipt.
  const { token, ...order } = placedOrder;
  return { shop: "Pantry Run", order, signature: sign(order) };
}

export function verifyReceipt(candidate: unknown): candidate is Receipt {
  const receipt = candidate as Receipt;
  return Boolean(
    receipt &&
      receipt.shop === "Pantry Run" &&
      receipt.order &&
      typeof receipt.signature === "string" &&
      sign(receipt.order) === receipt.signature,
  );
}
