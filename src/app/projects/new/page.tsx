import { NewProjectForm } from "../../../ui/features/projects/NewProjectForm";
export default async function NewProjectPage({searchParams}:{searchParams:Promise<{locale?:string}>}){const query=await searchParams,locale=query.locale==="ar"?"ar":"en";return <NewProjectForm locale={locale}/>}
