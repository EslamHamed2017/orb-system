import { EnterpriseStyles, ErpPageHeader } from "../../../ui/features/admin/EnterpriseUx";

type Query = { locale?: string };

/** Browser-file backups were for browser-only test projects. Real records are in the database and backed up on the server. */
export default async function BackupPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const ar = query.locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  return <section className="orb-erp" dir={ar ? "rtl" : "ltr"} aria-labelledby="backup-title">
    <EnterpriseStyles/>
    <ErpPageHeader titleId="backup-title" eyebrow={t("Administration", "الإدارة")} title={t("Backups", "النسخ الاحتياطية")}
      description={t("Projects, shipments, invoices, money and documents are stored in the shared database and document storage, and are backed up on the server. There is nothing to export from this browser.",
        "المشاريع والشحنات والفواتير والأموال والمستندات محفوظة في قاعدة البيانات ومخزن المستندات المشتركين، ويُعمل لها نسخ احتياطي على السيرفر. لا يوجد ما يُصدَّر من هذا المتصفح.")}/>
    <p><a href={`/admin/users?locale=${ar ? "ar" : "en"}`}>{t("Users and access", "المستخدمون والصلاحيات")}</a></p>
  </section>;
}
