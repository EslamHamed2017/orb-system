import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const TOKENS = resolve(ROOT, "src/ui/theme/tokens.css");
const THEME = resolve(ROOT, "src/ui/theme/orb-theme.ts");
const LOGO = resolve(ROOT, "public/orb-logo.svg");
const required = [TOKENS, THEME, LOGO];
const missing = required.filter((path) => !existsSync(path));
const redReason = `ORB-R1-0214 shell artifacts are missing: ${missing.map((path) => path.slice(ROOT.length + 1)).join(", ")}`;

function source(path: string): string {
  assert.ok(existsSync(path), redReason);
  return readFileSync(path, "utf8");
}

function declarations(css: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of css.matchAll(/(--orb-[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    assert.ok(!result.has(match[1]), `duplicate token ${match[1]}`);
    result.set(match[1], match[2].trim());
  }
  return result;
}

test("ORB MD3 defines semantic color, type, spacing, shape, elevation, state, focus, and motion tokens", () => {
  const css = source(TOKENS);
  const tokens = declarations(css);
  const requiredTokens = [
    "--orb-color-primary", "--orb-color-on-primary", "--orb-color-secondary", "--orb-color-tertiary",
    "--orb-color-error", "--orb-color-surface", "--orb-color-on-surface", "--orb-color-surface-container",
    "--orb-type-display", "--orb-type-headline", "--orb-type-title", "--orb-type-body", "--orb-type-label",
    "--orb-line-height-arabic", "--orb-space-1", "--orb-space-2", "--orb-space-3", "--orb-space-4",
    "--orb-shape-small", "--orb-shape-medium", "--orb-shape-large", "--orb-elevation-1", "--orb-elevation-2",
    "--orb-state-hover", "--orb-state-focus", "--orb-state-pressed", "--orb-state-dragged",
    "--orb-focus-ring-width", "--orb-touch-target", "--orb-motion-duration-short", "--orb-motion-duration-medium",
  ];
  for (const name of requiredTokens) assert.ok(tokens.has(name), `missing semantic token ${name}`);
  assert.equal(tokens.get("--orb-touch-target"), "48px", "touch targets must be at least the accepted 48 CSS px baseline");
  assert.match(tokens.get("--orb-space-1") ?? "", /^4px$/, "spacing must establish the 4dp grid");
  assert.doesNotMatch(css, /google\s*(?:sans|logo|material)/i, "Google branding is outside ORB identity");
});

test("the application theme consumes ORB semantic tokens instead of inventing screen colors", () => {
  const theme = source(THEME);
  assert.match(theme, /createTheme\s*\(/, "MUI must be accessible plumbing behind the ORB theme");
  for (const role of ["primary", "secondary", "tertiary", "error", "background", "text"])
    assert.match(theme, new RegExp(`\\b${role}\\s*:`), `missing MD3 theme role ${role}`);
  assert.match(theme, /48/, "theme must preserve the 48px minimum interactive target");
  assert.match(theme, /focus-visible|focusVisible/i, "theme must expose a keyboard focus treatment");
  assert.doesNotMatch(theme, /google/i, "theme must not carry Google branding");
});

test("the retained ORB logo is local, labelled, and free of remote or Google dependencies", () => {
  const logo = source(LOGO);
  assert.match(logo, /<svg\b/i);
  assert.match(logo, /(?:<title>|aria-label=)[^<]*(?:ORB|Orb)/i, "logo needs an ORB accessible label");
  assert.doesNotMatch(logo, /https?:\/\/|google/i, "logo must be a local ORB asset");
});
