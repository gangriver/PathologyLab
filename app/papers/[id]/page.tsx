import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { PaperActions } from "@/components/paper-actions";
import { Comments } from "@/components/comments";
import { findPaper, listComments } from "@/lib/papers";
import { paperStatuses } from "@/lib/types";
import { paperSections } from "@/lib/paper-sections";
import { getDocumentInfo } from "@/lib/documents";
export const dynamic = "force-dynamic";
export const metadata = { title: "논문 상세" };
export default async function PaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paper = findPaper(id);
  if (!paper) notFound();
  const document = getDocumentInfo(id);
  return <><SiteHeader /><main id="main" className="shell page-shell"><Link href="/papers" className="back-link">← 논문 아카이브</Link>
    <header className="detail-header"><span className={"badge " + (paper.status === "discussed" ? "badge-done" : "")}>{paperStatuses[paper.status]}</span><h1>{paper.title}</h1><p className="muted">{paper.authors || "저자 미입력"}</p></header>
    <div className="detail-grid"><div><div className="panel">{paperSections.map(({ key, label }) => <section key={key} className="note-section"><h2>{label}</h2><p className={"note-text " + (!paper[key] ? "muted" : "")}>{paper[key] || "아직 정리한 내용이 없습니다."}</p></section>)}</div><Comments paperId={id} comments={listComments(id)} /></div>
    <aside className="panel"><h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 22 }}>랩미팅 정보</h2><dl className="meeting-details"><div><dt>발표일</dt><dd>{paper.meetingDate || "미정"}</dd></div><div><dt>발표자</dt><dd>{paper.presenter || "미정"}</dd></div><div><dt>마지막 수정</dt><dd>{paper.updatedAt.slice(0, 10)}</dd></div></dl>{document && <div className="document-info"><a className="blue" href={"/api/papers/" + id + "/pdf"}>{document.filename} ↓</a><p className="muted">첨부 PDF · {document.pageCount}쪽</p></div>}{paper.url && <a className="button button-secondary full-width" style={{ marginTop: 25 }} href={paper.url} target="_blank" rel="noopener noreferrer">원문 읽기 ↗</a>}<Link href={"/papers/" + id + "/edit"} className="button button-secondary full-width" style={{ marginTop: 15 }}>PDF 첨부·AI 요약</Link><PaperActions id={id} revision={paper.revision} /></aside></div>
  </main></>;
}
