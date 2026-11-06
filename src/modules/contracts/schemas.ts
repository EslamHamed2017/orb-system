// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";

export interface ContractInput extends Readonly<Record<string, unknown>> {
  readonly counterpartyId: string;
  readonly coffeeSpecificationId: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly currency: string;
  readonly route: string;
  readonly incoterm: string;
  readonly namedPlace: string;
}

export interface ContractTolerances {
  readonly quantityUnder: string;
  readonly quantityOver: string;
  readonly netWeightUnder: string;
  readonly netWeightOver: string;
  readonly grossWeightUnder: string;
  readonly grossWeightOver: string;
}

export const ZERO_CONTRACT_TOLERANCES: ContractTolerances = Object.freeze({
  quantityUnder: "0", quantityOver: "0", netWeightUnder: "0",
  netWeightOver: "0", grossWeightUnder: "0", grossWeightOver: "0",
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL = /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/;
const CURRENCY = /^[A-Z]{3}$/;
const TOLERANCE_KEYS = Object.keys(ZERO_CONTRACT_TOLERANCES) as (keyof ContractTolerances)[];

function invalid(correlationId: string): never {
  throw problemError({ code: "VALIDATION_FAILED", status: 400, correlationId });
}

export function validateContractInput(value: unknown, correlationId: string): ContractInput & { readonly tolerances: ContractTolerances } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid(correlationId);
  const input = value as Record<string, unknown>;
  const strings = ["counterpartyId", "coffeeSpecificationId", "quantity", "unitPrice", "currency", "route", "incoterm", "namedPlace"];
  if (strings.some((key) => typeof input[key] !== "string" || String(input[key]).trim() === "")) invalid(correlationId);
  if (!UUID.test(String(input.counterpartyId)) || !UUID.test(String(input.coffeeSpecificationId))
      || !DECIMAL.test(String(input.quantity)) || Number(input.quantity) <= 0
      || !DECIMAL.test(String(input.unitPrice)) || Number(input.unitPrice) < 0
      || !CURRENCY.test(String(input.currency))) invalid(correlationId);
  const supplied = input.tolerances ?? {};
  if (typeof supplied !== "object" || supplied === null || Array.isArray(supplied)) invalid(correlationId);
  const tolerances = { ...ZERO_CONTRACT_TOLERANCES } as Record<keyof ContractTolerances, string>;
  for (const key of TOLERANCE_KEYS) {
    const candidate = (supplied as Record<string, unknown>)[key];
    if (candidate !== undefined) {
      if (typeof candidate !== "string" || !DECIMAL.test(candidate)) invalid(correlationId);
      tolerances[key] = candidate;
    }
  }
  return Object.freeze({ ...input, tolerances: Object.freeze(tolerances) }) as ContractInput & { readonly tolerances: ContractTolerances };
}

export function validateAmendment(reason: unknown, effectiveDate: unknown, correlationId: string): void {
  if (typeof reason !== "string" || reason.trim().length < 3
      || typeof effectiveDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)
      || !Number.isFinite(Date.parse(`${effectiveDate}T00:00:00.000Z`))) invalid(correlationId);
}
