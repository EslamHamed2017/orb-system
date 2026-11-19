import { UsersManagementPage } from "../../../ui/features/admin/UsersManagementPage";
import type { UserLocaleFilter, UserStatusFilter } from "../../../ui/features/admin/user-directory";

type Query = { locale?: string; q?: string; status?: string; userLocale?: string; assignedRole?: string };
const status = (value?: string): UserStatusFilter => value === "ACTIVE" || value === "SUSPENDED" ? value : "ALL";
const userLocale = (value?: string): UserLocaleFilter => value === "en" || value === "ar" ? value : "ALL";

/** Who may manage users is decided by the API from the session, not by URL parameters. */
export default async function UsersPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const locale = query.locale === "ar" ? "ar" : "en";
  return <UsersManagementPage locale={locale} query={query.q ?? ""} status={status(query.status)} userLocale={userLocale(query.userLocale)} role={query.assignedRole ?? "ALL"}/>;
}
