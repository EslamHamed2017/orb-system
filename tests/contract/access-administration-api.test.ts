import assert from "node:assert/strict";
import test from "node:test";

const OWNER = { userId: "019a5f9b-7c00-7000-8000-00000000a001", roles: ["OWNER_ADMIN"] };
const OPS = { userId: "019a5f9b-7c00-7000-8000-00000000a002", roles: ["OPERATIONS"] };

test("owner administers bilingual users, configurable roles, and granular permissions", async () => {
  const { createInMemoryAccessAdministrationService } = await import("../../src/modules/access/administration-service.ts");
  const service = createInMemoryAccessAdministrationService({
    permissions: [
      { code: "projects.read", nameEn: "Read projects", nameAr: "عرض المشاريع", category: "SCREEN", descriptionEn: "View project workspaces", descriptionAr: "عرض مساحات عمل المشاريع" },
      { code: "contracts.approve", nameEn: "Approve contracts", nameAr: "اعتماد العقود", category: "APPROVAL", descriptionEn: "Approve contract versions", descriptionAr: "اعتماد إصدارات العقود" },
    ],
    now: () => "2026-11-11T13:00:00.000Z",
    id: (() => { let value = 0; return () => `019a5f9b-7c00-7000-8000-${String(++value).padStart(12, "0")}`; })(),
  });

  const role = await service.createRole({ principal: OWNER, input: { code: "CONTRACT_REVIEWER", nameEn: "Contract reviewer", nameAr: "مراجع العقود", descriptionEn: "Reviews contract versions", descriptionAr: "يراجع إصدارات العقود", permissionCodes: ["projects.read", "contracts.approve"] } });
  assert.deepEqual(role.permissionCodes, ["contracts.approve", "projects.read"]);

  const user = await service.createUser({ principal: OWNER, input: { authSubject: "reviewer@orb.local", nameEn: "Contract Reviewer", nameAr: "مراجع العقود", locale: "ar", roleCodes: ["CONTRACT_REVIEWER"] } });
  assert.equal(user.status, "ACTIVE");
  assert.deepEqual(user.roleCodes, ["CONTRACT_REVIEWER"]);
  assert.equal((await service.listUsers({ principal: OWNER })).items[0]?.authSubject, "reviewer@orb.local");

  const suspended = await service.updateUser({ principal: OWNER, userId: user.id, input: { status: "SUSPENDED" } });
  assert.equal(suspended.status, "SUSPENDED");
  const reassigned = await service.replaceUserRoles({ principal: OWNER, userId: user.id, roleCodes: [] });
  assert.deepEqual(reassigned.roleCodes, []);
  const narrowedRole = await service.replaceRolePermissions({ principal: OWNER, roleId: role.id, permissionCodes: ["projects.read"] });
  assert.deepEqual(narrowedRole.permissionCodes, ["projects.read"]);
  assert.equal((await service.listRoles({ principal: OWNER })).items[0]?.code, "CONTRACT_REVIEWER");
  assert.equal((await service.listPermissions({ principal: OWNER })).items.length, 2);
});

test("access administration denies non-owners and fails closed on invalid or protected changes", async () => {
  const { createInMemoryAccessAdministrationService } = await import("../../src/modules/access/administration-service.ts");
  const service = createInMemoryAccessAdministrationService({
    permissions: [{ code: "projects.read", nameEn: "Read projects", nameAr: "عرض المشاريع", category: "SCREEN", descriptionEn: "View projects", descriptionAr: "عرض المشاريع" }],
  });
  await assert.rejects(() => service.listUsers({ principal: OPS }), /Access administration denied/);
  await assert.rejects(() => service.createRole({ principal: OWNER, input: { code: "bad code", nameEn: "Bad", nameAr: "سيئ", descriptionEn: "Bad role", descriptionAr: "دور سيئ", permissionCodes: [] } }), /code/);
  await assert.rejects(() => service.createRole({ principal: OWNER, input: { code: "REVIEWER", nameEn: "Reviewer", nameAr: "مراجع", descriptionEn: "Reviews", descriptionAr: "يراجع", permissionCodes: ["missing.permission"] } }), /Unknown permission/);
  await assert.rejects(() => service.createUser({ principal: OWNER, input: { authSubject: "", nameEn: "User", nameAr: "مستخدم", locale: "en", roleCodes: [] } }), /authSubject/);
});


