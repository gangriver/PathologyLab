import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { PaperForm } from "@/components/paper-form";
import { findPaper } from "@/lib/papers";
import { getDocumentInfo } from "@/lib/documents";
import { isSummaryConfigured } from "@/lib/paper-summary";
import { isCloudStorageEnabled } from "@/lib/cloud-config";
export const dynamic = "force-dynamic";
export const metadata = { title: "논문 수정" };
export default async function EditPaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [paper, document] = await Promise.all([findPaper(id), getDocumentInfo(id)]);
  if (!paper) notFound();
  return <><SiteHeader /><main id="main" className="shell page-shell" style={{ maxWidth: 850 }}><Link href={"/papers/" + id} className="back-link">← 논문 상세</Link><div className="page-heading"><div><h1>논문 정리 수정</h1><p>핵심 내용과 발표 기록을 업데이트해주세요.</p></div></div><PaperForm key={paper.id + ":" + paper.revision} paper={paper} defaultPresenter="" cloudStorage={isCloudStorageEnabled()} document={document} summaryConfigured={isSummaryConfigured()} /></main></>;
}
