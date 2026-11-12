import { RolesPermissionsPage } from "../../../ui/features/admin/RolesPermissionsPage";
import type { PermissionCategoryFilter } from "../../../ui/features/admin/role-permission-matrix";

type Query = { locale?: string; q?: string; category?: string; role?: string };
const category = (value?: string): PermissionCategoryFilter => value === "SCREEN" || value === "OPERATION" || value === "SENSITIVE_VALUE" || value === "APPROVAL" || value === "ADMINISTRATION" ? value : "ALL";

export default async function RolesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <RolesPermissionsPage locale={query.locale === "ar" ? "ar" : "en"} query={query.q ?? ""} category={category(query.category)} canManage={!query.role || query.role === "owner-admin"}/>;
}
