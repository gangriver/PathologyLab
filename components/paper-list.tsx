"use client";
import Link from "next/link";
import { useLocale } from "@/hooks/use-locale";
import { usePaperFilters } from "@/hooks/use-paper-filters";
import { formatArchiveDate, getArchiveMessages } from "@/lib/i18n-archive";
import { getPaperStatuses, type Paper, type PaperStatus } from "@/lib/types";
import { formatPaperTitle } from "@/lib/paper-title";

export function PaperList({ papers }: { papers: Paper[] }) {
  const { locale } = useLocale();
  const messages = getArchiveMessages(locale);
  const paperStatuses = getPaperStatuses(locale);
  const { query, status, presenter, presenters, setQuery, setStatus, setPresenter, filtered } = usePaperFilters(papers);
  return <>
    <div className="toolbar"><input className="search-input" type="search" aria-label={messages.searchLabel} placeholder={messages.searchPlaceholder} value={query} onChange={event => setQuery(event.target.value)} />
      <div className="filters" aria-label={messages.statusFilterLabel}><button className="filter" aria-pressed={status === "all"} onClick={() => setStatus("all")}>{messages.all} {papers.length}</button>{Object.entries(paperStatuses).map(([key, label]) => <button key={key} className="filter" aria-pressed={status === key} onClick={() => setStatus(key as PaperStatus)}>{label}</button>)}</div>
      {presenters.length > 0 && <div className="filters" role="group" aria-label={messages.presenterFilterLabel}><button className="filter" aria-pressed={presenter === null} onClick={() => setPresenter(null)}>{messages.allPresenters}</button>{presenters.map(name => <button key={name} className="filter" aria-pressed={presenter === name} onClick={() => setPresenter(name)}>{name}</button>)}</div>}
    </div>
    {!filtered.length ? <div className="empty-state"><h2>{papers.length ? messages.noMatchesTitle : messages.emptyTitle}</h2><p>{papers.length ? messages.noMatchesDescription : messages.emptyDescription}</p>{!papers.length && <Link className="button" href="/papers/new">{messages.addFirstPaper} <span aria-hidden="true">+</span></Link>}</div> :
      <div className="paper-list">{filtered.map(paper => <Link className="paper-row" href={"/papers/" + paper.id} key={paper.id}><span className={"badge " + (paper.status === "discussed" ? "badge-done" : "")}>{paperStatuses[paper.status]}</span><h2>{formatPaperTitle(paper)}</h2><p className="muted">{paper.authors || messages.missingAuthors}</p><div className="paper-meta" style={{ marginTop: 17 }}><span>{messages.presentationDate} {paper.meetingDate ? formatArchiveDate(paper.meetingDate, locale) : messages.undecided}</span><span>{messages.presenter} {paper.presenter || messages.undecided}</span></div></Link>)}</div>}
  </>;
}
