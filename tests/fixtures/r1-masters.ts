import { R1_SECURITY_IDS } from "./r1-security-users.ts";
export const R1_MASTER_IDS = Object.freeze({
  customer:"00000000-0000-7000-8000-000000000101",supplier:"00000000-0000-7000-8000-000000000102",vendor:"00000000-0000-7000-8000-000000000103",
  coffee:"00000000-0000-7000-8000-000000000111",usd:"00000000-0000-7000-8000-000000000121",aed:"00000000-0000-7000-8000-000000000122",expenseCategory:"00000000-0000-7000-8000-000000000131",
});
export const R1_CURRENCIES=Object.freeze([{id:R1_MASTER_IDS.usd,code:"USD",decimals:2,active:true},{id:R1_MASTER_IDS.aed,code:"AED",decimals:2,active:true}]);
export const R1_PARTIES=Object.freeze([
 {id:R1_MASTER_IDS.customer,reference:"R1-CUSTOMER",legal_name_ar:"عميل الإصدار التجريبي",legal_name_en:"R1 Customer",country_code:"AE",customer:true,supplier:false,sensitive_identity_ciphertext:null,status:"ACTIVE",version:1},
 {id:R1_MASTER_IDS.supplier,reference:"R1-SUPPLIER",legal_name_ar:"مورد الإصدار التجريبي",legal_name_en:"R1 Supplier",country_code:"ET",customer:false,supplier:true,sensitive_identity_ciphertext:null,status:"ACTIVE",version:1},
 {id:R1_MASTER_IDS.vendor,reference:"R1-VENDOR",legal_name_ar:"بائع الإصدار التجريبي",legal_name_en:"R1 Expense Vendor",country_code:"AE",customer:false,supplier:true,sensitive_identity_ciphertext:null,status:"ACTIVE",version:1},
]);
export const R1_COFFEE_SPECIFICATIONS=Object.freeze([{id:R1_MASTER_IDS.coffee,tenant_id:R1_SECURITY_IDS.tenant,reference:"R1-ETH-GRADE1-2026",name_en:"Ethiopia Grade 1",name_ar:"إثيوبيا الدرجة الأولى",origin:"ET",type:"Arabica",grade:"Grade 1",crop_year:"2026",bag_type:"JUTE",standard_bag_weight:"60.000000",attributes:{screen:"15+",process:"washed"},version:1}]);
export const R1_EXPENSE_CATEGORIES=Object.freeze([{id:R1_MASTER_IDS.expenseCategory,code:"R1-FREIGHT",name_ar:"شحن",name_en:"Freight",active:true}]);
