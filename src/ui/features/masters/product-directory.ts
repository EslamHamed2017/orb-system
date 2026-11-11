export type ProductStatus = "ACTIVE" | "INACTIVE";
export type ProductStatusFilter = ProductStatus | "ALL";

export interface ProductDirectoryRecord {
  readonly id: string;
  readonly reference: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly origin: string;
  readonly type: string;
  readonly grade: string;
  readonly cropYear: string;
  readonly bagType: string;
  readonly standardBagWeight: string;
  readonly status: ProductStatus;
}

export function summarizeProducts(products: readonly ProductDirectoryRecord[]) {
  return Object.freeze({
    total: products.length,
    active: products.filter((product) => product.status === "ACTIVE").length,
    inactive: products.filter((product) => product.status === "INACTIVE").length,
  });
}

export function filterProducts(
  products: readonly ProductDirectoryRecord[],
  query: string,
  status: ProductStatusFilter,
): readonly ProductDirectoryRecord[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return products.filter((product) => {
    if (status !== "ALL" && product.status !== status) return false;
    if (!normalizedQuery) return true;
    return [product.reference, product.nameEn, product.nameAr, product.origin, product.type, product.grade, product.cropYear]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}
