import type { UserDirectoryRecord } from "./user-directory";

export const USER_DIRECTORY: readonly UserDirectoryRecord[] = Object.freeze([
  { id: "user-owner", authSubject: "owner@orb.test", nameEn: "ORB Owner", nameAr: "مالك ORB", locale: "en", status: "ACTIVE", roleCodes: ["OWNER_ADMIN"], activeSessionCount: 1, lastActiveAt: "2026-11-12T07:30:00Z" },
  { id: "user-operations", authSubject: "operations@orb.test", nameEn: "Operations Coordinator", nameAr: "منسق العمليات", locale: "ar", status: "ACTIVE", roleCodes: ["OPERATIONS"], activeSessionCount: 1, lastActiveAt: "2026-11-12T06:45:00Z" },
  { id: "user-finance", authSubject: "finance@orb.test", nameEn: "Finance Reviewer", nameAr: "مراجع المالية", locale: "en", status: "SUSPENDED", roleCodes: ["FINANCE_VIEWER"], activeSessionCount: 0, lastActiveAt: "2026-11-10T15:20:00Z" },
]);

export const ASSIGNABLE_ROLE_CODES = Object.freeze(["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"] as const);
