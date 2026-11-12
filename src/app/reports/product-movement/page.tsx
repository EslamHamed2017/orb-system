import { ProductMovementReportPage } from "../../../ui/features/reports/ProductMovementReportPage";
import type { ProductMovementReportDirectionFilter } from "../../../ui/features/reports/product-movement-report";
type Query = { readonly locale?:string; readonly role?:string; readonly projectId?:string; readonly productId?:string; readonly direction?:string; readonly from?:string; readonly to?:string; readonly q?:string };
export default async function ProductMovementReportRoute({ searchParams }: { readonly searchParams:Promise<Query> }) {
  const query = await searchParams;
  const direction:ProductMovementReportDirectionFilter = query.direction === "INBOUND" || query.direction === "OUTBOUND" ? query.direction : "ALL";
  return <ProductMovementReportPage locale={query.locale === "ar" ? "ar" : "en"} role={query.role} projectId={query.projectId} productId={query.productId} direction={direction} from={query.from} to={query.to} query={query.q ?? ""}/>;
}
