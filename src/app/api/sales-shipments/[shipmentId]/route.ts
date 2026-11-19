import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { idempotencyKey, jsonBody, mapShipmentErrors, shipmentActor, shipmentExecution, shipmentMutationActor } from "../../../../modules/shipments/execution/shipment-execution-runtime.ts";
export interface ShipmentPrincipal { readonly userId:string; readonly roles:readonly string[] }
function problem(status:number,code:string){return NextResponse.json({type:`https://orb.example/problems/${code.toLowerCase().replaceAll("_","-")}`,title:code,status,code,correlationId:crypto.randomUUID()},{status,headers:{"content-type":"application/problem+json","Cache-Control":"no-store"}});}
function allowed(principal:ShipmentPrincipal|null,write:boolean){if(!principal)return problem(401,"AUTHENTICATION_REQUIRED");const roles=write?["OWNER_ADMIN","OPERATIONS"]:["OWNER_ADMIN","OPERATIONS","FINANCE_VIEWER"];return principal.roles.some(role=>roles.includes(role))?null:problem(403,"PERMISSION_DENIED");}
export interface Dependencies{authenticate:(request:Request)=>Promise<ShipmentPrincipal|null>;get?:(input:{request:Request;shipmentId:string;principal:ShipmentPrincipal})=>Promise<unknown>}
export function createGetHandler(d:Dependencies){return async(request:Request,context:{params:Promise<{shipmentId:string}>})=>{const principal=await d.authenticate(request),denied=allowed(principal,false);if(denied)return denied;if(!d.get)return problem(503,"DEPENDENCY_UNAVAILABLE");const {shipmentId}=await context.params;return NextResponse.json(await d.get({request,shipmentId,principal:principal!}),{headers:{"Cache-Control":"no-store"}});};}
export const GET = mapShipmentErrors(createGetHandler({
  authenticate: (request) => shipmentActor(request),
  get: async ({ request, shipmentId }) => shipmentExecution().get(await shipmentActor(request), "SALES", shipmentId),
}));
