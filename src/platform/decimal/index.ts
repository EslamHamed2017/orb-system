const DECIMAL = /^([+-]?)(0|[1-9]\d*)(?:\.(\d+))?$/;

function powerOfTen(exponent: number): bigint {
  if (!Number.isSafeInteger(exponent) || exponent < 0) throw new RangeError("Decimal scale must be a non-negative safe integer");
  return 10n ** BigInt(exponent);
}

function normalized(coefficient: bigint, scale: number): [bigint, number] {
  if (coefficient === 0n) return [0n, 0];
  let next = coefficient;
  let nextScale = scale;
  while (nextScale > 0 && next % 10n === 0n) {
    next /= 10n;
    nextScale--;
  }
  return [next, nextScale];
}

export class DecimalAmount {
  readonly coefficient: bigint;
  readonly scale: number;

  private constructor(coefficient: bigint, scale: number) {
    [this.coefficient, this.scale] = normalized(coefficient, scale);
    Object.freeze(this);
  }

  static parse(value: string | bigint | number): DecimalAmount {
    if (typeof value === "bigint") return new DecimalAmount(value, 0);
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value)) throw new TypeError("Numbers must be safe integers; pass non-integer decimals as strings");
      return new DecimalAmount(BigInt(value), 0);
    }
    const match = DECIMAL.exec(value);
    if (!match) throw new TypeError(`Invalid exact decimal: ${value}`);
    const fraction = match[3] ?? "";
    const coefficient = BigInt(`${match[1]}${match[2]}${fraction}`);
    return new DecimalAmount(coefficient, fraction.length);
  }

  private align(other: DecimalAmount): [bigint, bigint, number] {
    const scale = Math.max(this.scale, other.scale);
    return [this.coefficient * powerOfTen(scale - this.scale), other.coefficient * powerOfTen(scale - other.scale), scale];
  }

  add(other: DecimalAmount): DecimalAmount {
    const [left, right, scale] = this.align(other);
    return new DecimalAmount(left + right, scale);
  }

  subtract(other: DecimalAmount): DecimalAmount {
    const [left, right, scale] = this.align(other);
    return new DecimalAmount(left - right, scale);
  }

  multiply(other: DecimalAmount): DecimalAmount {
    return new DecimalAmount(this.coefficient * other.coefficient, this.scale + other.scale);
  }

  compare(other: DecimalAmount): -1 | 0 | 1 {
    const [left, right] = this.align(other);
    return left < right ? -1 : left > right ? 1 : 0;
  }

  isNegative(): boolean { return this.coefficient < 0n; }
  isZero(): boolean { return this.coefficient === 0n; }

  toString(): string {
    const negative = this.coefficient < 0n;
    const digits = (negative ? -this.coefficient : this.coefficient).toString().padStart(this.scale + 1, "0");
    const value = this.scale === 0 ? digits : `${digits.slice(0, -this.scale)}.${digits.slice(-this.scale)}`;
    return negative ? `-${value}` : value;
  }

  toJSON(): string { return this.toString(); }
}

function normalizeCurrency(currency: string): string {
  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new TypeError(`Invalid ISO currency code: ${currency}`);
  return code;
}

export class CurrencyAmount {
  readonly currency: string;
  readonly amount: DecimalAmount;

  constructor(currency: string, amount: DecimalAmount) {
    this.currency = normalizeCurrency(currency);
    this.amount = amount;
    Object.freeze(this);
  }

  static parse(currency: string, amount: string | bigint | number): CurrencyAmount {
    return new CurrencyAmount(currency, DecimalAmount.parse(amount));
  }

  add(other: CurrencyAmount): CurrencyAmount {
    this.assertSameCurrency(other);
    return new CurrencyAmount(this.currency, this.amount.add(other.amount));
  }

  subtract(other: CurrencyAmount): CurrencyAmount {
    this.assertSameCurrency(other);
    return new CurrencyAmount(this.currency, this.amount.subtract(other.amount));
  }

  private assertSameCurrency(other: CurrencyAmount): void {
    if (this.currency !== other.currency) throw new TypeError(`Cannot combine unlike currencies: ${this.currency} and ${other.currency}`);
  }
}
