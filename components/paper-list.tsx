"use client";
import Link from "next/link";
import { usePaperFilters } from "@/hooks/use-paper-filters";
import { paperStatuses, type Paper } from "@/lib/types";

export function PaperList({ papers }: { papers: Paper[] }) {
  const { query, status, setQuery, setStatus, filtered } = usePaperFilters(papers);
  return <>
    <div className="toolbar"><input className="search-input" type="search" aria-label="논문 검색" placeholder="논문 제목, 저자, 발표자 검색" value={query} onChange={event => setQuery(event.target.value)} />
      <div className="filters" aria-label="발표 상태 필터"><button className="filter" aria-pressed={status === "all"} onClick={() => setStatus("all")}>전체 {papers.length}</button>{Object.entries(paperStatuses).map(([key, label]) => <button key={key} className="filter" aria-pressed={status === key} onClick={() => setStatus(key as keyof typeof paperStatuses)}>{label}</button>)}</div>
    </div>
    {!filtered.length ? <div className="empty-state"><h2>{papers.length ? "조건에 맞는 논문이 없습니다." : "첫 번째 논문을 함께 읽어볼까요?"}</h2><p>{papers.length ? "검색어나 발표 상태를 바꿔보세요." : "랩미팅에서 나눌 논문을 등록하고 핵심 내용을 정리해보세요."}</p>{!papers.length && <Link className="button" href="/papers/new">첫 논문 등록하기 <span aria-hidden="true">+</span></Link>}</div> :
      <div className="paper-list">{filtered.map(paper => <Link className="paper-row" href={"/papers/" + paper.id} key={paper.id}><span className={"badge " + (paper.status === "discussed" ? "badge-done" : "")}>{paperStatuses[paper.status]}</span><h2>{paper.title}</h2><p className="muted">{paper.authors || "저자 미입력"}</p><div className="paper-meta" style={{ marginTop: 17 }}><span>발표일 {paper.meetingDate || "미정"}</span><span>발표자 {paper.presenter || "미정"}</span></div></Link>)}</div>}
  </>;
}
