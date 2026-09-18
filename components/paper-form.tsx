"use client";
import Link from "next/link";
import { usePaperForm } from "@/hooks/use-paper-form";
import { paperStatuses, type Paper } from "@/lib/types";
import { paperSections } from "@/lib/paper-sections";
import { PDF_LIMITS, type PaperDocumentInfo } from "@/lib/document-types";
import { SummaryDraft } from "./summary-draft";

export function PaperForm({ paper, defaultPresenter, cloudStorage, document, summaryConfigured = false, onPendingChange }: { paper?: Paper; defaultPresenter: string; cloudStorage: boolean; document?: PaperDocumentInfo; summaryConfigured?: boolean; onPendingChange?: (pending: boolean) => void }) {
  const { values, setField, pending, error, notice, operation, submit, attachment, draft, upload, removeDocument, summarize, applyDraft } = usePaperForm(defaultPresenter, cloudStorage, paper, document, onPendingChange);
  return <form className="panel" onSubmit={submit}>
    {paper && <section className="document-panel">
      <h2>원문 PDF와 기본 정보</h2>
      {attachment && <div className="document-info"><a className="blue" href={"/api/papers/" + paper.id + "/pdf"}>{attachment.filename} ↓</a><p className="muted">{attachment.pageCount}쪽 · {(attachment.byteLength / 1024 / 1024).toFixed(2)}MB · 본문 {attachment.textCharacters.toLocaleString("ko-KR")}자 추출</p></div>}
      <label className="field">{attachment ? "PDF 교체" : "PDF 첨부"}<input type="file" accept=".pdf,application/pdf" onChange={upload} disabled={pending} /><small>선택한 PDF는 바로 저장됩니다. 최대 {PDF_LIMITS.maxBytes / 1024 / 1024}MB · {PDF_LIMITS.maxPages}쪽. 추출한 제목·저자·DOI 링크는 빈 입력란에만 채우며, 수정 내용은 별도로 저장해주세요.</small></label>
      {attachment && <>
        <p className="form-note">자동 입력된 기본 정보는 원문과 비교해 확인해주세요. 스캔 PDF나 정보가 부족한 파일은 직접 입력해야 할 수 있습니다.</p>
        {attachment.textCharacters < 100 && <p className="form-note">본문을 충분히 추출하지 못했습니다. 스캔 PDF는 직접 정리하거나 텍스트를 선택할 수 있는 PDF로 교체해주세요.</p>}
        {!summaryConfigured && <p className="form-note">AI 요약 연결 대기 중입니다. 관리자 설정이 완료되면 사용할 수 있습니다.</p>}
        <p className="form-note">초안 생성을 누르면 추출된 본문을 OpenAI에 보내 요약합니다. 그림과 표의 해석, 근거 페이지는 원문과 비교해주세요.</p>
        <div className="document-actions"><button type="button" className="button button-secondary" onClick={summarize} disabled={pending || !summaryConfigured || attachment.textCharacters < 100}>AI 요약 초안 생성</button><button type="button" className="text-button" onClick={removeDocument} disabled={pending}>PDF 삭제</button></div>
      </>}
      {draft && <SummaryDraft draft={draft} apply={applyDraft} disabled={pending} />}
    </section>}
    {pending && <p role="status" className="form-note">{operation}</p>}
    {notice && <p role="status" className="alert alert-success">{notice}</p>}
    {error && <div role="alert" className="alert alert-error">{error}</div>}
    <fieldset disabled={pending} className="paper-fields">
      <label className="field">논문 제목 <span className="muted">필수</span><input name="title" required maxLength={500} value={values.title} onChange={event => setField("title", event.target.value)} placeholder="논문의 원문 제목을 입력해주세요" /></label>
      <div className="form-grid"><label className="field">저자<input name="authors" maxLength={500} value={values.authors} onChange={event => setField("authors", event.target.value)} placeholder="저자 이름" /></label><label className="field">원문 링크<input type="url" name="url" maxLength={2000} value={values.url} onChange={event => setField("url", event.target.value)} placeholder="https://" /></label></div>
      <div className="form-grid"><label className="field">발표일<input type="date" name="meetingDate" value={values.meetingDate} onChange={event => setField("meetingDate", event.target.value)} /></label><label className="field">발표자<input name="presenter" maxLength={100} value={values.presenter} onChange={event => setField("presenter", event.target.value)} /></label></div>
      <label className="field">발표 상태<select name="status" value={values.status} onChange={event => setField("status", event.target.value as Paper["status"])}>{Object.entries(paperStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {paperSections.map(({ key, label, placeholder }) => <label className="field" key={key}>{label}<textarea name={key} rows={5} maxLength={12000} value={values[key]} onChange={event => setField(key, event.target.value)} placeholder={placeholder} /></label>)}
    </fieldset>
    <div className="form-footer"><Link className="button button-secondary" href={paper ? "/papers/" + paper.id : "/papers"}>돌아가기</Link><button className="button" disabled={pending}>{pending ? "처리 중…" : paper ? "수정 내용 저장" : "직접 입력한 논문 등록"} <span aria-hidden="true">↗</span></button></div>
  </form>;
}
