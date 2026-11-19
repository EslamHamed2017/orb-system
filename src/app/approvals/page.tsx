import { ApprovalInbox } from "../../ui/features/approvals/ApprovalInbox";
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
        ? "العقود وتأكيدات الشحنات التي تنتظر قرارك. لا يمكن لمن طلب الاعتماد أن يعتمده بنفسه."
        : "Contracts and shipment confirmations waiting for your decision. Whoever requested an approval cannot approve it."}
    />
    <ApprovalInbox locale={locale} />
  </section>;
}
