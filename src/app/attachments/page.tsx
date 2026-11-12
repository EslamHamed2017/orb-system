import { AttachmentsIndexPage, isAttachmentSubjectType, isAttachmentVerificationState } from "../../ui/features/evidence/AttachmentsIndexPage";

type Query = { readonly locale?:string; readonly projectId?:string; readonly subjectType?:string; readonly verificationState?:string; readonly q?:string };
export default async function AttachmentsPage({searchParams}:{readonly searchParams:Promise<Query>}){
  const query=await searchParams;
  const locale=query.locale==="ar"?"ar":"en";
  return <AttachmentsIndexPage locale={locale} filters={{
    ...(query.projectId?.trim()?{projectId:query.projectId}:{}),
    ...(isAttachmentSubjectType(query.subjectType)?{subjectType:query.subjectType}:{}),
    ...(isAttachmentVerificationState(query.verificationState)?{verificationState:query.verificationState}:{}),
    ...(query.q?.trim()?{query:query.q}:{}),
  }}/>;
}
