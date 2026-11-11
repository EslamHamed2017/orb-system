// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DecimalAmount } from "../../../platform/decimal/index.ts";

export type PartialFulfillmentInput = Readonly<{
  contractLineVersionId: string; contractLineReference: string; productName: string;
  contractedQuantity: string; availableBeforeShipment: string; currentShipmentQuantity: string; unit: string;
}>;
export type PartialFulfillmentRow = Readonly<{
  contractLineVersionId: string; contractLineReference: string; productName: string; contractedQuantity: string;
  fulfilledBeforeShipment: string; currentShipmentQuantity: string; fulfilledQuantity: string; remainingQuantity: string;
  completionPercent: number; unit: string;
}>;

const ZERO = DecimalAmount.parse(0);
function percent(numerator: DecimalAmount, denominator: DecimalAmount): number {
  const scale = Math.max(numerator.scale, denominator.scale);
  const left = numerator.coefficient * 10n ** BigInt(scale - numerator.scale);
  const right = denominator.coefficient * 10n ** BigInt(scale - denominator.scale);
  return Number((left * 100n) / right);
}

export function buildPartialFulfillmentRows(inputs: readonly PartialFulfillmentInput[]): PartialFulfillmentRow[] {
  return inputs.map((input) => {
    const contracted = DecimalAmount.parse(input.contractedQuantity);
    const available = DecimalAmount.parse(input.availableBeforeShipment);
    const current = DecimalAmount.parse(input.currentShipmentQuantity);
    if (contracted.compare(ZERO) !== 1 || available.compare(ZERO) === -1 || current.compare(ZERO) === -1) throw new RangeError("QUANTITY_INVALID");
    if (available.compare(contracted) === 1) throw new RangeError("AVAILABLE_EXCEEDS_CONTRACTED");
    if (current.compare(available) === 1) throw new RangeError("CURRENT_EXCEEDS_AVAILABLE");
    const fulfilledBefore = contracted.subtract(available);
    const fulfilled = fulfilledBefore.add(current);
    const remaining = contracted.subtract(fulfilled);
    return {
      contractLineVersionId: input.contractLineVersionId, contractLineReference: input.contractLineReference, productName: input.productName,
      contractedQuantity: contracted.toString(), fulfilledBeforeShipment: fulfilledBefore.toString(), currentShipmentQuantity: current.toString(),
      fulfilledQuantity: fulfilled.toString(), remainingQuantity: remaining.toString(), completionPercent: percent(fulfilled, contracted), unit: input.unit,
    };
  });
}
