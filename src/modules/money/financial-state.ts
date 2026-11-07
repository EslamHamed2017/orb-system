export interface FinancialProject { readonly id: string; readonly finalState: string }
export interface FinancialTarget { readonly projectId: string; readonly outstanding: string }

export function deriveProjectFinancialState(project: FinancialProject, targets: readonly FinancialTarget[]) {
  const hasOutstanding = targets.some((target) => target.projectId === project.id && target.outstanding !== "0.000000");
  return Object.freeze({
    shipmentState: hasOutstanding ? "OPEN" : "SETTLED",
    projectState: hasOutstanding ? "ACTIVE" : "FINANCIALLY_CLOSED",
    finalState: hasOutstanding ? "OPEN" : project.finalState,
  });
}
