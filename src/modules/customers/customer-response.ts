import type { CustomerRecord } from "./customer-service.ts";
export const CUSTOMER_V2_MEDIA_TYPE = "application/vnd.orb.customer+json;version=2";
export type LegacyPublicCustomer = Pick<CustomerRecord, "id" | "reference" | "legalName" | "contactName" | "email" | "phone" | "status" | "version">;
export type PublicCustomer = LegacyPublicCustomer & Pick<CustomerRecord, "legalNameAr" | "countryCode" | "taxRegistrationNumber" | "paymentTermsDays" | "billingAddress">;
export function customerResponseVersion(request: Request): 1 | 2 { return request.headers.get("accept")?.toLowerCase().split(",").map((value) => value.trim()).includes(CUSTOMER_V2_MEDIA_TYPE) ? 2 : 1; }
export function toPublicCustomer(record: CustomerRecord, version: 1): LegacyPublicCustomer;
export function toPublicCustomer(record: CustomerRecord, version?: 2): PublicCustomer;
export function toPublicCustomer(record: CustomerRecord, version: 1 | 2): LegacyPublicCustomer | PublicCustomer;
export function toPublicCustomer(record: CustomerRecord, version: 1 | 2 = 2): LegacyPublicCustomer | PublicCustomer {
  const legacy = { id: record.id, reference: record.reference, legalName: record.legalName, contactName: record.contactName, email: record.email, phone: record.phone, status: record.status, version: record.version };
  return Object.freeze(version === 1 ? legacy : { ...legacy, legalNameAr: record.legalNameAr, countryCode: record.countryCode, taxRegistrationNumber: record.taxRegistrationNumber, paymentTermsDays: record.paymentTermsDays, billingAddress: record.billingAddress });
}
