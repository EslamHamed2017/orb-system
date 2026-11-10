import assert from "node:assert/strict";
import test from "node:test";
import { authorizeOperation } from "../../src/platform/http/authorize.ts";
import { ProblemError } from "../../src/platform/http/problem.ts";
import { createPilotSession } from "../../src/modules/access/session-service.ts";
import { assertOwnerMfa } from "../../src/modules/access/roles.ts";

test("IDs cannot bypass fixed operation roles", () => {
  for (const [requiredRoles, actorRoles] of [[["OWNER_ADMIN"], ["OPERATIONS"]], [["OWNER_ADMIN", "FINANCE_VIEWER"], ["OPERATIONS"]], [["OWNER_ADMIN", "OPERATIONS"], ["FINANCE_VIEWER"]]] as const)
    assert.throws(() => authorizeOperation({ actor: { userId: "attacker", roles: actorRoles }, requiredRoles }), (error: unknown) => error instanceof ProblemError && error.problem.status === 403);
});

test("authenticated mutations fail closed on CSRF and source", () => {
  const base = { actor: { userId: "user", roles: ["OPERATIONS"] }, requiredRoles: ["OPERATIONS"], mutation: { expectedToken: "a".repeat(32), suppliedToken: "a".repeat(32), origin: "https://orb.example", allowedOrigins: ["https://orb.example"] } };
  assert.doesNotThrow(() => authorizeOperation(base));
  for (const mutation of [{ suppliedToken: null }, { origin: "https://evil.example" }, { origin: null, referer: null }])
    assert.throws(() => authorizeOperation({ ...base, mutation: { ...base.mutation, ...mutation } }), ProblemError);
});


test("Owner sessions require MFA and use a hardened host-only cookie", async () => {
  assert.throws(() => assertOwnerMfa({ roles:["OWNER_ADMIN"], mfaSatisfiedAt:null, now:"2026-11-10T00:00:00.000Z" }), ProblemError);
  const created=await createPilotSession({sessionId:"session",userId:"owner",roles:["OWNER_ADMIN"],now:"2026-11-10T00:00:00.000Z",repository:{insertSession:async()=>{},findSession:async()=>null,updateSession:async()=>({}),listUserSessions:async()=>[]},generateSessionToken:()=>"session-secret",generateCsrfToken:()=>"csrf-secret"});
  assert.deepEqual(created.cookie,{name:"__Host-orb_session",secure:true,httpOnly:true,sameSite:"Strict",path:"/",domain:null}); assert.equal(created.session.mfaRequired,true);
});
