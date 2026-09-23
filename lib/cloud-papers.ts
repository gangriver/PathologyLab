import { randomUUID } from "node:crypto";
import { ApiError } from "./api";
import { supabaseRequest } from "./supabase";
import type { Comment, Paper } from "./types";
import type { PaperInput, PaperUpdateInput } from "./validation";

const paperColumns = "id,title,subtitle,authors,url,referenceLinks,researchQuestion,methods,findings,limitations,meetingDate,presenter,status,creatorName,createdAt,updatedAt,revision";

export async function listPapers(): Promise<Paper[]> {
  return supabaseRequest<Paper[]>("papers", { query: { select: paperColumns, order: "meetingDate.desc,createdAt.desc" } });
}
export async function findPaper(id: string): Promise<Paper | undefined> {
  const rows = await supabaseRequest<Paper[]>("papers", { query: { select: paperColumns, id: `eq.${id}`, limit: "1" } });
  return rows[0];
}
export async function createPaper(input: PaperInput): Promise<{ id: string }> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await supabaseRequest<void>("papers", {
    method: "POST", prefer: "return=minimal", body: {
      id, title: input.title, subtitle: input.subtitle, authors: input.authors, url: input.url, referenceLinks: input.referenceLinks, researchQuestion: input.researchQuestion,
      methods: input.methods, findings: input.findings, limitations: input.limitations, meetingDate: input.meetingDate,
      presenter: input.presenter, status: input.status, createdAt: now, updatedAt: now,
    },
  });
  return { id };
}
export async function editPaper(id: string, input: PaperUpdateInput, revision: number): Promise<{ id: string }> {
  return supabaseRequest("rpc/lab_edit_paper", { method: "POST", body: { p_id: id, p_input: input, p_revision: revision } });
}
export async function removePaper(id: string, revision: number): Promise<{ success: true; storageKey?: string }> {
  return supabaseRequest("rpc/lab_remove_paper", { method: "POST", body: { p_id: id, p_revision: revision } });
}
export async function assertPaperExists(id: string): Promise<void> {
  if (!await findPaper(id)) throw new ApiError(404, "논문을 찾을 수 없습니다.");
}
export async function listComments(paperId: string): Promise<Comment[]> {
  return supabaseRequest<Comment[]>("comments", {
    query: { select: "id,paperId,authorName,content,createdAt", paperId: `eq.${paperId}`, order: "createdAt.asc" },
  });
}
export async function createComment(paperId: string, content: string): Promise<{ id: string }> {
  await assertPaperExists(paperId);
  const id = randomUUID();
  await supabaseRequest<void>("comments", {
    method: "POST", prefer: "return=minimal", body: { id, paperId, content, createdAt: new Date().toISOString() },
  });
  return { id };
}
