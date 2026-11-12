"use client";

type Props = {
  readonly locale: "ar" | "en";
  readonly targetId: string;
  readonly className?: string;
};

export function PrintAction({ locale, targetId, className }: Props) {
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
    {ar ? "طباعة العقد" : "Print contract"}
  </button>;
}
