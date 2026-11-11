import { ProductMovementHistoryPage } from "../../../../ui/features/masters/ProductMovementHistoryPage";
import type { ProductMovementDirectionFilter } from "../../../../ui/features/masters/product-movement-history";
type Query = { locale?:string; projectId?:string; direction?:string; q?:string };
export default async function ProductMovementsPage({ params, searchParams }: { readonly params:Promise<{productId:string}>; readonly searchParams:Promise<Query> }) {
  const [{ productId }, query] = await Promise.all([params, searchParams]);
  const direction:ProductMovementDirectionFilter = query.direction === "INBOUND" || query.direction === "OUTBOUND" ? query.direction : "ALL";
  return <ProductMovementHistoryPage productId={productId} locale={query.locale === "ar" ? "ar" : "en"} projectId={query.projectId || undefined} direction={direction} query={query.q ?? ""}/>;
}
