"use client";

import { DownloadOutlined, FilterFilled, HolderOutlined, SearchOutlined, SettingOutlined } from "@ant-design/icons";
import { Button, Checkbox, DatePicker, Divider, Empty, Grid, Input, InputNumber, Popover, Segmented, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnType, SortOrder } from "antd/es/table/interface";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState, type HTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { downloadXlsx, type Cell } from "../../features/reports/xlsx-export";
import { useOrbDensity } from "../../theme/AntProvider";

/**
 * The one table every ORB list uses (docs/UI-AND-WORKFLOW-STANDARD.md §3): a filter in every column header,
 * quick filters and removable chips, sort, a column menu (show, hide, reorder, density) kept per user and table,
 * global search, group-by with subtotals, a totals row, Excel export of what is shown, row selection with batch
 * actions, rows that open their record, and cards on phones.
 */
export type OrbColumnKind = "text" | "enum" | "date" | "number";
export interface OrbColumn<T> {
  readonly key: string;
  readonly title: string;
  /** What the column means for filtering, sorting, search and export. */
  readonly value: (row: T) => string | number | null;
  readonly render?: (row: T) => ReactNode;
  readonly kind?: OrbColumnKind;
  readonly options?: readonly { readonly value: string; readonly label: string }[];
  readonly width?: number;
  readonly align?: "left" | "right" | "center";
  readonly hiddenByDefault?: boolean;
  readonly locked?: boolean;
  readonly groupable?: boolean;
  readonly exportable?: boolean;
  /** Subtotal for a group of rows (shown on group rows). */
  readonly total?: (rows: readonly T[]) => ReactNode;
  /** Where the column shows on a phone card. */
  readonly mobile?: "title" | "amount" | "meta" | "status" | "action";
}
export interface OrbSummaryRow { readonly key: string; readonly label: ReactNode; readonly cells: Readonly<Record<string, ReactNode>>; readonly testId?: string }

type FilterValue = string | readonly string[] | readonly [string | null, string | null] | readonly [number | null, number | null];
interface GroupRow<T> { readonly __group: string; readonly __rows: readonly T[]; readonly children: readonly T[] }
type Row<T> = T | GroupRow<T>;
const isGroup = <T,>(row: Row<T>): row is GroupRow<T> => typeof row === "object" && row !== null && "__group" in row;

interface Prefs { hidden: string[]; order: string[] }
const prefsKey = (id: string) => `orb.table.${id}`;
function readPrefs(id: string): Prefs | null {
  try { const raw = window.localStorage.getItem(prefsKey(id)); return raw ? JSON.parse(raw) as Prefs : null; } catch { return null; }
}
function writePrefs(id: string, prefs: Prefs) {
  try { window.localStorage.setItem(prefsKey(id), JSON.stringify(prefs)); } catch { /* keep for this visit */ }
}

const INTERACTIVE = "a,button,input,label,select,textarea,.ant-checkbox-wrapper,.ant-dropdown-trigger";

