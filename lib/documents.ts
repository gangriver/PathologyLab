import { randomUUID } from "node:crypto";
import { isCloudStorageEnabled } from "./cloud-config";
import type { ExtractedPdf, PaperDocument, PaperDocumentInfo } from "./document-types";
import type { StoredDocument } from "./cloud-documents";

export async function getDocumentInfo(paperId: string): Promise<PaperDocumentInfo | undefined> {
  const repository = isCloudStorageEnabled() ? await import("./cloud-documents") : await import("./documents-local");
  return repository.getDocumentInfo(paperId);
}
export async function getDocument(paperId: string): Promise<PaperDocument | undefined> {
  if (!isCloudStorageEnabled()) return (await import("./documents-local")).getDocument(paperId);
  const stored = await (await import("./cloud-documents")).getStoredDocument(paperId);
  if (!stored) return undefined;
  const { storageKey, ...document } = stored;
  return { ...document, content: await (await import("./r2")).getPdf(storageKey) };
}
export async function getDocumentUrl(paperId: string): Promise<string | undefined> {
  const stored = await (await import("./cloud-documents")).getStoredDocument(paperId);
  if (!stored) return undefined;
  return (await import("./r2")).getPdfUrl(stored.storageKey, stored.filename);
}
async function storeDocument(paperId: string, filename: string, content: Uint8Array, extracted: ExtractedPdf): Promise<StoredDocument> {
  const id = randomUUID();
  const storageKey = `papers/${id}.pdf`;
  // DB 저장에 실패하거나 응답이 끊기더라도 사용되지 않은 파일을 다시 정리할 수 있습니다.
  await (await import("./storage-cleanup")).scheduleStorageCleanup(storageKey);
  await (await import("./r2")).putPdf(storageKey, content, { ifAbsent: true });
  return {
    id, paperId, filename, storageKey, byteLength: content.byteLength, pagesJson: JSON.stringify(extracted.pages),
    pageCount: extracted.pageCount, textCharacters: extracted.textCharacters, uploadedAt: new Date().toISOString(),
  };
}
export async function importPaper(filename: string, content: Uint8Array, extracted: ExtractedPdf, uploadId?: string) {
  if (!isCloudStorageEnabled()) return (await import("./documents-local")).importPaper(filename, content, extracted);
  const document = await storeDocument(uploadId ?? randomUUID(), filename, content, extracted);
  const result = await (await import("./cloud-documents")).importStoredPaper(document, extracted);
  await (await import("./storage-cleanup")).flushStorageCleanup();
  return result;
}
export async function replaceDocument(paperId: string, filename: string, content: Uint8Array, extracted: ExtractedPdf, revision: number) {
  if (!isCloudStorageEnabled()) return (await import("./documents-local")).replaceDocument(paperId, filename, content, extracted, revision);
  const document = await storeDocument(paperId, filename, content, extracted);
  const result = await (await import("./cloud-documents")).replaceStoredDocument(paperId, document, extracted, revision);
  await (await import("./storage-cleanup")).flushStorageCleanup();
  return { document: result.document, revision: result.revision, basicInfo: result.basicInfo };
}
export async function deleteDocument(paperId: string, revision: number) {
  if (!isCloudStorageEnabled()) return (await import("./documents-local")).deleteDocument(paperId, revision);
  const result = await (await import("./cloud-documents")).deleteStoredDocument(paperId, revision);
  await (await import("./storage-cleanup")).flushStorageCleanup();
  return { revision: result.revision };
}
