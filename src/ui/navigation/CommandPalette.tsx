"use client";

import { ArrowRightOutlined, PlusOutlined, SearchOutlined, SettingOutlined } from "@ant-design/icons";
import { Input, Modal, Typography } from "antd";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

/** Ctrl+K / ⌘K: jump to any page or start any new transaction by typing (docs/UI-AND-WORKFLOW-STANDARD.md §2). */
export interface PaletteItem { readonly key: string; readonly label: string; readonly group: "go" | "new" | "settings"; readonly href: string; readonly hint?: string }

export function CommandPalette({ open, onClose, items, locale }: { readonly open: boolean; readonly onClose: () => void; readonly items: readonly PaletteItem[]; readonly locale: "en" | "ar" }) {
  const ar = locale === "ar", t = (en: string, arabic: string) => (ar ? arabic : en);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) { setQuery(""); setActive(0); } }, [open]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => `${i.label} ${i.hint ?? ""}`.toLowerCase().includes(q)) : items;
  }, [items, query]);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => { listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);
  const go = (item: PaletteItem | undefined) => { if (item) window.location.assign(item.href); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === "Enter") { e.preventDefault(); go(shown[active]); }
  };
  const groups: [PaletteItem["group"], string][] = [["new", t("Create", "إنشاء")], ["go", t("Go to", "انتقل إلى")], ["settings", t("Settings and lists", "الإعدادات والقوائم")]];
  const icon = { new: <PlusOutlined/>, go: <ArrowRightOutlined/>, settings: <SettingOutlined/> } as const;
  let index = -1;
  return <Modal open={open} onCancel={onClose} footer={null} closable={false} width={560} styles={{ body: { padding: 0 } }} destroyOnHidden
    title={null} aria-label={t("Command palette", "لوحة الأوامر")} className="orb-palette">
    <div dir={ar ? "rtl" : "ltr"}>
      <Input autoFocus size="large" variant="borderless" prefix={<SearchOutlined/>} placeholder={t("Type a page or an action… (e.g. invoice, expense, customers)", "اكتب صفحة أو إجراء… (مثلاً فاتورة، مصروف، العملاء)")}
        value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} style={{ padding: "12px 16px" }} aria-label={t("Search ORB", "البحث في ORB")}/>
      <div ref={listRef} role="listbox" aria-label={t("Results", "النتائج")} style={{ maxHeight: 380, overflowY: "auto", borderTop: "1px solid #eef0f2", padding: 6 }}>
        {shown.length === 0 && <Typography.Text type="secondary" style={{ display: "block", padding: 16 }}>{t("Nothing matches.", "لا توجد نتائج.")}</Typography.Text>}
        {groups.map(([group, title]) => {
          const list = shown.filter((i) => i.group === group);
          if (!list.length) return null;
          return <div key={group}>
            <div style={{ fontSize: 11, color: "#6b7680", padding: "8px 10px 4px", textTransform: "uppercase", letterSpacing: ".05em" }}>{title}</div>
            {list.map((item) => { index += 1; const i = index; return <div key={item.key} role="option" aria-selected={i === active} data-index={i}
              onMouseEnter={() => setActive(i)} onClick={() => go(item)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 6, cursor: "pointer", background: i === active ? "#e8f3f2" : undefined }}>
              <span style={{ color: "#0b6e69" }}>{icon[item.group]}</span><span style={{ flex: 1 }}>{item.label}</span>{item.hint && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.hint}</Typography.Text>}
            </div>; })}
          </div>;
        })}
      </div>
      <div style={{ borderTop: "1px solid #eef0f2", padding: "6px 12px", fontSize: 12, color: "#6b7680" }}>↑ ↓ {t("to move", "للتنقل")} · Enter {t("to open", "للفتح")} · Esc {t("to close", "للإغلاق")}</div>
    </div>
  </Modal>;
}
