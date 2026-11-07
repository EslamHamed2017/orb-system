export interface ClaimProjection {
  readonly id: string;
  readonly projectId: string;
  readonly state: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
}

export function projectClaimClosure(claims: readonly ClaimProjection[], projectId: string) {
  const projectClaims = claims.filter((claim) => claim.projectId === projectId);
  return Object.freeze({
    projectId,
    claimsComplete: projectClaims.every((claim) => claim.state === "RESOLVED" || claim.state === "REJECTED"),
    blockers: Object.freeze(projectClaims.filter((claim) => claim.state === "OPEN" || claim.state === "UNDER_REVIEW").map((claim) => claim.id)),
  });
}

export function claimOutcomeArtifacts() {
  return Object.freeze([] as readonly never[]);
}
