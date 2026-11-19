import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { accessRoute, readJsonObject, sessionTokenHash } from "../../../../../modules/access/access-runtime.ts";

/** Change your own password. Other sessions of the same user are revoked; this one stays signed in. */
export const POST = accessRoute<Record<string, never>>({ mutation: true }, async (request, { actor, service }) => {
  const body = await readJsonObject(request);
  await service.changeOwnPassword(actor, { currentPassword: body.currentPassword, newPassword: body.newPassword, sessionTokenHash: sessionTokenHash(request) ?? "" });
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
});
