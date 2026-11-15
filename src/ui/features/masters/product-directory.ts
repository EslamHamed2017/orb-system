import type { ProductDirectoryRecord, ProductStatus } from "../../../modules/masters/browser-product-storage";

export type { ProductDirectoryRecord, ProductStatus };
export type ProductStatusFilter = ProductStatus | "ALL";

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
