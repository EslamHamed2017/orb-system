import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { bodyOf, idempotencyKey, jsonBody, mapShipmentErrors, shipmentActor, shipmentExecution, shipmentMutationActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";
export interface ShipmentPrincipal { readonly userId:string; readonly roles:readonly string[] }
function problem(status:number,code:string){return NextResponse.json({type:`https://orb.example/problems/${code.toLowerCase().replaceAll("_","-")}`,title:code,status,code,correlationId:crypto.randomUUID()},{status,headers:{"content-type":"application/problem+json","Cache-Control":"no-store"}});}
function allowed(principal:ShipmentPrincipal|null,write:boolean){if(!principal)return problem(401,"AUTHENTICATION_REQUIRED");const roles=write?["OWNER_ADMIN","OPERATIONS"]:["OWNER_ADMIN","OPERATIONS","FINANCE_VIEWER"];return principal.roles.some(role=>roles.includes(role))?null:problem(403,"PERMISSION_DENIED");}
export interface Dependencies{authenticate:(request:Request)=>Promise<ShipmentPrincipal|null>;list?:(input:{request:Request;shipmentId:string;principal:ShipmentPrincipal})=>Promise<unknown>;revise?:(input:{request:Request;shipmentId:string;principal:ShipmentPrincipal;body:unknown})=>Promise<unknown>}
export function createGetHandler(d:Dependencies){return async(request:Request,context:{params:Promise<{shipmentId:string}>})=>{const principal=await d.authenticate(request),denied=allowed(principal,false);if(denied)return denied;if(!d.list)return problem(503,"DEPENDENCY_UNAVAILABLE");const {shipmentId}=await context.params;return NextResponse.json(await d.list({request,shipmentId,principal:principal!}),{headers:{"Cache-Control":"no-store"}});};}
export function createPostHandler(d:Dependencies){return async(request:Request,context:{params:Promise<{shipmentId:string}>})=>{const principal=await d.authenticate(request),denied=allowed(principal,true);if(denied)return denied;if(!d.revise)return problem(503,"DEPENDENCY_UNAVAILABLE");const {shipmentId}=await context.params;return NextResponse.json(await d.revise({request,shipmentId,principal:principal!,body:await request.json()}),{status:201,headers:{"Cache-Control":"no-store"}});};}
export const GET = mapShipmentErrors(createGetHandler({
  authenticate: (request) => shipmentActor(request),
  list: async ({ request, shipmentId }) => ({ items: (await shipmentExecution().get(await shipmentActor(request), "SUPPLIER", shipmentId)).revisions }),
}));
export const POST = mapShipmentErrors(createPostHandler({
  authenticate: (request) => shipmentMutationActor(request),
  revise: async ({ request, shipmentId, principal, body }) => shipmentExecution().revise(principal as never, "SUPPLIER", shipmentId, bodyOf(request, body)),
}));
