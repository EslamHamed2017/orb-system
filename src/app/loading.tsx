import { AsyncState } from "../ui/components/AsyncState";
import { en } from "../ui/i18n/en";

export default function Loading() {
  return <AsyncState state="loading" copy={en} />;
}
