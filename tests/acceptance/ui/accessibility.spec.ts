import { expect, test, type Page } from "@playwright/test";

test.setTimeout(120_000);
const routes = ["/sign-in", "/", "/masters/customers", "/projects", "/projects/new", "/projects/demo/overview", "/projects/demo/contracts", "/projects/demo/shipments", "/sales-shipments/demo", "/supplier-shipments/demo", "/projects/demo/money", "/projects/demo/expenses", "/projects/demo/statements", "/projects/demo/profit", "/projects/demo/claims", "/projects/demo/closure", "/approvals", "/documents/demo", "/evidence/demo", "/projects/demo/audit", "/admin/users", "/admin/backup"] as const;

async function findings(page: Page) {
  const issues = await page.evaluate(() => {
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const result: string[] = [];
    const headings = [...document.querySelectorAll(`main h1, main [role="heading"][aria-level="1"]`)].filter(visible);
    if (headings.length < 1) result.push("missing visible main heading");
    for (const image of document.querySelectorAll("img")) if (!image.hasAttribute("alt")) result.push("image missing alt");
    const ids = [...document.querySelectorAll("[id]")].map((node) => node.id);
    for (const id of ids) if (document.querySelectorAll(`#${CSS.escape(id)}`).length > 1) result.push(`duplicate id ${id}`);
    return result;
  });

  const session = await page.context().newCDPSession(page);
  const tree = await session.send("Accessibility.getFullAXTree");
  await session.detach();
  const interactiveRoles = new Set(["button", "link", "textbox", "searchbox", "combobox", "checkbox", "radio", "switch", "slider", "spinbutton"]);
  for (const node of tree.nodes) {
    const role = String(node.role?.value ?? "");
    if (!node.ignored && interactiveRoles.has(role) && !String(node.name?.value ?? "").trim()) issues.push(`unlabelled ${role}`);
  }
  return issues;
}

for (const locale of ["en", "ar"] as const) {
  test(`${locale} screens expose labelled controls, landmarks, headings and image alternatives`, async ({ page }, testInfo) => {
    const report: Record<string, string[]> = {};
    for (const route of routes) {
      await page.goto(`${route}?locale=${locale}`);
      await expect(page.locator(`main h1:visible, main [role="heading"][aria-level="1"]:visible`).first()).toBeVisible();
      const result = await findings(page);
      if (result.length) report[route] = result;
    }
    await testInfo.attach(`accessibility-${locale}.json`, { body: Buffer.from(JSON.stringify(report, null, 2)), contentType: "application/json" });
    expect(report, "critical structural accessibility findings").toEqual({});
  });
}

test("reduced motion disables non-essential animation", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/?locale=en");
  const moving = await page.locator("body *").evaluateAll((nodes) => nodes.filter((node) => {
    const style = getComputedStyle(node);
    return style.animationName !== "none" && parseFloat(style.animationDuration) > 0;
  }).length);
  expect(moving).toBe(0);
  await context.close();
});
