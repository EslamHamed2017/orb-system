import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  filterUsers,
  summarizeUsers,
  type UserDirectoryRecord,
} from "../../../src/ui/features/admin/user-directory.ts";

const users: readonly UserDirectoryRecord[] = [
  { id: "user-1", authSubject: "eslam@orb.test", nameEn: "Owner User", nameAr: "مستخدم المالك", locale: "en", status: "ACTIVE", roleCodes: ["OWNER_ADMIN"], activeSessionCount: 2, lastActiveAt: "2026-11-12T07:30:00Z" },
  { id: "user-2", authSubject: "ops@orb.test", nameEn: "Operations User", nameAr: "مستخدم العمليات", locale: "ar", status: "SUSPENDED", roleCodes: ["OPERATIONS"], activeSessionCount: 0, lastActiveAt: "2026-11-11T15:00:00Z" },
  { id: "user-3", authSubject: "finance@orb.test", nameEn: "Finance Reviewer", nameAr: "مراجع المالية", locale: "en", status: "ACTIVE", roleCodes: ["FINANCE_VIEWER", "REPORT_REVIEWER"], activeSessionCount: 1, lastActiveAt: null },
];

test("user directory summarizes lifecycle, locale, role assignment and live access", () => {
  assert.deepEqual(summarizeUsers(users), { total: 3, active: 2, suspended: 1, arabic: 1, assignedRoles: 4, activeSessions: 3 });
});

test("user directory filters bilingual identity, status, locale and assigned role", () => {
  assert.deepEqual(filterUsers(users, { query: "العمليات", status: "ALL", locale: "ALL", role: "ALL" }).map((user) => user.id), ["user-2"]);
  assert.deepEqual(filterUsers(users, { query: "", status: "ACTIVE", locale: "en", role: "REPORT_REVIEWER" }).map((user) => user.id), ["user-3"]);
  assert.deepEqual(filterUsers(users, { query: "eslam@", status: "ACTIVE", locale: "ALL", role: "OWNER_ADMIN" }).map((user) => user.id), ["user-1"]);
});

test("full users management screen is bilingual and exposes granular lifecycle actions", () => {
  const route = readFileSync("src/app/admin/users/page.tsx", "utf8");
  const screen = readFileSync("src/ui/features/admin/UsersManagementPage.tsx", "utf8");
  const sessions = readFileSync("src/ui/features/admin/SessionList.tsx", "utf8");
  assert.match(route, /UsersManagementPage/);
  assert.match(screen, /Users and access/);
  assert.match(screen, /المستخدمون والوصول/);
  assert.match(screen, /data-operation-id="createUser"/);
  assert.match(screen, /data-operation-id="updateUser"/);
  assert.match(screen, /data-operation-id="assignFixedPilotRoles"/);
  assert.match(screen, /SessionList/);
  assert.match(sessions, /Exact user sessions/);
  assert.doesNotMatch(screen, /fixed pilot|Pilot users/i);
});
