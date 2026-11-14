import { SavedProjectsToday } from "../ui/features/dashboard/SavedProjectsToday";
export default async function TodayPage({searchParams}:{searchParams:Promise<{locale?:string}>}){const query=await searchParams,locale=query.locale==="ar"?"ar":"en";return <SavedProjectsToday locale={locale}/>}
