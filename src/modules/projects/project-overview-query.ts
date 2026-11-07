export const REQUIRED_PROJECT_OVERVIEW_ADAPTERS = Object.freeze([
  "project", "shipments", "routes", "documents", "settlement", "expenses", "claims", "closure", "audit", "marginAndCash",
] as const);

type AdapterName = typeof REQUIRED_PROJECT_OVERVIEW_ADAPTERS[number];
type Adapter = (projectId: string) => Promise<unknown>;
type Row = Record<string, unknown>;
function record(value: unknown, name: string): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`invalid Project overview ${name}`);
  return value as Row;
}
function list(value: unknown, name: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`invalid Project overview ${name}`);
  return value;
}
function sectionMap(value: unknown, name: string): Map<string, Row> {
  const result = new Map<string, Row>();
  for (const item of list(value, name)) { const row = record(item, name); if (typeof row.currency !== "string") throw new TypeError(`invalid Project overview ${name} currency`); result.set(row.currency, row); }
  return result;
}
function blockers(family: string, value: unknown): readonly Row[] {
  return list(record(value, family).blockers, `${family} blockers`).map((item) => Object.freeze({ family, ...structuredClone(record(item, `${family} blocker`)) }));
}

export function createInMemoryProjectOverviewQuery(options: { readonly adapters: Record<string, Adapter> }) {
  for (const name of REQUIRED_PROJECT_OVERVIEW_ADAPTERS) if (typeof options.adapters[name] !== "function") throw new TypeError(`missing Project overview source adapter: ${name}`);
  const adapters = Object.fromEntries(REQUIRED_PROJECT_OVERVIEW_ADAPTERS.map((name) => [name, options.adapters[name]])) as Record<AdapterName, Adapter>;
  return Object.freeze({
    async getProjectOverview(input: { readonly projectId: string; readonly principal: { readonly userId: string; readonly roles: readonly string[] } }) {
      const resolved = await Promise.all(REQUIRED_PROJECT_OVERVIEW_ADAPTERS.map(async (name) => [name, await adapters[name](input.projectId)] as const));
      const source = Object.fromEntries(resolved) as Record<AdapterName, unknown>;
      const project = record(source.project, "project"), shipments = record(source.shipments, "shipments");
      const settlement = sectionMap(record(source.settlement, "settlement").currencySections, "settlement currencySections");
      const expenses = sectionMap(record(source.expenses, "expenses").currencySections, "expenses currencySections");
      const margins = sectionMap(record(source.marginAndCash, "marginAndCash").currencySections, "marginAndCash currencySections");
      const currencies = [...new Set([...settlement.keys(), ...expenses.keys(), ...margins.keys()])].sort();
      const money = currencies.map((currency) => {
        const settlementRow = settlement.get(currency) ?? {}, expenseRow = expenses.get(currency) ?? {}, marginRow = margins.get(currency) ?? {};
        const measures = record(marginRow.measures ?? {}, "margin measures");
        const amount = (name: string) => record(measures[name] ?? {}, name).amount ?? "0.000000";
        return Object.freeze({ currency, settlement: structuredClone(settlementRow), expenses: structuredClone(expenseRow), marginAndCash: Object.freeze({
          expectedMargin: amount("expectedMargin"), committedMargin: amount("committedMargin"),
          actualOperationalMargin: amount("actualOperationalMargin"), cashPosition: amount("cashPosition"),
        }) });
      });
      const allBlockers = ["routes", "documents", "settlement", "expenses", "claims", "closure"].flatMap((family) => blockers(family, source[family as AdapterName]));
      const audit = record(source.audit, "audit");
      return Object.freeze({
        project: Object.freeze({ id: project.id, code: project.code, state: project.state, version: project.version, customerName: project.customerName }),
        quantities: Object.freeze({ supplier: structuredClone(shipments.supplier), sales: structuredClone(shipments.sales) }),
        money: Object.freeze(money), blockers: Object.freeze(allBlockers),
        auditSummary: Object.freeze({ eventCount: audit.eventCount, lastSequenceNo: audit.lastSequenceNo, lastEventHash: audit.lastEventHash, continuityVerified: audit.continuityVerified, href: audit.href }),
      });
    },
  });
}
