import { BrowserProjectBackupPage } from "../../../ui/features/admin/BrowserProjectBackup";
type Query = { locale?: string };
export default async function BackupPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <BrowserProjectBackupPage locale={query.locale === "ar" ? "ar" : "en"} />;
}
