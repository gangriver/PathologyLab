import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { NewPaperForm } from "@/components/new-paper-form";
import { isCloudStorageEnabled } from "@/lib/cloud-config";
export const dynamic = "force-dynamic";
export const metadata = { title: "논문 등록" };
export default function NewPaperPage() {
  return <><SiteHeader /><main id="main" className="shell page-shell" style={{ maxWidth: 850 }}><Link href="/papers" className="back-link">← 논문 아카이브</Link><div className="page-heading"><div><h1>새 논문 등록</h1><p>PDF로 기본 정보를 자동 입력하거나 직접 입력할 수 있습니다. 등록 방식을 선택해주세요.</p></div></div><NewPaperForm cloudStorage={isCloudStorageEnabled()} /></main></>;
}
