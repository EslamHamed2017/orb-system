import {SupplierDetailPage} from "../../../ui/features/masters/SupplierDetailPage";
type Query={locale?:string;role?:string};
export default async function SupplierPage({params,searchParams}:{params:Promise<{supplierId:string}>;searchParams:Promise<Query>}){const [{supplierId},query]=await Promise.all([params,searchParams]);return <SupplierDetailPage locale={query.locale==="ar"?"ar":"en"} supplierId={supplierId} role={query.role}/>}
