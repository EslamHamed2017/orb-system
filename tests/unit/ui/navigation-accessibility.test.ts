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
  const shellMatch = /return <div className="orb-shell"(?:\s[^>]*)?>/.exec(navigation);
  const shellStart = shellMatch?.index ?? -1;
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

test("project audit links back to its project overview instead of showing a sample timeline", () => {
  assert.match(auditPage, /NotOnDatabaseYet/);
  assert.match(readFileSync("src/ui/features/projects/NotOnDatabaseYet.tsx", "utf8"), /\/projects\/\$\{projectId\}\/overview\?locale=\$\{locale\}/);
});
