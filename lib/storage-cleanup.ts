import { deletePdf } from "./r2";
import { supabaseRequest } from "./supabase";

export async function scheduleStorageCleanup(storageKey: string) {
  await supabaseRequest("storage_cleanup", { method: "POST", body: { storageKey }, prefer: "return=minimal" });
}

export async function flushStorageCleanup() {
  try {
    // 저장 직후의 요청이나 결과를 기다리는 요청의 파일은 정리하지 않습니다.
    const entries = await supabaseRequest<{ storageKey: string }[]>("storage_cleanup", {
      query: { select: "storageKey", createdAt: `lt.${new Date(Date.now() - 60 * 60 * 1000).toISOString()}`, order: "createdAt.asc", limit: "1" },
    });
    for (const { storageKey } of entries) {
      const documents = await supabaseRequest<{ id: string }[]>("paper_documents", {
        query: { select: "id", storageKey: `eq.${storageKey}`, limit: "1" },
      });
      if (!documents.length) await deletePdf(storageKey);
      await supabaseRequest("storage_cleanup", { method: "DELETE", query: { storageKey: `eq.${storageKey}` }, prefer: "return=minimal" });
    }
  } catch {
    console.warn("보관 기한이 지난 PDF 정리를 완료하지 못했습니다. 다음 변경 요청에서 다시 시도합니다.");
  }
}
