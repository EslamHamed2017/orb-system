// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DecimalAmount } from "../../platform/decimal/index.ts";

export const MONEY_MOVEMENT_KINDS = Object.freeze([
  "CUSTOMER_ADVANCE", "CUSTOMER_RECEIPT", "CUSTOMER_REFUND",
  "SUPPLIER_ADVANCE", "SUPPLIER_PAYMENT", "SUPPLIER_REFUND",
] as const);

export function exactSix(value: unknown, allowNegative = false): string {
  if (typeof value !== "string") throw new TypeError("amount must be an exact decimal string");
  const amount = DecimalAmount.parse(value);
  if (amount.scale > 6 || amount.isZero() || (!allowNegative && amount.isNegative())) throw new TypeError("amount must be positive with at most six decimal places");
  const [whole, fraction = ""] = amount.toString().split(".");
  return `${whole}.${fraction.padEnd(6, "0")}`;
}

export function addSix(left: string, right: string): string {
  const value = DecimalAmount.parse(left).add(DecimalAmount.parse(right));
  const [whole, fraction = ""] = value.toString().split(".");
  return `${whole}.${fraction.padEnd(6, "0")}`;
}

export function subtractSix(left: string, right: string): string {
  const value = DecimalAmount.parse(left).subtract(DecimalAmount.parse(right));
  const [whole, fraction = ""] = value.toString().split(".");
  return `${whole}.${fraction.padEnd(6, "0")}`;
}

export function compareSix(left: string, right: string): -1 | 0 | 1 {
  return DecimalAmount.parse(left).compare(DecimalAmount.parse(right));
}
