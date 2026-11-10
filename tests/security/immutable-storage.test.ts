import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertImmutableObject } from "../../src/platform/object-store/client.ts";
const sql=readFileSync("prisma/migrations/202611050001_r1_initial/migration.sql","utf8");
test("application role cannot update or delete append-only records",()=>{for(const table of ["AuditEvent","ShipmentExecutionEvent","OutboundSendAttempt"])assert.ok(sql.includes(`CREATE TRIGGER \"${table}_append_only\" BEFORE UPDATE OR DELETE ON \"${table}\" FOR EACH ROW EXECUTE FUNCTION orb_deny_mutation()`),table);assert.match(sql,/REVOKE UPDATE, DELETE ON "ShipmentExecutionEvent", "OutboundSendAttempt", "AuditEvent" FROM orb_app/);});
test("evidence metadata and stored bytes identity are immutable",()=>{assert.match(sql,/EvidenceObject_immutable_content[\s\S]+orb_guard_immutable_content/);assert.doesNotThrow(()=>assertImmutableObject({objectKey:"evidence/1",objectVersionId:"v1",retentionUntil:"2036-01-01T00:00:00.000Z"},{objectKey:"evidence/1",retentionUntil:"2036-01-01T00:00:00.000Z"}));assert.throws(()=>assertImmutableObject({objectKey:"evidence/1",objectVersionId:"",retentionUntil:"2036-01-01T00:00:00.000Z"},{objectKey:"evidence/1",retentionUntil:"2036-01-01T00:00:00.000Z"}));});
