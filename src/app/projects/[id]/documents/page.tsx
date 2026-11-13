import { AttachmentsIndexPage } from "../../../../ui/features/evidence/AttachmentsIndexPage";
import { ProjectContextNavigation } from "../../../../ui/navigation/ProjectContextNavigation";
type Query={readonly locale?:string;readonly subjectType?:string;readonly verificationState?:string;readonly q?:string};
export default async function ProjectDocumentsPage({params,searchParams}:{readonly params:Promise<{id:string}>;readonly searchParams:Promise<Query>}){const [{id},query]=await Promise.all([params,searchParams]);const locale=query.locale==="ar"?"ar":"en";return <><ProjectContextNavigation locale={locale} projectId={id} current="documents"/><AttachmentsIndexPage locale={locale} filters={{projectId: id,...(query.q?.trim()?{query:query.q}:{})}}/></>;}
