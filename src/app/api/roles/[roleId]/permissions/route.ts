import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { authenticateRequest, mapAccessErrors } from "../../../../../modules/access/access-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { AccessProblem } from "../../../../../modules/access/access-service.ts";
// @ts-expect-error TS5097: direct Node test execution requires the explicit TypeScript extension.
import { accessProblem, requireAccessOwner, type AccessPrincipal } from "../../../../../modules/access/administration-http.ts";
export interface RolePermissionsRouteDependencies { readonly authenticate:(request:Request)=>Promise<AccessPrincipal|null>; readonly replace?:(input:{request:Request;principal:AccessPrincipal;roleId:string;permissionCodes:readonly string[]})=>Promise<unknown>; }
export function createRolePermissionsPutHandler(dependencies:RolePermissionsRouteDependencies){return async function PUT(request:Request,context:{params:Promise<{roleId:string}>}){const principal=await requireAccessOwner(request,dependencies.authenticate);if(principal instanceof Response)return principal;if(!dependencies.replace)return accessProblem(503,"DEPENDENCY_UNAVAILABLE");let body:unknown;try{body=await request.json();}catch{return accessProblem(400,"VALIDATION_FAILED");}const permissionCodes=(body as {permissionCodes?:unknown})?.permissionCodes;if(!Array.isArray(permissionCodes)||!permissionCodes.every(value=>typeof value==="string"))return accessProblem(400,"VALIDATION_FAILED");const {roleId}=await context.params;return NextResponse.json(await dependencies.replace({request,principal,roleId,permissionCodes}),{headers:{"Cache-Control":"no-store"}});};}
export const PUT = mapAccessErrors(createRolePermissionsPutHandler({
  authenticate: authenticateRequest,
  replace: async () => { throw new AccessProblem(422, "VALIDATION_FAILED", "System role permissions are fixed in this release."); },
}));
