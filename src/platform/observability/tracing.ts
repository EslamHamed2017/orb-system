// @ts-expect-error TS5097: direct Node test execution requires the explicit TypeScript extension.
import { createLogRedactor } from "../logging/redaction.ts";
type TraceStatus = "OK" | "ERROR";
export type TraceRecord = Readonly<{ name:string; correlationId:string; auditEventId?:string; status:TraceStatus; attributes:unknown; events:readonly Readonly<{name:string;attributes:unknown}>[]; error?:unknown }>;
export class InMemoryTraceSink { private readonly records: TraceRecord[]=[]; write(record:TraceRecord):void { this.records.push(record); } snapshot():readonly TraceRecord[] { return this.records.map((record)=>structuredClone(record)); } }
export async function traceOperation<T>(sink:{write(record:TraceRecord):void}, input:{name:string;correlationId:string;auditEventId?:string;attributes?:unknown;secretValues?:readonly string[]}, work:(span:{event(name:string,attributes?:unknown):void})=>Promise<T>):Promise<T> {
  if (!input.name.trim()||!input.correlationId.trim()) throw new TypeError("trace name and correlationId are required");
  const redact=createLogRedactor(input.secretValues), events:{name:string;attributes:unknown}[]=[];
  const span={event(name:string,attributes:unknown={}):void { events.push({name,attributes:redact(attributes)}); }};
  try { const result=await work(span); sink.write(Object.freeze({name:input.name,correlationId:input.correlationId,...(input.auditEventId?{auditEventId:input.auditEventId}:{}),status:"OK" as const,attributes:redact(input.attributes??{}),events:Object.freeze(events)})); return result; }
  catch(error) { sink.write(Object.freeze({name:input.name,correlationId:input.correlationId,...(input.auditEventId?{auditEventId:input.auditEventId}:{}),status:"ERROR" as const,attributes:redact(input.attributes??{}),events:Object.freeze(events),error:redact(error instanceof Error?{name:error.name,message:"[REDACTED]"}:error)})); throw error; }
}