export function OrbTable<T>({ id, locale, rows, rowKey, columns, rowHref, quickFilters, testId, exportName, emptyText, noMatchText, summary, batchActions, extraFilter }: {
  readonly id: string;
  readonly locale: "en" | "ar";
  readonly rows: readonly T[] | null;
  readonly rowKey: (row: T) => string;
  readonly columns: readonly OrbColumn<T>[];
  readonly rowHref?: (row: T) => string | null;
  /** Quick filters above the table; the parent applies them through `extraFilter`. */
  readonly quickFilters?: ReactNode;
  readonly extraFilter?: (row: T) => boolean;
  readonly testId?: string;
  readonly exportName: string;
  readonly emptyText: ReactNode;
  readonly noMatchText: ReactNode;
  readonly summary?: (rows: readonly T[]) => readonly OrbSummaryRow[];
  readonly batchActions?: (selected: readonly T[]) => ReactNode;
}) {
  const ar = locale === "ar", t = (en: string, arabic: string) => (ar ? arabic : en);
  const screens = Grid.useBreakpoint();
  const phone = screens.md === false;
  const { density, setDensity } = useOrbDensity();
  const defaults: Prefs = useMemo(() => ({ hidden: columns.filter((c) => c.hiddenByDefault).map((c) => c.key), order: columns.map((c) => c.key) }), [columns]);
  const [prefs, setPrefs] = useState<Prefs>(defaults);
  useEffect(() => { const saved = readPrefs(id); if (saved) setPrefs({ hidden: saved.hidden, order: [...saved.order.filter((k) => defaults.order.includes(k)), ...defaults.order.filter((k) => !saved.order.includes(k))] }); }, [id, defaults]);
  const savePrefs = (next: Prefs) => { setPrefs(next); writePrefs(id, next); };
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, FilterValue>>({});
  const [groupBy, setGroupBy] = useState<string>("");
  const [selected, setSelected] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const byKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);
  const visible = prefs.order.map((k) => byKey.get(k)).filter((c): c is OrbColumn<T> => !!c && !prefs.hidden.includes(c.key));

  const shown = useMemo(() => (rows ?? []).filter((row) => {
    if (extraFilter && !extraFilter(row)) return false;
    const q = search.trim().toLowerCase();
    if (q && !columns.some((c) => String(c.value(row) ?? "").toLowerCase().includes(q))) return false;
    for (const [key, f] of Object.entries(filters)) {
      const column = byKey.get(key); if (!column) continue;
      const v = column.value(row);
      const kind = column.kind ?? "text";
      if (kind === "text" && typeof f === "string" && f && !String(v ?? "").toLowerCase().includes(f.toLowerCase())) return false;
      if (kind === "enum" && Array.isArray(f) && f.length && !f.includes(String(v ?? ""))) return false;
      if (kind === "date" && Array.isArray(f)) { const [from, to] = f as [string | null, string | null]; const d = String(v ?? ""); if ((from && d < from) || (to && d > to)) return false; }
      if (kind === "number" && Array.isArray(f)) { const [min, max] = f as [number | null, number | null]; const n = Number(v); if ((min !== null && n < min) || (max !== null && n > max)) return false; }
    }
    return true;
  }), [rows, extraFilter, search, filters, columns, byKey]);

  const setFilter = (key: string, value: FilterValue | null) => setFilters((current) => {
    const next = { ...current };
    const empty = value === null || value === "" || (Array.isArray(value) && (value.length === 0 || value.every((x) => x === null || x === "")));
    if (empty) delete next[key]; else next[key] = value;
    return next;
  });
  const describe = (column: OrbColumn<T>, f: FilterValue): string => {
    const kind = column.kind ?? "text";
    if (kind === "enum" && Array.isArray(f)) return (f as string[]).map((v) => column.options?.find((o) => o.value === v)?.label ?? v).join(", ");
    if (kind === "date" && Array.isArray(f)) return `${f[0] ?? "…"} – ${f[1] ?? "…"}`;
    if (kind === "number" && Array.isArray(f)) return `${f[0] ?? "…"} – ${f[1] ?? "…"}`;
    return String(f);
  };

  const dropdown = (column: OrbColumn<T>) => ({ close }: { close: () => void }) => {
    const kind = column.kind ?? "text";
    const f = filters[column.key];
    const body = kind === "enum"
      ? <Select mode="multiple" allowClear showSearch autoFocus style={{ width: 240 }} placeholder={column.title} value={(f as string[] | undefined) ?? []}
          options={(column.options ?? [...new Set((rows ?? []).map((r) => String(column.value(r) ?? "")))].sort().map((v) => ({ value: v, label: v || "—" }))).map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v: string[]) => setFilter(column.key, v)}/>
      : kind === "date"
        ? <DatePicker.RangePicker allowEmpty={[true, true]} value={Array.isArray(f) ? [f[0] ? dayjs(String(f[0])) : null, f[1] ? dayjs(String(f[1])) : null] : null}
            presets={[{ label: t("Last 30 days", "آخر 30 يوم"), value: [dayjs().subtract(30, "day"), dayjs()] }, { label: t("Last 90 days", "آخر 90 يوم"), value: [dayjs().subtract(90, "day"), dayjs()] }, { label: t("This year", "هذه السنة"), value: [dayjs().startOf("year"), dayjs()] }]}
            onChange={(v) => setFilter(column.key, v ? [v[0] ? (v[0] as Dayjs).format("YYYY-MM-DD") : null, v[1] ? (v[1] as Dayjs).format("YYYY-MM-DD") : null] : null)}/>
        : kind === "number"
          ? <Space><InputNumber placeholder={t("From", "من")} value={Array.isArray(f) ? (f[0] as number | null) : null} onChange={(v) => setFilter(column.key, [v as number | null, Array.isArray(f) ? (f[1] as number | null) : null])}/>
              <InputNumber placeholder={t("To", "إلى")} value={Array.isArray(f) ? (f[1] as number | null) : null} onChange={(v) => setFilter(column.key, [Array.isArray(f) ? (f[0] as number | null) : null, v as number | null])}/></Space>
          : <Input autoFocus allowClear placeholder={`${t("Search", "بحث")} ${column.title}`} prefix={<SearchOutlined/>} value={typeof f === "string" ? f : ""} onChange={(e) => setFilter(column.key, e.target.value)} onPressEnter={close} style={{ width: 220 }}/>;
    return <div style={{ padding: 8, display: "grid", gap: 8 }} onKeyDown={(e) => e.stopPropagation()}>
      {body}
      <Space style={{ justifyContent: "space-between", width: "100%" }}>
        <Button size="small" type="link" onClick={() => setFilter(column.key, null)}>{t("Clear", "مسح")}</Button>
        <Button size="small" type="primary" onClick={close}>{t("Done", "تم")}</Button>
      </Space>
    </div>;
  };

  const compare = (column: OrbColumn<T>) => (a: Row<T>, b: Row<T>) => {
    if (isGroup(a) || isGroup(b)) return 0;
    const x = column.value(a), y = column.value(b);
    if (typeof x === "number" && typeof y === "number") return x - y;
    return String(x ?? "").localeCompare(String(y ?? ""));
  };
  const antColumns: ColumnType<Row<T>>[] = visible.map((column, index) => ({
    key: column.key,
    title: column.title,
    width: column.width,
    align: column.align,
    sorter: column.exportable === false ? undefined : compare(column),
    sortDirections: ["ascend", "descend"] as SortOrder[],
    filterDropdown: column.exportable === false ? undefined : dropdown(column),
    filteredValue: filters[column.key] ? ["on"] : null,
    filterIcon: (on: boolean) => <FilterFilled style={{ color: on ? "var(--ant-color-primary)" : undefined }}/>,
    onCell: () => ({ "data-col": column.key } as Record<string, string>),
    render: (_: unknown, row: Row<T>) => {
      if (isGroup(row)) {
        if (index === 0) return <strong>{row.__group || "—"} <Typography.Text type="secondary">({row.__rows.length})</Typography.Text></strong>;
        return column.total ? <strong>{column.total(row.__rows)}</strong> : null;
      }
      return column.render ? column.render(row) : column.value(row);
    },
  }));

  const grouped: Row<T>[] = useMemo(() => {
    const column = groupBy ? byKey.get(groupBy) : undefined;
    if (!column) return [...shown];
    const map = new Map<string, T[]>();
    for (const row of shown) { const k = String(column.value(row) ?? ""); (map.get(k) ?? map.set(k, []).get(k)!).push(row); }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([g, items]) => ({ __group: g, __rows: items, children: items }));
  }, [groupBy, shown, byKey]);

  const exportRows = (list: readonly T[]) => {
    const cols = visible.filter((c) => c.exportable !== false);
    const data: Cell[][] = [cols.map((c) => c.title), ...list.map((row) => cols.map((c) => { const v = c.value(row); return v === null || v === "" ? null : v; }))];
    downloadXlsx(`${exportName}-${dayjs().format("YYYY-MM-DD")}`, exportName.slice(0, 31), data, ar);
  };

  const chips = Object.entries(filters).map(([key, f]) => { const column = byKey.get(key); return column ? <Tag key={key} closable onClose={() => setFilter(key, null)} data-testid={`chip-${key}`}>{column.title}: {describe(column, f)}</Tag> : null; });
  const selectedRows = shown.filter((r) => selected.includes(rowKey(r)));
  const open = (row: Row<T>, event: MouseEvent) => {
    if (isGroup(row) || !rowHref) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    const href = rowHref(row); if (href) window.location.assign(href);
  };

  const columnMenu = <div style={{ width: 240 }} data-testid={`${id}-columns`}>
    <div style={{ display: "grid", gap: 4, maxHeight: 320, overflow: "auto" }}>
      {prefs.order.map((key, i) => { const column = byKey.get(key); if (!column) return null; return <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <HolderOutlined style={{ opacity: .4 }}/>
        <Checkbox checked={!prefs.hidden.includes(key)} disabled={column.locked} onChange={(e) => savePrefs({ ...prefs, hidden: e.target.checked ? prefs.hidden.filter((k) => k !== key) : [...prefs.hidden, key] })} style={{ flex: 1 }}>{column.title}</Checkbox>
        <Button size="small" type="text" disabled={i === 0} aria-label={t(`Move ${column.title} up`, `تحريك ${column.title} لأعلى`)} onClick={() => { const order = [...prefs.order]; [order[i - 1], order[i]] = [order[i], order[i - 1]]; savePrefs({ ...prefs, order }); }}>↑</Button>
        <Button size="small" type="text" disabled={i === prefs.order.length - 1} aria-label={t(`Move ${column.title} down`, `تحريك ${column.title} لأسفل`)} onClick={() => { const order = [...prefs.order]; [order[i + 1], order[i]] = [order[i], order[i + 1]]; savePrefs({ ...prefs, order }); }}>↓</Button>
      </div>; })}
    </div>
    <Divider style={{ margin: "10px 0" }}/>
    <Typography.Text type="secondary">{t("Density", "الكثافة")}</Typography.Text>
    <Segmented block size="small" style={{ marginTop: 6 }} value={density} onChange={(v) => setDensity(v as "compact" | "normal")} options={[{ value: "compact", label: t("Compact", "مضغوط") }, { value: "normal", label: t("Normal", "عادي") }]}/>
    <Button size="small" type="link" style={{ paddingInline: 0, marginTop: 6 }} onClick={() => savePrefs(defaults)}>{t("Reset columns", "إعادة ضبط الأعمدة")}</Button>
  </div>;

  const groupable = columns.filter((c) => c.groupable);
  const mobileFilters = <Space wrap>{visible.filter((c) => c.exportable !== false && (c.kind === "enum" || c.kind === "date")).map((c) => <div key={c.key}>{dropdown(c)({ close: () => setShowFilters(false) })}</div>)}</Space>;

  const toolbar = <div className="orb-table-toolbar">
    <Input allowClear prefix={<SearchOutlined/>} placeholder={t("Search this list", "ابحث في القائمة")} value={search} onChange={(e) => setSearch(e.target.value)} style={phone ? { flex: "1 1 160px", minWidth: 140 } : { width: 280 }} aria-label={t("Search this list", "ابحث في القائمة")}/>
    {quickFilters}
    {phone && <Button onClick={() => setShowFilters(!showFilters)} icon={<FilterFilled/>}>{t("Filters", "فلاتر")}{chips.length ? ` (${chips.length})` : ""}</Button>}
    <span style={{ flex: 1 }}/>
    {!phone && groupable.length > 0 && <Select value={groupBy} onChange={setGroupBy} style={{ minWidth: 170 }} aria-label={t("Group by", "تجميع حسب")}
      options={[{ value: "", label: `${t("Group by", "تجميع حسب")}: ${t("None", "بدون")}` }, ...groupable.map((c) => ({ value: c.key, label: `${t("Group by", "تجميع حسب")}: ${c.title}` }))]}/>}
    <Tooltip title={t("Export to Excel", "تصدير إلى Excel")}><Button icon={<DownloadOutlined/>} onClick={() => exportRows(shown)} aria-label={t("Export to Excel", "تصدير إلى Excel")} disabled={!shown.length}/></Tooltip>
    {!phone && <Popover trigger="click" placement={ar ? "bottomLeft" : "bottomRight"} title={t("Columns", "الأعمدة")} content={columnMenu}>
      <Tooltip title={t("Columns", "الأعمدة")}><Button icon={<SettingOutlined/>} aria-label={t("Columns", "الأعمدة")}/></Tooltip>
    </Popover>}
  </div>;

  const empty = rows !== null && rows.length === 0;
  const summaryRows = summary ? summary(shown) : [];

  return <div className="orb-table" dir={ar ? "rtl" : "ltr"}>
    <style>{TABLE_STYLES}</style>
    {toolbar}
    {phone && showFilters && <div className="orb-table-mobile-filters">{mobileFilters}</div>}
    {(chips.length > 0 || search) && <div className="orb-table-chips">{chips}{search && <Tag closable onClose={() => setSearch("")}>{t("Search", "بحث")}: {search}</Tag>}
      <Button size="small" type="link" onClick={() => { setFilters({}); setSearch(""); }}>{t("Clear filters", "مسح الفلاتر")}</Button></div>}
    {selected.length > 0 && <div className="orb-table-batch" role="group" aria-label={t("Selected rows", "الأسطر المحددة")}>
      <strong>{t(`${selected.length} selected`, `${selected.length} محدد`)}</strong>
      <Space wrap>{batchActions?.(selectedRows)}<Button size="small" icon={<DownloadOutlined/>} onClick={() => exportRows(selectedRows)}>{t("Export", "تصدير")}</Button><Button size="small" type="text" onClick={() => setSelected([])}>{t("Clear", "مسح")}</Button></Space>
    </div>}
    <div data-testid={testId}>
      {rows === null ? <Table<Row<T>> loading columns={antColumns} dataSource={[]} pagination={false} size={density === "compact" ? "small" : "middle"}/>
        : empty ? <Empty description={emptyText}/>
        : shown.length === 0 ? <Empty description={noMatchText}/>
        : phone ? <div className="orb-table-cards">{shown.map((row) => {
            const by = (slot: OrbColumn<T>["mobile"]) => columns.filter((c) => c.mobile === slot);
            const cell = (c: OrbColumn<T>) => <span key={c.key} data-col={c.key}>{c.render ? c.render(row) : c.value(row)}</span>;
            return <div key={rowKey(row)} className="orb-table-card" data-row={rowKey(row)} onClick={(e) => open(row, e)}>
              <div className="r1"><b>{by("title").map(cell)}</b><span className="amt">{by("amount").map(cell)}</span></div>
              <div className="r2"><span className="meta">{by("meta").map(cell)}</span>{by("status").map(cell)}</div>
              {by("action").length > 0 && <div className="r3">{by("action").map(cell)}</div>}
            </div>; })}</div>
        : <Table<Row<T>>
            size={density === "compact" ? "small" : "middle"}
            columns={antColumns}
            dataSource={grouped}
            rowKey={(row) => (isGroup(row) ? `group-${row.__group}` : rowKey(row))}
            scroll={{ x: "max-content" }}
            expandable={groupBy ? { defaultExpandAllRows: true } : { childrenColumnName: "__none" }}
            rowSelection={groupBy ? undefined : { selectedRowKeys: selected, onChange: (keys) => setSelected(keys.map(String)), columnWidth: 36 }}
            pagination={shown.length > 50 ? { pageSize: 50, showSizeChanger: true, showTotal: (n) => t(`${n} records`, `${n} سجل`) } : false}
            onRow={(row) => ({ onClick: (e) => open(row, e), "data-row": isGroup(row) ? undefined : rowKey(row), style: { cursor: rowHref && !isGroup(row) ? "pointer" : undefined } } as HTMLAttributes<HTMLElement>)}
            summary={() => summaryRows.length ? <Table.Summary>{summaryRows.map((s) => <Table.Summary.Row key={s.key} data-testid={s.testId}>
              {!groupBy && <Table.Summary.Cell index={0}/>}
              {visible.map((c, i) => <Table.Summary.Cell key={c.key} index={i + 1} align={c.align}>{i === 0 ? <strong>{s.label}</strong> : s.cells[c.key] !== undefined ? <strong>{s.cells[c.key]}</strong> : null}</Table.Summary.Cell>)}
            </Table.Summary.Row>)}</Table.Summary> : null}
          />}
    </div>
  </div>;
}

