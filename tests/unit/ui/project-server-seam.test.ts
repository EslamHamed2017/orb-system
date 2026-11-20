import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sources = () => [
  "src/ui/features/projects/ProjectsRegister.tsx",
  "src/ui/features/projects/NewProjectForm.tsx",
  "src/ui/features/projects/ProjectWorkspacePage.tsx",
].map((path) => readFileSync(path, "utf8")).join("\n");

test("project register, create and overview routes use server APIs with no browser storage or fixed demo branch", () => {
  const source = sources();
  assert.match(source, /fetch\(PROJECTS_ENDPOINT/);
  assert.match(source, /fetch\(CUSTOMERS_ENDPOINT/);
  assert.match(source, /fetch\(PRODUCTS_ENDPOINT/);
  assert.match(source, /x-orb-project-write-permitted/);
  assert.doesNotMatch(source, /localStorage|browser-project-storage|PROJECT_STORAGE_KEY|id\s*!==\s*["']demo["']|const data:\s*Record|SALES_CONTRACT_LINES/);
});

test("project UI exposes truthful bilingual loading, auth, forbidden, error and empty states", () => {
  const source = sources();
  for (const copy of [
    "Loading projects", "جارٍ تحميل المشاريع", "Sign in to load and save projects", "سجّل الدخول لتحميل المشاريع وحفظها",
    "You do not have permission to view projects", "ليس لديك إذن لعرض المشاريع", "Project service is unavailable", "خدمة المشاريع غير متاحة",
    "No projects registered yet", "لم تُسجل مشاريع بعد",
  ]) assert.ok(source.includes(copy), copy);
});

test("project cards and persisted overview show business references, not raw UUIDs or technical enums", () => {
  const source = sources();
  assert.match(source, /project\.reference/);
  assert.match(source, /salesContract\.reference/);
  assert.doesNotMatch(source, /<bdi>\{id\}<\/bdi>|lifecycleState\}\s*<\/|FOREIGN_TO_FOREIGN\}\s*<\//);
});

test("database project UUIDs use the persisted overview and browser-only projects are retired",()=>{const route=readFileSync("src/app/projects/[id]/overview/page.tsx","utf8");assert.match(route,/ProjectWorkspacePage/);assert.match(route,/RetiredBrowserProject/);assert.doesNotMatch(route,/SavedProjectDetail/);assert.match(route,/7\[0-9a-f\]\{3\}/)});
