import Link from "next/link";
import { getLocale } from "@/lib/locale-server";
import { getSiteCopy } from "@/lib/i18n-site";

export default async function NotFound() {
  const copy = getSiteCopy(await getLocale());
  return <main id="main" className="shell page-shell"><div className="empty-state"><h1>{copy.notFound.heading}</h1><p>{copy.notFound.description}</p><Link href="/" className="button">{copy.notFound.backHome}</Link></div></main>;
}
