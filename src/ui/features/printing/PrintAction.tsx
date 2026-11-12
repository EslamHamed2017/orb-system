"use client";

type PrintDocumentKind = "contract" | "shipment" | "container";

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
