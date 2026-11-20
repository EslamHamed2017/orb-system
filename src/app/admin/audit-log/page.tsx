import { AuditLogPage } from "../../../ui/features/admin/AuditLogPage";

type Query = { readonly locale?: string };
export default async function AuditLogRoute({ searchParams }: { readonly searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <AuditLogPage locale={query.locale === "ar" ? "ar" : "en"} />;
}
