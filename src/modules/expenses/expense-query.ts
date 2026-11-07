// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DecimalAmount } from "../../platform/decimal/index.ts";

export interface ExpenseProjectionRow {
  readonly id: string;
  readonly projectId: string;
  readonly state: string;
  readonly amount: string;
  readonly currency: string;
}

function six(value: DecimalAmount): string {
  const [whole, fraction = ""] = value.toString().split(".");
  return `${whole}.${fraction.padEnd(6, "0")}`;
}

export function expenseStatement(rows: readonly ExpenseProjectionRow[], projectId: string, currency: string) {
  const approved = rows.filter((row) => row.projectId === projectId && row.currency === currency && row.state === "APPROVED");
  const lines = approved.map((row) => Object.freeze({ sourceType: "DIRECT_EXPENSE", sourceId: row.id, debit: row.amount }));
  const balance = approved.reduce((sum, row) => sum.add(DecimalAmount.parse(row.amount)), DecimalAmount.parse("0"));
  return Object.freeze({ projectId, currency, lines: Object.freeze(lines), balance: six(balance) });
}

export function expenseMargin(rows: readonly ExpenseProjectionRow[], projectId: string, currency: string) {
  const amount = rows.filter((row) => row.projectId === projectId && row.currency === currency && row.state === "APPROVED")
    .reduce((sum, row) => sum.add(DecimalAmount.parse(row.amount)), DecimalAmount.parse("0"));
  return Object.freeze({ projectId, currency, approvedExpenses: six(amount) });
}

export function expenseClosure(project: { readonly finalState: string; readonly assessmentValid: boolean }) {
  return Object.freeze({ finalState: project.finalState, assessmentValid: project.assessmentValid, expensesComplete: true });
}
