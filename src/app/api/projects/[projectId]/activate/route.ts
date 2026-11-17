import {NextResponse} from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import {ProjectDailyProblem} from "../../../../../modules/projects/project-daily-service.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import {validateProjectMutationRequest} from "../../../../../modules/projects/project-mutation-security.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import {projectRuntime} from "../../../../../modules/projects/project-runtime.ts";
import type {ProjectPrincipal} from "../../route.ts";
export interface ProjectActivationRouteDependencies{readonly authenticate:(request:Request)=>Promise<ProjectPrincipal|null>;readonly activate?:(input:{request:Request;projectId:string;expectedVersion:number;principal:ProjectPrincipal})=>Promise<unknown>}
const slug=(code:string)=>code.toLowerCase().replaceAll("_","-");
function issue(request:Request,status:number,code:string){return NextResponse.json({type:`https://orb.example/problems/${slug(code)}`,title:code,status,code,correlationId:request.headers.get("x-correlation-id")??crypto.randomUUID()},{status,headers:{"content-type":"application/problem+json","Cache-Control":"no-store"}})}
function version(request:Request){const value=request.headers.get("if-match");if(value===null)return null;if(!/^"[1-9]\d*"$/.test(value))throw new ProjectDailyProblem("VALIDATION_FAILED",400);return Number(value.slice(1,-1))}
export function createProjectActivationPostHandler(d:ProjectActivationRouteDependencies){return async(request:Request,context:{params:Promise<{projectId:string}>})=>{try{const principal=await d.authenticate(request);if(!principal)return issue(request,401,"AUTHENTICATION_REQUIRED");if(!principal.roles.some(role=>role==="OWNER_ADMIN"||role==="OPERATIONS"))return issue(request,403,"PERMISSION_DENIED");if(!d.activate)return issue(request,503,"DEPENDENCY_UNAVAILABLE");const expectedVersion=version(request);if(expectedVersion===null)return issue(request,428,"PRECONDITION_REQUIRED");const {projectId}=await context.params;const result=await d.activate({request,projectId,expectedVersion,principal}) as {version?:unknown};return NextResponse.json(result,{headers:{"Cache-Control":"no-store","ETag":`"${String(result.version)}"`}})}catch(error){return error instanceof ProjectDailyProblem?issue(request,error.status,error.code):issue(request,503,"DEPENDENCY_UNAVAILABLE")}}}
export const POST=createProjectActivationPostHandler({authenticate:request=>projectRuntime().authenticate(request),activate:({request,projectId,expectedVersion,principal})=>projectRuntime().activate({principal,projectId,expectedVersion,key:validateProjectMutationRequest(request)})});
