import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { PaperForm } from "@/components/paper-form";
import { findPaper } from "@/lib/papers";
import { getDocumentInfo } from "@/lib/documents";
import { isSummaryConfigured } from "@/lib/paper-summary";
import { isCloudStorageEnabled } from "@/lib/cloud-config";
import { getLocale } from "@/lib/locale-server";
import { getSiteCopy } from "@/lib/i18n-site";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: getSiteCopy(await getLocale()).editPaper.title };
}
export default async function EditPaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [paper, document, locale] = await Promise.all([findPaper(id), getDocumentInfo(id), getLocale()]);
  if (!paper) notFound();
  const copy = getSiteCopy(locale);
  return <><SiteHeader /><main id="main" className="shell page-shell" style={{ maxWidth: 850 }}><Link href={"/papers/" + id} className="back-link">← {copy.common.paperDetails}</Link><div className="page-heading"><div><h1>{copy.editPaper.heading}</h1><p>{copy.editPaper.description}</p></div></div><PaperForm key={paper.id} paper={paper} defaultPresenter="" cloudStorage={isCloudStorageEnabled()} document={document} summaryConfigured={isSummaryConfigured()} /></main></>;
}
