import type { SupplierRecord } from "./supplier-service.ts";
export type PublicSupplier = Pick<SupplierRecord, "id"|"reference"|"registeredName"|"displayNameAr"|"countryCode"|"contactName"|"email"|"phone"|"paymentCurrency"|"paymentTermsDays"|"status"|"version">;
export function toPublicSupplier(record: SupplierRecord): PublicSupplier {
 return Object.freeze({id:record.id,reference:record.reference,registeredName:record.registeredName,displayNameAr:record.displayNameAr,countryCode:record.countryCode,contactName:record.contactName,email:record.email,phone:record.phone,paymentCurrency:record.paymentCurrency,paymentTermsDays:record.paymentTermsDays,status:record.status,version:record.version});
}
