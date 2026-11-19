import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { bodyOf, idempotencyKey, jsonBody, mapShipmentErrors, shipmentActor, shipmentExecution, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";
export interface ShipmentPrincipal { readonly userId:string; readonly roles:readonly string[] }
function problem(status:number,code:string){return NextResponse.json({type:`https://orb.example/problems/${code.toLowerCase().replaceAll("_","-")}`,title:code,status,code,correlationId:crypto.randomUUID()},{status,headers:{"content-type":"application/problem+json","Cache-Control":"no-store"}});}
function allowed(principal:ShipmentPrincipal|null,write:boolean){if(!principal)return problem(401,"AUTHENTICATION_REQUIRED");const roles=write?["OWNER_ADMIN","OPERATIONS"]:["OWNER_ADMIN","OPERATIONS","FINANCE_VIEWER"];return principal.roles.some(role=>roles.includes(role))?null:problem(403,"PERMISSION_DENIED");}
export interface Dependencies{authenticate:(request:Request)=>Promise<ShipmentPrincipal|null>;set?:(input:{request:Request;shipmentId:string;principal:ShipmentPrincipal;body:unknown})=>Promise<unknown>}
export function createPutHandler(d:Dependencies){return async(request:Request,context:{params:Promise<{shipmentId:string}>})=>{const principal=await d.authenticate(request),denied=allowed(principal,true);if(denied)return denied;if(!d.set)return problem(503,"DEPENDENCY_UNAVAILABLE");const {shipmentId}=await context.params;return NextResponse.json(await d.set({request,shipmentId,principal:principal!,body:await request.json()}),{headers:{"Cache-Control":"no-store"}});};}
export const PUT = mapShipmentErrors(createPutHandler({
  authenticate: (request) => shipmentMutationActor(request),
  set: async ({ request, shipmentId, principal, body }) => shipmentExecution().setPrimarySource(principal as never, shipmentId, bodyOf(request, body)),
}));
