import type { ar } from "../i18n/ar";
import type { en } from "../i18n/en";

type Copy = typeof ar | typeof en;
export type AsyncStateName = keyof Copy["states"];

export function AsyncState({ state, copy }: { readonly state: AsyncStateName; readonly copy: Copy }) {
  const content = copy.states[state];
  return <section className="orb-async" data-async-state={state} role={state === "error" ? "alert" : "status"} aria-live="polite">
    <h2>{content.title}</h2>
    <p>{content.detail}</p>
    {state === "loading"
      ? <div className="orb-progress" role="progressbar" aria-label={content.title} />
      : <button type="button">{"action" in content ? content.action : copy.close}</button>}
  </section>;
}