test("access administration HTTP handlers authenticate owners before invoking commands", async () => {
  const usersRoute = await import("../../src/app/api/users/route.ts");
  const rolesRoute = await import("../../src/app/api/roles/route.ts");
  const permissionsRoute = await import("../../src/app/api/permissions/route.ts");
  const calls: any[] = [];
  const users = usersRoute.createUsersHandlers({
    authenticate: async () => OWNER,
    list: async (input: any) => { calls.push(["listUsers", input]); return { items: [] }; },
    create: async (input: any) => { calls.push(["createUser", input]); return { id: "user-1", ...input.input }; },
  });
  assert.equal((await users.GET(new Request("https://orb.example/api/users"))).status, 200);
  const created = await users.POST(new Request("https://orb.example/api/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ authSubject: "new@orb.local", nameEn: "New User", nameAr: "مستخدم جديد", locale: "ar", roleCodes: [] }) }));
  assert.equal(created.status, 201);
  assert.equal(calls[1][1].principal.userId, OWNER.userId);

  const roles = rolesRoute.createRolesHandlers({ authenticate: async () => OWNER, list: async () => ({ items: [] }), create: async (input: any) => input.input });
  assert.equal((await roles.GET(new Request("https://orb.example/api/roles"))).status, 200);
  assert.equal((await roles.POST(new Request("https://orb.example/api/roles", { method: "POST", body: JSON.stringify({ code: "REVIEWER" }) }))).status, 201);
  const permissions = permissionsRoute.createPermissionsGetHandler({ authenticate: async () => OWNER, list: async () => ({ items: [] }) });
  assert.equal((await permissions(new Request("https://orb.example/api/permissions"))).status, 200);

  let called = false;
  const denied = usersRoute.createUsersHandlers({ authenticate: async () => OPS, list: async () => { called = true; }, create: async () => { called = true; } });
  assert.equal((await denied.GET(new Request("https://orb.example/api/users"))).status, 403);
  assert.equal(called, false);
});


test("nested access administration handlers replace assignments and update users", async () => {
  const userRoute = await import("../../src/app/api/users/[userId]/route.ts");
  const assignmentRoute = await import("../../src/app/api/users/[userId]/roles/route.ts");
  const grantRoute = await import("../../src/app/api/roles/[roleId]/permissions/route.ts");
  const calls: any[] = [];
  const patch = userRoute.createUserPatchHandler({ authenticate: async () => OWNER, update: async (input: any) => { calls.push(input); return input.input; } });
  assert.equal((await patch(new Request("https://orb.example/api/users/u1", { method: "PATCH", body: JSON.stringify({ status: "SUSPENDED" }) }), { params: Promise.resolve({ userId: "u1" }) })).status, 200);
  const assign = assignmentRoute.createUserRolesPutHandler({ authenticate: async () => OWNER, replace: async (input: any) => { calls.push(input); return input.roleCodes; } });
  assert.equal((await assign(new Request("https://orb.example/api/users/u1/roles", { method: "PUT", body: JSON.stringify({ roleCodes: ["REVIEWER"] }) }), { params: Promise.resolve({ userId: "u1" }) })).status, 200);
  const grant = grantRoute.createRolePermissionsPutHandler({ authenticate: async () => OWNER, replace: async (input: any) => { calls.push(input); return input.permissionCodes; } });
  assert.equal((await grant(new Request("https://orb.example/api/roles/r1/permissions", { method: "PUT", body: JSON.stringify({ permissionCodes: ["projects.read"] }) }), { params: Promise.resolve({ roleId: "r1" }) })).status, 200);
  assert.deepEqual(calls.map((call) => [call.userId ?? call.roleId, call.roleCodes ?? call.permissionCodes ?? call.input.status]), [["u1", "SUSPENDED"], ["u1", ["REVIEWER"]], ["r1", ["projects.read"]]]);
});
