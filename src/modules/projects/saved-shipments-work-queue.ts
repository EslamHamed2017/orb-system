import type { ProjectRecord } from "./daily-projects";

export type ShipmentQueueFact = Readonly<{ reference: string; date: string; quantity: string }>;
export type ShipmentQueueRow = Readonly<{
  id: string;
  code: string;
  customer: string;
  supplier: string | null;
  contractedQuantity: string;
  supplierShipment: ShipmentQueueFact | null;
  customerShipment: ShipmentQueueFact | null;
  stage: string;
  group: "needs-action" | "recorded" | "closed";
  action: Readonly<{ label: string; href: string }>;
}>;

function shipmentState(project: ProjectRecord, locale: "ar" | "en"): Pick<ShipmentQueueRow, "stage" | "group" | "action"> {
  const ar = locale === "ar";
  const overview = `/projects/${encodeURIComponent(project.id)}/overview`;
  if (project.status === "CLOSED") return {
    stage: ar ? "المشروع مغلق" : "Project closed",
    group: "closed",
    action: { label: ar ? "عرض المشروع المغلق" : "View closed project", href: `${overview}#lifecycle` },
  };
  if (project.status === "SETUP") return {
    stage: ar ? "يلزم إكمال إعداد المشروع" : "Project setup required",
    group: "needs-action",
    action: { label: ar ? "إكمال إعداد المشروع" : "Complete project setup", href: `${overview}#project-data` },
  };
  if (project.closure?.reopenedAt && !project.closure.reopenReviewedAt) return {
    stage: ar ? "العمل بعد إعادة الفتح يحتاج إلى مراجعة" : "Reopened work requires review",
    group: "needs-action",
    action: { label: ar ? "مراجعة العمل بعد إعادة الفتح" : "Review reopened work", href: `/projects/${encodeURIComponent(project.id)}/closure` },
  };
  if (!project.supplierShipment) return {
    stage: ar ? "تفاصيل شحنة المورد غير مسجلة" : "Supplier shipment details not recorded",
    group: "needs-action",
    action: { label: ar ? "تسجيل شحنة المورد" : "Record supplier shipment", href: `${overview}#supplier-shipment` },
  };
  if (!project.customerShipment) return {
    stage: ar ? "تم تسجيل تفاصيل شحنة المورد" : "Supplier shipment details recorded",
    group: "needs-action",
    action: { label: ar ? "تسجيل شحنة العميل" : "Record customer shipment", href: `${overview}#customer-shipment` },
  };
  if (!project.customerShipmentReviewedAt) return {
    stage: ar ? "تم تسجيل تفاصيل شحنة العميل" : "Customer shipment details recorded",
    group: "needs-action",
    action: { label: ar ? "مراجعة تفاصيل شحنة العميل" : "Review customer shipment details", href: `${overview}#customer-shipment` },
  };
  return {
    stage: ar ? "تم تسجيل مراجعة تسليم الشحنة" : "Shipment handover review recorded",
    group: "recorded",
    action: { label: ar ? "عرض الشحنات المسجلة" : "View recorded shipments", href: `${overview}#customer-shipment` },
  };
}

export function shipmentQueueRows(projects: readonly ProjectRecord[], locale: "ar" | "en"): ShipmentQueueRow[] {
  const groupOrder = { "needs-action": 0, recorded: 1, closed: 2 } as const;
  return projects.map((project, index) => ({ row: ({
    id: project.id,
    code: project.code,
    customer: project.customer,
    supplier: project.supplier ?? null,
    contractedQuantity: `${project.quantity} ${project.unit}`,
    supplierShipment: project.supplierShipment ? {
      reference: project.supplierShipment.reference,
      date: project.supplierShipment.expectedArrival,
      quantity: `${project.supplierShipment.quantity} ${project.unit}`,
    } : null,
    customerShipment: project.customerShipment ? {
      reference: project.customerShipment.reference,
      date: project.customerShipment.plannedDispatchDate,
      quantity: `${project.customerShipment.quantity} ${project.unit}`,
    } : null,
    ...shipmentState(project, locale),
  }), index })).sort((left, right) => groupOrder[left.row.group] - groupOrder[right.row.group] || left.index - right.index).map(({ row }) => row);
}

export function shipmentQueueHref(href: string, locale: "ar" | "en", role?: string): string {
  const [path, hash] = href.split("#");
  const query = new URLSearchParams({ locale });
  if (role) query.set("role", role);
  return `${path}?${query.toString()}${hash ? `#${hash}` : ""}`;
}
