import { ProjectTransactionsPage } from "../../../../ui/features/projects/ProjectTransactionsPage";
import type { ProjectTransactionType } from "../../../../ui/features/projects/project-transactions";
const TYPES=new Set(["SALES_CONTRACT","PURCHASE_CONTRACT","SUPPLIER_SHIPMENT","SALES_SHIPMENT","CUSTOMER_COMMERCIAL_INVOICE","SUPPLIER_COMMERCIAL_INVOICE","COLLECTION","SUPPLIER_PAYMENT","EXPENSE"]);
type Query={locale?:string;type?:string;status?:string;q?:string};
export default async function ProjectTransactionsRoute({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Query>}){const [{id},q]=await Promise.all([params,searchParams]);const type=TYPES.has(q.type??"")?q.type as ProjectTransactionType:"ALL";return <ProjectTransactionsPage locale={q.locale==="ar"?"ar":"en"} projectId={id} type={type} status={q.status?.trim()||"ALL"} query={q.q??""}/>;}
