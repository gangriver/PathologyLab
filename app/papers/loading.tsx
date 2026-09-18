import { getLocale } from "@/lib/locale-server";
import { getSiteCopy } from "@/lib/i18n-site";

export default async function Loading() {
  const copy = getSiteCopy(await getLocale());
  return <main id="main" className="shell page-shell" aria-busy="true"><p role="status">{copy.papers.loading}</p></main>;
}
