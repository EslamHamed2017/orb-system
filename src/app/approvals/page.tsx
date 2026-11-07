import { ApprovalDialog } from "../../ui/features/approvals/ApprovalDialog";
type Query = { locale?: string };
export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams, locale = query.locale === "ar" ? "ar" : "en", ar = locale === "ar";
  return <section aria-labelledby="approvals-title" dir={ar ? "rtl" : "ltr"} style={{ display: "grid", gap: 20, minWidth: 0 }}><header><h1 id="approvals-title">{ar ? "صندوق الموافقات الثابت" : "Fixed approval inbox"}</h1><p>{ar ? "راجع الربط الدقيق والاختلاف والدليل والتعارض قبل القرار." : "Review exact binding, diff, evidence and conflicts before deciding."}</p></header><ApprovalDialog locale={locale} /></section>;
}
