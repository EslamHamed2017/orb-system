export const PROJECT_STORAGE_KEY = "orb.user-projects.owner-1.v1";

export type ProjectStorage = Pick<Storage, "getItem" | "setItem">;
type Mutation<TRecord, TResult> = Readonly<{ records: TRecord[]; result: TResult }>;

let fallbackTail: Promise<void> = Promise.resolve();

async function withInPageLock<T>(action: () => T | Promise<T>): Promise<T> {
  const previous = fallbackTail;
  let release!: () => void;
  fallbackTail = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try { return await action(); } finally { release(); }
}

/**
 * Serializes cooperating writes to the complete project-storage array. The Web
 * Locks path coordinates same-origin tabs; the fallback coordinates this page.
 * This mitigates same-browser cooperating writers only, not other devices,
 * non-cooperating scripts, or server-side concurrency.
 */
export async function withProjectStorageWriteLock<T>(action: () => T | Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (locks) return locks.request(PROJECT_STORAGE_KEY, { mode: "exclusive" }, action);
  return withInPageLock(action);
}

export async function mutateProjectStorage<TRecord, TResult>(
  storage: ProjectStorage,
  parse: (raw: string | null) => TRecord[],
  mutate: (records: TRecord[]) => Mutation<TRecord, TResult> | Promise<Mutation<TRecord, TResult>>,
): Promise<TResult> {
  return withProjectStorageWriteLock(async () => {
    const records = parse(storage.getItem(PROJECT_STORAGE_KEY));
    const mutation = await mutate(records);
    const serialized = JSON.stringify(mutation.records);
    parse(serialized);
    storage.setItem(PROJECT_STORAGE_KEY, serialized);
    return mutation.result;
  });
}
