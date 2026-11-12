import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const page = readFileSync(resolve(ROOT, "src/app/sign-in/page.tsx"), "utf8");
const form = readFileSync(resolve(ROOT, "src/ui/features/auth/SignInForm.tsx"), "utf8");
const styles = readFileSync(resolve(ROOT, "src/ui/features/admin/EnterpriseUx.tsx"), "utf8");

test("English sign-in communicates operational trust without changing the secure authentication flow", () => {
  assert.match(page, /Complete transaction traceability/);
  assert.match(page, /Granular access controls/);
  assert.match(page, /Bilingual by design/);
  assert.match(page, /href=\{`\/sign-in\?locale=ar`\}/);
  assert.match(page, /العربية/);
  assert.match(form, /Secure access to your ORB workspace/);
  assert.match(form, /autoCapitalize="none"/);
  assert.match(form, /spellCheck=\{false\}/);
});

test("Arabic sign-in communicates the same operational trust in a native RTL presentation", () => {
  assert.match(page, /تتبّع كامل للمعاملات/);
  assert.match(page, /صلاحيات وصول دقيقة/);
  assert.match(page, /مصمم للعربية والإنجليزية/);
  assert.match(page, /ORB لإدارة العمليات التجارية/);
  assert.match(page, /hrefLang="en"/);
  assert.match(page, /lang="en">English/);
  assert.match(styles, /\.orb-signin\[dir=rtl\] \.orb-signin-product/);
  assert.match(styles, /\.orb-signin\[dir=rtl\] \.orb-signin-trust-list/);
});

test("refined sign-in has durable responsive, focus, error and reduced-motion styling", () => {
  assert.match(styles, /\.orb-signin-trust-list/);
  assert.match(styles, /\.orb-signin-language:focus-visible/);
  assert.match(styles, /\.orb-signin-field input:focus-visible/);
  assert.match(styles, /\.orb-signin-error/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
});
