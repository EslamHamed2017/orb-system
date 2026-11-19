import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { accessRoute, noStore, readJsonObject } from "../../../../../modules/access/access-runtime.ts";

/** Owner sets a new temporary password for a user. All of that user's sessions are revoked. */
export const POST = accessRoute<{ userId: string }>({ mutation: true }, async (request, { actor, service }, { userId }) => {
  const body = await readJsonObject(request);
  return NextResponse.json(await service.resetPassword(actor, userId, body), { headers: noStore });
});
