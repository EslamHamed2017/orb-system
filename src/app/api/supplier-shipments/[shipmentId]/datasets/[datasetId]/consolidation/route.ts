import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission, type OperationPrincipal } from "../../../../../../../modules/access/permissions.ts";
export interface ShipmentPrincipal extends OperationPrincipal {}
function problem(status:number,code:string){return NextResponse.json({type:`https://orb.example/problems/${code.toLowerCase().replaceAll("_","-")}`,title:code,status,code,correlationId:crypto.randomUUID()},{status,headers:{"content-type":"application/problem+json","Cache-Control":"no-store"}});}
function allowed(principal:ShipmentPrincipal|null){if(!principal)return problem(401,"AUTHENTICATION_REQUIRED");try{assertServerPermission(principal,"getSupplierContainerConsolidation");return null;}catch{return problem(403,"PERMISSION_DENIED");}}
export interface Dependencies{authenticate:(request:Request)=>Promise<ShipmentPrincipal|null>;getConsolidation?:(input:{request:Request;shipmentId:string;datasetId:string;principal:ShipmentPrincipal})=>Promise<unknown>}
export function createGetHandler(d:Dependencies){return async(request:Request,context:{params:Promise<{shipmentId:string;datasetId:string}>})=>{const principal=await d.authenticate(request),denied=allowed(principal);if(denied)return denied;if(!d.getConsolidation)return problem(503,"DEPENDENCY_UNAVAILABLE");const {shipmentId,datasetId}=await context.params;return NextResponse.json(await d.getConsolidation({request,shipmentId,datasetId,principal:principal!}),{headers:{"Cache-Control":"no-store"}});};}
export const GET=createGetHandler({authenticate:async()=>null});
