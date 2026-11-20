"use client";

import { useCallback, useEffect, useState } from "react";
import { sendJson, type ApiProblem } from "../../session-client";

type Locale = "en" | "ar";
interface ContractRow { id: string; reference: string; state: string; kind: "SALES" | "PURCHASE"; counterparty: string }

const STATE: Record<string, [string, string, string]> = {
  DRAFT: ["Draft — not confirmed yet", "مسودة — لم يُؤكد بعد", "warning"],
  PENDING_APPROVAL: ["Draft — not confirmed yet", "مسودة — لم يُؤكد بعد", "warning"],
  APPROVED: ["Confirmed", "مؤكد", "success"],
  REJECTED: ["Rejected", "مرفوض", "error"],
};

/**
 * Shipments can only be created against a confirmed contract. This strip shows each contract's state on the
 * project's shipment page and lets operations confirm a draft — there is no approval step.
 */
export function ContractApprovalStrip({ projectId, locale }: { readonly projectId: string; readonly locale: Locale }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [rows, setRows] = useState<ContractRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
    if (!response.ok) return;
    const project = await response.json() as {
      customer?: { legalName: string; legalNameAr?: string | null };
      salesContract?: { id: string; reference: string; state: string } | null;
      purchaseContracts?: { id: string; reference: string; state: string; supplier: { registeredName: string; displayNameAr?: string | null } }[];
    };
    const next: ContractRow[] = [];
    if (project.salesContract) next.push({ id: project.salesContract.id, reference: project.salesContract.reference, state: project.salesContract.state, kind: "SALES", counterparty: (ar && project.customer?.legalNameAr) || project.customer?.legalName || "" });
    for (const contract of project.purchaseContracts ?? []) next.push({ id: contract.id, reference: contract.reference, state: contract.state, kind: "PURCHASE", counterparty: (ar && contract.supplier.displayNameAr) || contract.supplier.registeredName });
    setRows(next);
  }, [ar, projectId]);
  useEffect(() => { void load(); }, [load]);

  async function submit(contract: ContractRow) {
    setBusy(contract.id); setMessage(null);
    try {
      await sendJson(`/api/contracts/${contract.id}/submit`, "POST", {});
      setMessage({ tone: "success", text: t(`${contract.reference} is confirmed.`, `تم تأكيد ${contract.reference}.`) });
      await load();
    } catch (error) {
      setMessage({ tone: "error", text: (error as ApiProblem).detail ?? t("The contract could not be confirmed.", "تعذر تأكيد العقد.") });
    } finally { setBusy(null); }
  }

  if (!rows || rows.length === 0) return null;
  const blocked = rows.some((row) => row.state !== "APPROVED");
  return <section className="orb-contract-strip" dir={ar ? "rtl" : "ltr"} aria-labelledby="contract-strip-title" style={{ border: "1px solid var(--orb-color-outline-variant)", borderRadius: 16, padding: 16, marginBlock: 12 }}>
    <h2 id="contract-strip-title" style={{ fontSize: "1rem", margin: "0 0 4px" }}>{t("Contracts", "العقود")}</h2>
    {blocked && <p className="orb-muted" style={{ margin: "0 0 10px" }}>{t("A shipment can only be created against a confirmed contract.", "لا يمكن إنشاء شحنة إلا على عقد مؤكد.")}</p>}
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      {rows.map((row) => { const state = STATE[row.state] ?? [row.state, row.state, "warning"]; return <li key={row.id} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <span><strong><bdi>{row.reference}</bdi></strong> · {row.kind === "SALES" ? t("Sales", "بيع") : t("Purchase", "شراء")} · {row.counterparty}</span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="orb-chip" data-tone={state[2]}>{state[ar ? 1 : 0]}</span>
          {(row.state === "DRAFT" || row.state === "PENDING_APPROVAL") && <button type="button" className="orb-button-filled" data-operation-id="submitContractForApproval" disabled={busy === row.id} onClick={() => void submit(row)}>{t("Confirm contract", "تأكيد العقد")}</button>}
        </span>
      </li>; })}
    </ul>
    {message && <p role={message.tone === "error" ? "alert" : "status"} style={{ marginBlockEnd: 0 }}>{message.text}</p>}
  </section>;
}
