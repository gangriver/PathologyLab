import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { PaperActions } from "@/components/paper-actions";
import { Comments } from "@/components/comments";
import { findPaper, listComments } from "@/lib/papers";
import { getPaperStatuses } from "@/lib/types";
import { getPaperSections } from "@/lib/paper-sections";
import { getDocumentInfo } from "@/lib/documents";
import { getLocale } from "@/lib/locale-server";
import { getSiteCopy } from "@/lib/i18n-site";
import { formatPaperTitle } from "@/lib/paper-title";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: getSiteCopy(await getLocale()).common.paperDetails };
}
export default async function PaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [paper, document, comments, locale] = await Promise.all([findPaper(id), getDocumentInfo(id), listComments(id), getLocale()]);
  if (!paper) notFound();
  const copy = getSiteCopy(locale);
  const paperStatuses = getPaperStatuses(locale);
  const paperSections = getPaperSections(locale);
  return <><SiteHeader /><main id="main" className="shell page-shell"><Link href="/papers" className="back-link">← {copy.common.archiveTitle}</Link>
    <header className="detail-header"><span className={"badge " + (paper.status === "discussed" ? "badge-done" : "")}>{paperStatuses[paper.status]}</span><h1>{formatPaperTitle(paper)}</h1><p className="muted">{paper.authors || copy.paper.noAuthors}</p></header>
    <div className="detail-grid"><div><div className="panel">{paperSections.map(({ key, label }) => <section key={key} className="note-section"><h2>{label}</h2><p className={"note-text " + (!paper[key] ? "muted" : "")}>{paper[key] || copy.paper.noNotes}</p></section>)}
      {paper.referenceLinks.length > 0 && <section className="note-section" aria-labelledby="paper-reference-links"><h2 id="paper-reference-links">{copy.paper.referenceLinks}</h2><ul className="reference-links-list">{paper.referenceLinks.map((link, index) => <li key={index}><a className="blue" href={link.url} target="_blank" rel="noopener noreferrer">{link.label} <span aria-hidden="true">↗</span></a></li>)}</ul></section>}
    </div><Comments paperId={id} comments={comments} /></div>
    <aside className="panel"><h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 22 }}>{copy.paper.meetingInformation}</h2><dl className="meeting-details"><div><dt>{copy.paper.meetingDate}</dt><dd>{paper.meetingDate || copy.paper.undecided}</dd></div><div><dt>{copy.paper.presenter}</dt><dd>{paper.presenter || copy.paper.undecided}</dd></div><div><dt>{copy.paper.updatedAt}</dt><dd>{paper.updatedAt.slice(0, 10)}</dd></div></dl>{document && <div className="document-info"><a className="blue" href={"/api/papers/" + id + "/pdf"}>{document.filename} ↓</a><p className="muted">{copy.paper.attachedPdf(document.pageCount)}</p></div>}{paper.url && <a className="button button-secondary full-width" style={{ marginTop: 25 }} href={paper.url} target="_blank" rel="noopener noreferrer">{copy.paper.readOriginal} ↗</a>}<Link href={"/papers/" + id + "/edit"} className="button button-secondary full-width" style={{ marginTop: 15 }}>{copy.paper.attachAndSummarize}</Link><PaperActions id={id} revision={paper.revision} /></aside></div>
  </main></>;
}
