import assert from "node:assert/strict";
import test from "node:test";
import { createLogRedactor } from "../../src/platform/logging/redaction.ts";
import { IncidentLog } from "../../src/platform/observability/incident-log.ts";
test("nested secret keys and values never reach logs",()=>{const secret="super-secret-token";const output=createLogRedactor([secret])({authorization:"Bearer abc",nested:{cookie:"__Host-orb_session=x",note:`v=${secret}`},list:[{password:"p"}]});const json=JSON.stringify(output);for(const leak of [secret,"Bearer abc","__Host-orb_session"])assert.doesNotMatch(json,new RegExp(leak));});
test("incident records are deeply immutable and redacted",()=>{const record=new IncidentLog(()=>"2026-11-10T00:00:00.000Z").append({kind:"JOB_FAILURE",severity:"HIGH",correlationId:"c1",secretValues:["secret"],details:{token:"secret",safe:"ok"}});assert.deepEqual(record.details,{token:"[REDACTED]",safe:"ok"});assert.equal(Object.isFrozen(record.details),true);});
