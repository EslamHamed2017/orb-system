import { ChooseProject } from "../../../ui/features/new/ChooseProject";

type Query = { readonly locale?: string };

export default async function NewInProjectPage({ params, searchParams }: { readonly params: Promise<{ kind: string }>; readonly searchParams: Promise<Query> }) {
  const [{ kind }, query] = await Promise.all([params, searchParams]);
  return <ChooseProject kind={kind} locale={query.locale === "ar" ? "ar" : "en"} />;
}
