export type UserStatusFilter = "ACTIVE" | "SUSPENDED" | "ALL";
export type UserLocaleFilter = "en" | "ar" | "ALL";

export interface UserDirectoryRecord {
  readonly id: string;
  readonly authSubject: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly locale: "en" | "ar";
  readonly status: "ACTIVE" | "SUSPENDED";
  readonly roleCodes: readonly string[];
  readonly activeSessionCount: number;
  readonly lastActiveAt: string | null;
}

export interface UserDirectoryFilters {
  readonly query: string;
  readonly status: UserStatusFilter;
  readonly locale: UserLocaleFilter;
  readonly role: string | "ALL";
}

export function summarizeUsers(users: readonly UserDirectoryRecord[]) {
  return Object.freeze({
    total: users.length,
    active: users.filter((user) => user.status === "ACTIVE").length,
    suspended: users.filter((user) => user.status === "SUSPENDED").length,
    arabic: users.filter((user) => user.locale === "ar").length,
    assignedRoles: users.reduce((total, user) => total + user.roleCodes.length, 0),
    activeSessions: users.reduce((total, user) => total + user.activeSessionCount, 0),
  });
}

export function filterUsers(users: readonly UserDirectoryRecord[], filters: UserDirectoryFilters) {
  const query = filters.query.trim().toLocaleLowerCase();
  return users.filter((user) => {
    if (filters.status !== "ALL" && user.status !== filters.status) return false;
    if (filters.locale !== "ALL" && user.locale !== filters.locale) return false;
    if (filters.role !== "ALL" && !user.roleCodes.includes(filters.role)) return false;
    if (!query) return true;
    return [user.authSubject, user.nameEn, user.nameAr, ...user.roleCodes].some((value) => value.toLocaleLowerCase().includes(query));
  });
}
