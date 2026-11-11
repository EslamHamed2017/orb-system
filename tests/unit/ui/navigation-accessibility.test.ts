import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const navigation = readFileSync(resolve(ROOT, "src/ui/navigation/AppNavigation.tsx"), "utf8");
const tokens = readFileSync(resolve(ROOT, "src/ui/theme/tokens.css"), "utf8");
const auditPage = readFileSync(resolve(ROOT, "src/app/projects/[id]/audit/page.tsx"), "utf8");

test("the public sign-in route renders without authenticated application navigation", () => {
  assert.match(navigation, /pathname === ["']\/sign-in["']/);
  assert.match(navigation, /if \(isUnauthenticatedShell\) \{\s*return <>\{children\}<\/>;\s*\}/);
});

test("main content precedes shell navigation in DOM order for finite keyboard entry", () => {
  const shellStart = navigation.indexOf('return <div className="orb-shell">');
  const main = navigation.indexOf('<main className="orb-main">', shellStart);
  const header = navigation.indexOf('<header className="orb-top-bar">', shellStart);
  const sideNavigation = navigation.indexOf('<nav className="orb-rail"', header);
  const bottomNavigation = navigation.indexOf('<nav className="orb-bottom"', sideNavigation);
  assert.ok(shellStart >= 0 && main > shellStart, "authenticated shell and main content must exist");
  assert.ok(
    main < header && header < sideNavigation && sideNavigation < bottomNavigation,
    "authenticated shell DOM order must be main, header, side navigation, then bottom navigation",
  );
});

test("global search preserves a visible keyboard focus indicator", () => {
  assert.match(tokens, /\.orb-global-search input:focus-visible\s*\{[^}]*outline:(?!\s*(?:0|none))[^{;}]+;/s);
  assert.match(tokens, /outline-offset:\s*2px/);
});

test("project audit exposes a bilingual return link to its project overview", () => {
  assert.match(auditPage, /href=\{`\/projects\/\$\{id\}\/overview\?locale=\$\{locale\}`\}/);
  assert.match(auditPage, /عودة إلى النظرة العامة/);
  assert.match(auditPage, /Back to overview/);
});
