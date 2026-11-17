import { timingSafeEqual } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { sessionCsrfToken } from "../access/session-csrf.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ProjectDailyProblem } from "./project-daily-service.ts";
const KEY=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function cookie(request:Request,name:string){const header=request.headers.get("cookie");if(!header)return null;for(const part of header.split(";")){const [key,...value]=part.trim().split("=");if(key===name)try{return decodeURIComponent(value.join("="))}catch{return null}}return null}
function equal(a:string|null,b:string|null){if(!a||!b)return false;const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right)}
export const projectCsrfToken=(sessionToken:string)=>sessionCsrfToken(sessionToken);
export function validateProjectMutationRequest(request:Request){const origin=process.env.ORB_APP_ORIGIN;if(!origin||request.headers.get("origin")!==origin)throw new ProjectDailyProblem("PERMISSION_DENIED",403);const session=cookie(request,"__Host-orb_session"),csrf=cookie(request,"__Host-orb_csrf"),expected=session?projectCsrfToken(session):null;if(!equal(request.headers.get("x-csrf-token"),csrf)||!equal(csrf,expected))throw new ProjectDailyProblem("PERMISSION_DENIED",403);const key=request.headers.get("idempotency-key");if(!key||!KEY.test(key))throw new ProjectDailyProblem("VALIDATION_FAILED",400);return key.toLowerCase()}
