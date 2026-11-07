export function createLivenessHandler(now:()=>string=()=>new Date().toISOString()) { return async function GET():Promise<Response> { return Response.json({status:"live",checkedAt:now()},{status:200,headers:{"cache-control":"no-store"}}); }; }
export const GET=createLivenessHandler();
