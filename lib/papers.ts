import { isCloudStorageEnabled } from "./cloud-config";
import type { PaperInput, PaperUpdateInput } from "./validation";

async function repository() {
  return isCloudStorageEnabled() ? import("./cloud-papers") : import("./papers-local");
}
export async function listPapers() { return (await repository()).listPapers(); }
export async function findPaper(id: string) { return (await repository()).findPaper(id); }
export async function createPaper(input: PaperInput) { return (await repository()).createPaper(input); }
export async function editPaper(id: string, input: PaperUpdateInput, revision: number) { return (await repository()).editPaper(id, input, revision); }
export async function removePaper(id: string, revision: number) {
  await (await repository()).removePaper(id, revision);
  if (isCloudStorageEnabled()) await (await import("./storage-cleanup")).flushStorageCleanup();
  return { success: true };
}
export async function assertPaperExists(id: string) { return (await repository()).assertPaperExists(id); }
export async function listComments(paperId: string) { return (await repository()).listComments(paperId); }
export async function createComment(paperId: string, content: string) { return (await repository()).createComment(paperId, content); }
