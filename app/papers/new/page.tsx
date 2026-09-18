import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { NewPaperForm } from "@/components/new-paper-form";
import { isCloudStorageEnabled } from "@/lib/cloud-config";
import { getLocale } from "@/lib/locale-server";
import { getSiteCopy } from "@/lib/i18n-site";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: getSiteCopy(await getLocale()).common.addPaper };
}
export default async function NewPaperPage() {
  const copy = getSiteCopy(await getLocale());
  return <><SiteHeader /><main id="main" className="shell page-shell" style={{ maxWidth: 850 }}><Link href="/papers" className="back-link">← {copy.common.archiveTitle}</Link><div className="page-heading"><div><h1>{copy.newPaper.heading}</h1><p>{copy.newPaper.description}</p></div></div><NewPaperForm cloudStorage={isCloudStorageEnabled()} /></main></>;
}
