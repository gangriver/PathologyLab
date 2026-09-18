"use client";
import { useNewPaperForm } from "@/hooks/use-new-paper-form";
import { PaperForm } from "./paper-form";
import { PdfImport } from "./pdf-import";
import { useLocale } from "@/hooks/use-locale";
import { getFormMessages } from "@/lib/i18n-form";

export function NewPaperForm({ cloudStorage }: { cloudStorage: boolean }) {
  const { mode, setMode, pending, setPending } = useNewPaperForm();
  const { locale } = useLocale();
  const text = getFormMessages(locale);
  return <>
    <div className="document-actions registration-modes" role="group" aria-label={text.registrationMode}>
      <button type="button" className={mode === "pdf" ? "button" : "button button-secondary"} aria-pressed={mode === "pdf"} disabled={pending} onClick={() => setMode("pdf")}>{text.pdfMode}</button>
      <button type="button" className={mode === "manual" ? "button" : "button button-secondary"} aria-pressed={mode === "manual"} disabled={pending} onClick={() => setMode("manual")}>{text.manualMode}</button>
    </div>
    <div hidden={mode !== "pdf"}><PdfImport cloudStorage={cloudStorage} onPendingChange={setPending} /></div>
    <div hidden={mode !== "manual"}><PaperForm defaultPresenter="" cloudStorage={cloudStorage} onPendingChange={setPending} /></div>
  </>;
}
