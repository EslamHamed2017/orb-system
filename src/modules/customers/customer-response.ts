import type { CustomerRecord } from "./customer-service.ts";

export type PublicCustomer = Pick<CustomerRecord, "id" | "reference" | "legalName" | "contactName" | "email" | "phone" | "status" | "version">;

export function toPublicCustomer(record: CustomerRecord): PublicCustomer {
  return Object.freeze({
    id: record.id, reference: record.reference, legalName: record.legalName, contactName: record.contactName,
    email: record.email, phone: record.phone, status: record.status, version: record.version,
  });
}
