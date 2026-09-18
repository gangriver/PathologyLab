"use client";
import { useNewPaperForm } from "@/hooks/use-new-paper-form";
import { PaperForm } from "./paper-form";
import { PdfImport } from "./pdf-import";

export function NewPaperForm({ cloudStorage }: { cloudStorage: boolean }) {
  const { mode, setMode, pending, setPending } = useNewPaperForm();
  return <>
    <div className="document-actions registration-modes" role="group" aria-label="논문 등록 방식">
      <button type="button" className={mode === "pdf" ? "button" : "button button-secondary"} aria-pressed={mode === "pdf"} disabled={pending} onClick={() => setMode("pdf")}>PDF로 등록</button>
      <button type="button" className={mode === "manual" ? "button" : "button button-secondary"} aria-pressed={mode === "manual"} disabled={pending} onClick={() => setMode("manual")}>직접 입력</button>
    </div>
    <div hidden={mode !== "pdf"}><PdfImport cloudStorage={cloudStorage} onPendingChange={setPending} /></div>
    <div hidden={mode !== "manual"}><PaperForm defaultPresenter="" cloudStorage={cloudStorage} onPendingChange={setPending} /></div>
  </>;
}
