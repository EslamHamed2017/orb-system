import { ApprovalDialog } from "../../ui/features/approvals/ApprovalDialog";
import { EnterpriseStyles, ErpPageHeader } from "../../ui/features/admin/EnterpriseUx";

type Query = { locale?: string; role?: string };

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const locale = query.locale === "ar" ? "ar" : "en";
  const ar = locale === "ar";
  return <section aria-labelledby="approvals-title" dir={ar ? "rtl" : "ltr"} className="orb-erp">
    <EnterpriseStyles />
    <ErpPageHeader
      titleId="approvals-title"
      eyebrow={ar ? "مساحة القرار" : "Decision workspace"}
      title={ar ? "طلبات الموافقة" : "Approval requests"}
      description={ar
        ? "راجع أثر الطلب والمستلمين والتغييرات قبل اتخاذ القرار."
        : "Review the request impact, recipients and changes before deciding."}
      meta={<span className="orb-chip" data-tone="warning">{ar ? "معاينة فقط" : "Preview only"}</span>}
    />
    <ApprovalDialog locale={locale} />
  </section>;
}
