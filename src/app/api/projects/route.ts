import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ProjectDailyProblem,type ProjectDailyPrincipal } from "../../../modules/projects/project-daily-service.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { validateProjectMutationRequest } from "../../../modules/projects/project-mutation-security.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { projectRuntime } from "../../../modules/projects/project-runtime.ts";
export interface ProjectPrincipal extends ProjectDailyPrincipal{}
export interface ProjectsRouteDependencies{readonly authenticate:(request:Request)=>Promise<ProjectPrincipal|null>;readonly list?:(input:{request:Request;principal:ProjectPrincipal})=>Promise<unknown>;readonly create?:(input:{request:Request;principal:ProjectPrincipal;body:unknown})=>Promise<unknown>}
const issue=(status:number,code:string)=>NextResponse.json({type:`https://orb.example/problems/${code.toLowerCase().replaceAll("_","-")}`,title:code,status,code,correlationId:crypto.randomUUID()},{status,headers:{"content-type":"application/problem+json","Cache-Control":"no-store"}});
function caught(error:unknown){return error instanceof ProjectDailyProblem?issue(error.status,error.code):issue(500,"DEPENDENCY_UNAVAILABLE")}
async function principalOf(d:ProjectsRouteDependencies,r:Request,write:boolean){const p=await d.authenticate(r);if(!p)return null;const roles=write?["OWNER_ADMIN","OPERATIONS"]:["OWNER_ADMIN","OPERATIONS","FINANCE_VIEWER"];return p.roles.some(role=>roles.includes(role))?p:false}
export function createProjectsGetHandler(d:ProjectsRouteDependencies){return async(r:Request)=>{try{const p=await principalOf(d,r,false);if(p===null)return issue(401,"AUTHENTICATION_REQUIRED");if(p===false)return issue(403,"PERMISSION_DENIED");if(!d.list)return issue(503,"DEPENDENCY_UNAVAILABLE");return NextResponse.json({items:await d.list({request:r,principal:p}),nextCursor:null},{headers:{"Cache-Control":"no-store","x-orb-project-write-permitted":String(p.roles.some(role=>role==="OWNER_ADMIN"||role==="OPERATIONS"))}})}catch(e){return caught(e)}}}
export function createProjectsPostHandler(d:ProjectsRouteDependencies){return async(r:Request)=>{try{const p=await principalOf(d,r,true);if(p===null)return issue(401,"AUTHENTICATION_REQUIRED");if(p===false)return issue(403,"PERMISSION_DENIED");if(!d.create)return issue(503,"DEPENDENCY_UNAVAILABLE");let body:unknown;try{body=await r.json()}catch{return issue(400,"VALIDATION_FAILED")}return NextResponse.json(await d.create({request:r,principal:p,body}),{status:201,headers:{"Cache-Control":"no-store"}})}catch(e){return caught(e)}}}
const production:ProjectsRouteDependencies={authenticate:r=>projectRuntime().authenticate(r),list:({principal})=>projectRuntime().service.list({principal}),create:({request,principal,body})=>projectRuntime().create({principal,body,key:validateProjectMutationRequest(request)})};
export const GET=createProjectsGetHandler(production);export const POST=createProjectsPostHandler(production);
