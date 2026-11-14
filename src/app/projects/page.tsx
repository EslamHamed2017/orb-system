import { ProjectsRegister } from "../../ui/features/projects/ProjectsRegister";
export default async function ProjectsPage({searchParams}:{searchParams:Promise<{locale?:string}>}){const query=await searchParams,locale=query.locale==="ar"?"ar":"en";return <ProjectsRegister locale={locale}/>}
