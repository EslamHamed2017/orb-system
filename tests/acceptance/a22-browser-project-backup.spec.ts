import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function createProject(page: Page): Promise<void> {
  await page.goto("/projects/new?locale=en");
  const data = { customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" };
  for (const [name, value] of Object.entries(data)) await page.locator(`[name="${name}"]`).fill(value);
  await page.getByRole("button", { name: "Save and open project" }).click();
  await page.waitForURL(/\/projects\/[^/]+\/overview/);
}

test("owner exports, previews, confirms, and restores exact saved projects", async ({ page }) => {
  await createProject(page);
  await page.goto("/admin/backup?locale=en");
  await expect(page.getByRole("heading", { level: 1, name: "Project backup" })).toBeVisible();
  await expect(page.getByText("1 project saved in this browser", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const saved = await (await download).path();
  expect(saved).not.toBeNull();
  const raw = await readFile(saved!, "utf8");
  const envelope = JSON.parse(raw);
  expect(envelope.format).toBe("orb-browser-project-backup");
  expect(envelope.version).toBe(1);
  expect(envelope.projects).toHaveLength(1);
  expect(envelope.projects[0].customer).toBe("Atlas Foods");

  await page.evaluate(() => localStorage.removeItem("orb.user-projects.owner-1.v1"));
  await page.reload();
  await page.getByLabel("Choose backup file").setInputFiles({ name: "orb-backup.json", mimeType: "application/json", buffer: Buffer.from(raw) });
  await expect(page.getByRole("heading", { name: "Ready to review" })).toBeVisible();
  await expect(page.getByText("Atlas Foods", { exact: false })).toBeVisible();
  await expect(page.getByText("0 existing projects will be deleted and replaced by 1 project from this file.", { exact: true })).toBeVisible();
  const replace = page.getByRole("button", { name: "Replace all projects with 1 project" });
  await expect(replace).toBeDisabled();
  await page.getByLabel("I understand that this replaces every project currently saved in this browser").check();
  await expect(replace).toBeEnabled();
  await replace.click();
  await expect(page.getByRole("status")).toContainText("1 project restored in this browser");
  await page.getByRole("link", { name: "Open projects" }).click();
  await expect(page.getByRole("heading", { name: "Atlas Foods" })).toBeVisible();
});

test("invalid backup preserves existing projects and never enables restore", async ({ page }) => {
  await createProject(page);
  await page.goto("/admin/backup?locale=en");
  await page.getByLabel("Choose backup file").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"format":"wrong"}') });
  await expect(page.getByText(/This file is not a valid ORB project backup/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Replace all projects/ })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("orb.user-projects.owner-1.v1") ?? "[]").length)).toBe(1);
});


test("restore refuses to overwrite projects changed after preview", async ({ page }) => {
  await createProject(page);
  await page.goto("/admin/backup?locale=en");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const saved = await (await download).path();
  const raw = await readFile(saved!, "utf8");
  await page.getByLabel("Choose backup file").setInputFiles({ name: "orb-backup.json", mimeType: "application/json", buffer: Buffer.from(raw) });
  await page.evaluate(() => {
    const key = "orb.user-projects.owner-1.v1";
    const projects = JSON.parse(localStorage.getItem(key) ?? "[]");
    projects[0].customer = "Newer browser data";
    localStorage.setItem(key, JSON.stringify(projects));
  });
  await page.getByLabel("I understand that this replaces every project currently saved in this browser").check();
  await page.getByRole("button", { name: "Replace all projects with 1 project" }).click();
  await expect(page.getByText("Projects changed after this preview. Nothing was replaced; choose the backup again to review it against the latest data.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("orb.user-projects.owner-1.v1") ?? "[]")[0].customer)).toBe("Newer browser data");
});

test("Arabic project backup is RTL, business-readable, and clear of mobile navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/backup?locale=ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: "نسخة احتياطية للمشاريع" })).toBeVisible();
  await expect(page.locator("body")).toContainText("البيانات محفوظة في هذا المتصفح فقط");
  await expect(page.locator("body")).not.toContainText(/RPO|RTO|AES-256|PASSED|EVIDENCE-RESTORE|startIsolatedRestoreTest/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const geometry = await page.evaluate(() => {
    const main = document.querySelector(".orb-main")!.getBoundingClientRect();
    const nav = document.querySelector('[data-navigation="bottom"]')!.getBoundingClientRect();
    return { mainBottom: Math.round(main.bottom), navTop: Math.round(nav.top) };
  });
  expect(geometry.mainBottom).toBeLessThanOrEqual(geometry.navTop);
});
