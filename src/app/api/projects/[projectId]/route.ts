import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ProjectDailyProblem } from "../../../../modules/projects/project-daily-service.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { projectRuntime } from "../../../../modules/projects/project-runtime.ts";
import type { ProjectPrincipal } from "../route.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { supplierShipmentDailyRuntime } from "../../../../modules/shipments/supplier-shipment-daily-runtime.ts";
export interface ProjectRouteDependencies{readonly authenticate:(request:Request)=>Promise<ProjectPrincipal|null>;readonly get?:(input:{request:Request;projectId:string;principal:ProjectPrincipal})=>Promise<unknown>}
const issue=(status:number,code:string)=>NextResponse.json({code,status},{status,headers:{"Cache-Control":"no-store"}});
export function createProjectGetHandler(d:ProjectRouteDependencies){return async(r:Request,c:{params:Promise<{projectId:string}>})=>{try{const p=await d.authenticate(r);if(!p)return issue(401,"AUTHENTICATION_REQUIRED");if(!p.roles.some(role=>["OWNER_ADMIN","OPERATIONS","FINANCE_VIEWER"].includes(role)))return issue(403,"PERMISSION_DENIED");if(!d.get)return issue(503,"DEPENDENCY_UNAVAILABLE");const {projectId}=await c.params;const project=await d.get({request:r,projectId,principal:p});const canCreateSupplierShipment=p.roles.some(role=>role==="OWNER_ADMIN"||role==="OPERATIONS");return NextResponse.json({...project as object,capabilities:{canCreateSupplierShipment}},{headers:{"Cache-Control":"no-store","x-orb-project-write-permitted":String(canCreateSupplierShipment)}})}catch(e){return e instanceof ProjectDailyProblem?issue(e.status,e.code):issue(500,"DEPENDENCY_UNAVAILABLE")}}}
export const GET=createProjectGetHandler({authenticate:r=>projectRuntime().authenticate(r),get:async({projectId,principal})=>{const project=await projectRuntime().service.get({id:projectId,principal});const supplierShipments=await supplierShipmentDailyRuntime().service.list({projectId,principal});return {...project,supplierShipments}}});
