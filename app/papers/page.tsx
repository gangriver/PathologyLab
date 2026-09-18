import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PaperList } from "@/components/paper-list";
import { listPapers } from "@/lib/papers";
export const dynamic = "force-dynamic";
export const metadata = { title: "논문 아카이브" };
export default function PapersPage() {
  const papers = listPapers();
  return <><SiteHeader /><main id="main" className="shell page-shell"><div className="page-heading"><div><div className="section-eyebrow">누구나 함께하는 연구 기록</div><h1>논문 아카이브</h1><p>함께 읽은 논문과 랩미팅에서 나눈 생각을 모읍니다.</p></div><Link className="button" href="/papers/new">논문 등록 <span aria-hidden="true">+</span></Link></div><PaperList papers={papers} /></main></>;
}
