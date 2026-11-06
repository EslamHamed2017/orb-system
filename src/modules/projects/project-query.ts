export interface ProjectPrincipal { readonly userId: string; readonly roles: readonly string[] }
export interface StoredProject extends Readonly<Record<string, unknown>> { readonly id: string; readonly reference: string; readonly version: number }

export function projectProject(project: StoredProject): StoredProject {
  return Object.freeze(structuredClone(project));
}

export function listProjectedProjects(projects: Iterable<StoredProject>): readonly StoredProject[] {
  return Object.freeze([...projects].map(projectProject).sort((left, right) => left.reference.localeCompare(right.reference)));
}
