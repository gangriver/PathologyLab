"use client";
import Link from "next/link";
import { usePaperForm } from "@/hooks/use-paper-form";
import { getPaperStatuses, type Paper } from "@/lib/types";
import { getPaperSections } from "@/lib/paper-sections";
import { PDF_LIMITS, type PaperDocumentInfo } from "@/lib/document-types";
import { SummaryDraft } from "./summary-draft";

export function PaperForm({ paper, defaultPresenter, cloudStorage, document, summaryConfigured = false, onPendingChange }: { paper?: Paper; defaultPresenter: string; cloudStorage: boolean; document?: PaperDocumentInfo; summaryConfigured?: boolean; onPendingChange?: (pending: boolean) => void }) {
  const { locale, text, values, setField, pending, error, notice, operation, submit, attachment, draft, upload, removeDocument, summarize, applyDraft } = usePaperForm(defaultPresenter, cloudStorage, paper, document, onPendingChange);
  return <form className="panel" onSubmit={submit}>
    {paper && <section className="document-panel">
      <h2>{text.documentHeading}</h2>
      {attachment && <div className="document-info"><a className="blue" href={"/api/papers/" + paper.id + "/pdf"}>{attachment.filename} ↓</a><p className="muted">{text.documentInfo(attachment.pageCount, (attachment.byteLength / 1024 / 1024).toFixed(2), attachment.textCharacters)}</p></div>}
      <label className="field">{attachment ? text.replacePdf : text.attachPdf}<input type="file" accept=".pdf,application/pdf" onChange={upload} disabled={pending} /><small>{text.uploadHelp(PDF_LIMITS.maxBytes / 1024 / 1024, PDF_LIMITS.maxPages)}</small></label>
      {attachment && <>
        <p className="form-note">{text.basicInfoReview}</p>
        {attachment.textCharacters < 100 && <p className="form-note">{text.insufficientText}</p>}
        {!summaryConfigured && <p className="form-note">{text.summaryUnavailable}</p>}
        <p className="form-note">{text.summaryHelp}</p>
        <div className="document-actions"><button type="button" className="button button-secondary" onClick={summarize} disabled={pending || !summaryConfigured || attachment.textCharacters < 100}>{text.generateSummary}</button><button type="button" className="text-button" onClick={removeDocument} disabled={pending}>{text.deletePdf}</button></div>
      </>}
      {draft && <SummaryDraft draft={draft} apply={applyDraft} disabled={pending} />}
    </section>}
    {pending && <p role="status" className="form-note">{operation}</p>}
    {notice && <p role="status" className="alert alert-success">{notice}</p>}
    {error && <div role="alert" className="alert alert-error">{error}</div>}
    <fieldset disabled={pending} className="paper-fields">
      <label className="field">{text.title} <span className="muted">{text.required}</span><input name="title" required maxLength={500} value={values.title} onChange={event => setField("title", event.target.value)} placeholder={text.titlePlaceholder} /></label>
      <div className="form-grid"><label className="field">{text.authors}<input name="authors" maxLength={500} value={values.authors} onChange={event => setField("authors", event.target.value)} placeholder={text.authorsPlaceholder} /></label><label className="field">{text.sourceLink}<input type="url" name="url" maxLength={2000} value={values.url} onChange={event => setField("url", event.target.value)} placeholder="https://" /></label></div>
      <div className="form-grid"><label className="field">{text.presentationDate}<input type="date" name="meetingDate" value={values.meetingDate} onChange={event => setField("meetingDate", event.target.value)} /></label><label className="field">{text.presenter}<input name="presenter" maxLength={100} value={values.presenter} onChange={event => setField("presenter", event.target.value)} /></label></div>
      <label className="field">{text.presentationStatus}<select name="status" value={values.status} onChange={event => setField("status", event.target.value as Paper["status"])}>{Object.entries(getPaperStatuses(locale)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {getPaperSections(locale).map(({ key, label, placeholder }) => <label className="field" key={key}>{label}<textarea name={key} rows={5} maxLength={12000} value={values[key]} onChange={event => setField(key, event.target.value)} placeholder={placeholder} /></label>)}
    </fieldset>
    <div className="form-footer"><Link className="button button-secondary" href={paper ? "/papers/" + paper.id : "/papers"}>{text.back}</Link><button className="button" disabled={pending}>{pending ? text.processing : paper ? text.saveChanges : text.addManualPaper} <span aria-hidden="true">↗</span></button></div>
  </form>;
}
