import { supabaseRequest } from "./supabase";
import type { ExtractedPdf, PaperDocumentInfo } from "./document-types";
import type { PaperInput } from "./validation";

export type StoredDocument = PaperDocumentInfo & { storageKey: string; pagesJson: string };
const documentColumns = "id,paperId,filename,byteLength,pageCount,textCharacters,uploadedAt";

export async function getDocumentInfo(paperId: string): Promise<PaperDocumentInfo | undefined> {
  const rows = await supabaseRequest<PaperDocumentInfo[]>("paper_documents", {
    query: { select: documentColumns, paperId: `eq.${paperId}`, limit: "1" },
  });
  return rows[0];
}
export async function getStoredDocument(paperId: string): Promise<StoredDocument | undefined> {
  const rows = await supabaseRequest<StoredDocument[]>("paper_documents", {
    query: { select: `${documentColumns},storageKey,pagesJson`, paperId: `eq.${paperId}`, limit: "1" },
  });
  return rows[0];
}
export async function importStoredPaper(document: StoredDocument, extracted: ExtractedPdf): Promise<{ id: string }> {
  const input: PaperInput = {
    title: extracted.basicInfo.title || document.filename.replace(/\.pdf$/i, "") || "새 논문",
    authors: extracted.basicInfo.authors, url: extracted.basicInfo.url, researchQuestion: "", methods: "", findings: "", limitations: "",
    meetingDate: "", presenter: "", status: "planned",
  };
  return supabaseRequest("rpc/lab_import_paper", { method: "POST", body: { p_input: input, p_document: document } });
}
export async function replaceStoredDocument(paperId: string, document: StoredDocument, extracted: ExtractedPdf, revision: number): Promise<{
  document: PaperDocumentInfo; revision: number; basicInfo: ExtractedPdf["basicInfo"]; previousStorageKey?: string;
}> {
  const result = await supabaseRequest<{ revision: number; previousStorageKey?: string }>("rpc/lab_replace_document", {
    method: "POST", body: { p_id: paperId, p_document: document, p_revision: revision },
  });
  return {
    ...result, basicInfo: extracted.basicInfo,
    document: {
      id: document.id, paperId: document.paperId, filename: document.filename, byteLength: document.byteLength,
      pageCount: document.pageCount, textCharacters: document.textCharacters, uploadedAt: document.uploadedAt,
    },
  };
}
export async function deleteStoredDocument(paperId: string, revision: number): Promise<{ revision: number; storageKey: string }> {
  return supabaseRequest("rpc/lab_delete_document", { method: "POST", body: { p_id: paperId, p_revision: revision } });
}
