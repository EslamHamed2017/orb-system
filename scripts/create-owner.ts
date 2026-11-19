/**
 * Creates the first owner administrator (and the company tenant, if it does not exist yet).
 *
 * Usage:
 *   DATABASE_URL=... ORB_OWNER_PASSWORD='...' pnpm access:create-owner -- \
 *     --login eslam@company.com --name-en "Eslam" --name-ar "إسلام" --tenant-slug pss --tenant-name "PSS"
 *
 * The password is read from ORB_OWNER_PASSWORD so it never appears in shell history arguments.
 * Refuses to run when the tenant already has an active owner, unless --additional is passed.
 */
import { parseArgs } from "node:util";
import { getPrismaClient } from "../src/platform/database/prisma-client.ts";
import { PrismaAccessStore } from "../src/modules/access/access-store.ts";
import { normalizeLogin } from "../src/modules/access/access-service.ts";
import { hashPassword, passwordPolicyViolation } from "../src/modules/access/password.ts";

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    login: { type: "string" },
    "name-en": { type: "string" },
    "name-ar": { type: "string" },
    locale: { type: "string", default: "ar" },
    "tenant-slug": { type: "string" },
    "tenant-name": { type: "string" },
    additional: { type: "boolean", default: false },
  },
});

function fail(message: string): never {
  console.error(`create-owner: ${message}`);
  process.exit(1);
}

const password = process.env.ORB_OWNER_PASSWORD;
const violation = passwordPolicyViolation(password);
if (violation) fail(`ORB_OWNER_PASSWORD: ${violation}`);
if (!values.login || !values["name-en"] || !values["name-ar"] || !values["tenant-slug"]) {
  fail("--login, --name-en, --name-ar and --tenant-slug are required.");
}
if (values.locale !== "ar" && values.locale !== "en") fail("--locale must be ar or en.");
if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(values["tenant-slug"])) fail("--tenant-slug must be lowercase letters, digits and dashes.");

const prisma = getPrismaClient();
const store = new PrismaAccessStore(prisma);
try {
  const login = normalizeLogin(values.login);
  let tenant = await prisma.tenant.findUnique({ where: { slug: values["tenant-slug"] } });
  if (!tenant) {
    tenant = await prisma.tenant.create({ data: { slug: values["tenant-slug"], name: values["tenant-name"] ?? values["tenant-slug"] } });
    console.log(`Created tenant ${tenant.slug} (${tenant.id}).`);
  }
  const owners = await store.activeOwnerIds(tenant.id);
  if (owners.length > 0 && !values.additional) fail(`tenant ${tenant.slug} already has ${owners.length} active owner(s). Pass --additional to add another.`);
  if (await store.loginExists(login)) fail(`login ${login} already exists.`);
  const userId = await store.createUser({
    tenantId: tenant.id, actorId: null, login, nameEn: values["name-en"].trim(), nameAr: values["name-ar"].trim(),
    locale: values.locale, roleCodes: ["OWNER_ADMIN"], passwordHash: await hashPassword(password as string), mustChangePassword: false, now: new Date(),
  });
  console.log(`Created owner administrator ${login} (${userId}).`);
  if (process.env.ORB_OWNER_MFA_REQUIRED !== "0") {
    console.log("Note: ORB_OWNER_MFA_REQUIRED is not 0, so owner sessions will be refused until MFA is built. Set ORB_OWNER_MFA_REQUIRED=0 for now.");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await prisma.$disconnect();
}
