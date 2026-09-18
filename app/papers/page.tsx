import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PaperList } from "@/components/paper-list";
import { listPapers } from "@/lib/papers";
import { getLocale } from "@/lib/locale-server";
import { getSiteCopy } from "@/lib/i18n-site";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: getSiteCopy(await getLocale()).common.archiveTitle };
}
export default async function PapersPage() {
  const [papers, locale] = await Promise.all([listPapers(), getLocale()]);
  const copy = getSiteCopy(locale);
  return <><SiteHeader /><main id="main" className="shell page-shell"><div className="page-heading"><div><div className="section-eyebrow">{copy.common.archiveEyebrow}</div><h1>{copy.common.archiveTitle}</h1><p>{copy.papers.description}</p></div><Link className="button" href="/papers/new">{copy.common.addPaper} <span aria-hidden="true">+</span></Link></div><PaperList papers={papers} /></main></>;
}
