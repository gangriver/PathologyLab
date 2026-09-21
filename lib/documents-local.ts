import { randomUUID } from "node:crypto";
import { db } from "./db";
import { ApiError } from "./api";
import { assertPaperExists, createPaper } from "./papers-local";
import type { ExtractedPdf, PaperDocument, PaperDocumentInfo } from "./document-types";
import type { PaperInput } from "./validation";

const documentColumns = "id,paperId,filename,byteLength,pageCount,textCharacters,uploadedAt";
export function getDocumentInfo(paperId: string): PaperDocumentInfo | undefined {
  const row = db.prepare("SELECT " + documentColumns + " FROM paper_documents WHERE paperId=?").get(paperId);
  return row ? { ...row } as PaperDocumentInfo : undefined;
}
export function getDocument(paperId: string): PaperDocument | undefined {
  return db.prepare("SELECT * FROM paper_documents WHERE paperId=?").get(paperId) as unknown as PaperDocument | undefined;
}
function storeDocument(paperId: string, filename: string, content: Uint8Array, extracted: ExtractedPdf) {
  db.prepare(`INSERT INTO paper_documents (id,paperId,filename,content,byteLength,pagesJson,pageCount,textCharacters,uploadedBy,uploadedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(paperId) DO UPDATE SET
    id=excluded.id,filename=excluded.filename,content=excluded.content,byteLength=excluded.byteLength,pagesJson=excluded.pagesJson,
    pageCount=excluded.pageCount,textCharacters=excluded.textCharacters,uploadedBy=excluded.uploadedBy,uploadedAt=excluded.uploadedAt`)
    .run(randomUUID(), paperId, filename, content, content.length, JSON.stringify(extracted.pages), extracted.pageCount, extracted.textCharacters, "", new Date().toISOString());
}
export function importPaper(filename: string, content: Uint8Array, extracted: ExtractedPdf) {
  const input: PaperInput = {
    title: extracted.basicInfo.title || filename.replace(/\.pdf$/i, "") || "새 논문",
    subtitle: "", authors: extracted.basicInfo.authors, url: extracted.basicInfo.url, researchQuestion: "", methods: "", findings: "", limitations: "",
    meetingDate: "", presenter: "", status: "planned",
  };
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = createPaper(input);
    storeDocument(result.id, filename, content, extracted);
    db.exec("COMMIT");
    return result;
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
export function replaceDocument(paperId: string, filename: string, content: Uint8Array, extracted: ExtractedPdf, revision: number) {
  db.exec("BEGIN IMMEDIATE");
  try {
    assertPaperExists(paperId);
    advanceRevision(paperId, revision);
    storeDocument(paperId, filename, content, extracted);
    db.exec("COMMIT");
    return { document: getDocumentInfo(paperId)!, revision: revision + 1, basicInfo: extracted.basicInfo };
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
export function deleteDocument(paperId: string, revision: number) {
  db.exec("BEGIN IMMEDIATE");
  try {
    assertPaperExists(paperId);
    if (!getDocumentInfo(paperId)) throw new ApiError(404, "첨부된 PDF가 없습니다.");
    advanceRevision(paperId, revision);
    db.prepare("DELETE FROM paper_documents WHERE paperId=?").run(paperId);
    db.exec("COMMIT");
    return { revision: revision + 1 };
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
function advanceRevision(id: string, revision: number) {
  const result = db.prepare("UPDATE papers SET revision=revision+1,updatedAt=? WHERE id=? AND revision=?").run(new Date().toISOString(), id, revision);
  if (!result.changes) throw new ApiError(409, "논문이 변경되었습니다. 새로고침 후 다시 시도해주세요.");
}
