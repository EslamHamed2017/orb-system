"use client";

type PrintDocumentKind = "contract" | "shipment" | "container" | "salesInvoice" | "supplierInvoice" | "collection" | "supplierPayment" | "expense";

type Props = {
  readonly locale: "ar" | "en";
  readonly targetId: string;
  readonly className?: string;
  readonly documentKind?: PrintDocumentKind;
};

const labels: Record<PrintDocumentKind, Readonly<{ en: string; ar: string }>> = {
  contract: { en: "Print contract", ar: "طباعة العقد" },
  shipment: { en: "Print shipment", ar: "طباعة الشحنة" },
  container: { en: "Print container", ar: "طباعة الحاوية" },
  salesInvoice: { en: "Print customer invoice", ar: "طباعة فاتورة العميل" },
  supplierInvoice: { en: "Print supplier invoice", ar: "طباعة فاتورة المورد" },
  collection: { en: "Print collection", ar: "طباعة التحصيل" },
  supplierPayment: { en: "Print supplier payment", ar: "طباعة دفعة المورد" },
  expense: { en: "Print expense", ar: "طباعة المصروف" },
};

export function PrintAction({ locale, targetId, className, documentKind = "contract" }: Props) {
  const ar = locale === "ar";

  function printTarget() {
    const target = document.getElementById(targetId);
    if (!target) return;

    const cleanup = () => {
      target.classList.remove("orb-print-selected");
      document.body.classList.remove("orb-printing");
    };

    target.classList.add("orb-print-selected");
    document.body.classList.add("orb-printing");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  }

  return <button type="button" className={className} onClick={printTarget} aria-controls={targetId} data-print-action>
    {labels[documentKind][ar ? "ar" : "en"]}
  </button>;
}