const TABLE_STYLES = `
  .orb-table{display:grid;gap:8px;min-inline-size:0;max-inline-size:100%}
  .orb-table>*{min-inline-size:0}
  /* ORB's base styles for plain inputs and table headers must not reach Ant Design controls. */
  .orb-table input,.ant-select-dropdown input,.ant-picker-dropdown input,.ant-table-filter-dropdown input,.ant-popover input{min-block-size:0}
  .orb-table th{text-transform:none;letter-spacing:normal;font-size:inherit}
  .orb-table button:not(.ant-btn){background:none;border:0;padding:0;min-block-size:0;min-inline-size:0;border-radius:0;box-shadow:none}
  /* Dense tables and their pop-ups opt out of the 48px touch-target floor; the cells stay large enough to tap. */
  .orb-table a[href],.orb-table button:not([disabled]),.ant-popover button:not([disabled]),.ant-dropdown button:not([disabled]),.ant-picker-dropdown button:not([disabled]),.ant-table-filter-dropdown button:not([disabled]),.ant-pagination a[href]{min-inline-size:0!important;min-block-size:0!important}
  .orb-table-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .orb-table-chips{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
  .orb-table-batch{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;background:#e8f3f2;border-radius:6px;padding:6px 10px}
  .orb-table-mobile-filters{display:grid;gap:8px;padding:8px;border:1px solid #e6e9ec;border-radius:6px;background:#fff}
  .orb-table .ant-table td{font-variant-numeric:tabular-nums}
  .orb-table .ant-table-row:hover td{transition:background .15s}
  .orb-table-cards{display:grid;gap:6px}
  .orb-table-card{background:#fff;border:1px solid #e6e9ec;border-radius:8px;padding:8px 10px;cursor:pointer;transition:border-color .15s,box-shadow .15s}
  .orb-table-card:active{border-color:var(--ant-color-primary)}
  .orb-table-card .r1,.orb-table-card .r2,.orb-table-card .r3{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
  .orb-table-card .r1 .amt{font-weight:600;font-variant-numeric:tabular-nums}
  .orb-table-card .r2,.orb-table-card .r3{margin-top:4px;font-size:12px}
  .orb-table-card .meta{display:flex;gap:6px;flex-wrap:wrap;color:#5b6670}.orb-table-card .meta>span+span::before{content:"·";margin-inline-end:6px}
`;
