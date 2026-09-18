import { randomUUID } from "node:crypto";
import { db } from "./db";
import { ApiError } from "./api";
import type { Paper, Comment } from "./types";
import type { PaperInput } from "./validation";

const paperSelect = "SELECT id,title,authors,url,researchQuestion,methods,findings,limitations,meetingDate,presenter,status,creatorName,createdAt,updatedAt,revision FROM papers";
export function listPapers(): Paper[] {
  return db.prepare(paperSelect + " ORDER BY meetingDate DESC, createdAt DESC").all().map(row => ({ ...row })) as unknown as Paper[];
}
export function findPaper(id: string): Paper | undefined {
  const row = db.prepare(paperSelect + " WHERE id = ?").get(id);
  return row ? { ...row } as Paper : undefined;
}
export function createPaper(input: PaperInput) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO papers (id,title,authors,url,researchQuestion,methods,findings,limitations,meetingDate,presenter,status,createdAt,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,input.title,input.authors,input.url,input.researchQuestion,input.methods,input.findings,input.limitations,input.meetingDate,input.presenter,input.status,now,now);
  return { id };
}
export function editPaper(id: string, input: PaperInput, revision: number) {
  assertPaperExists(id);
  const result = db.prepare(`UPDATE papers SET title=?,authors=?,url=?,researchQuestion=?,methods=?,findings=?,limitations=?,meetingDate=?,presenter=?,status=?,updatedAt=?,revision=revision+1 WHERE id=? AND revision=?`)
    .run(input.title,input.authors,input.url,input.researchQuestion,input.methods,input.findings,input.limitations,input.meetingDate,input.presenter,input.status,new Date().toISOString(),id,revision);
  if (!result.changes) throw new ApiError(409, "다른 곳에서 논문이 변경되었습니다. 새로고침 후 다시 확인해주세요.");
  return { id };
}
export function removePaper(id: string, revision: number) {
  assertPaperExists(id);
  const result = db.prepare("DELETE FROM papers WHERE id=? AND revision=?").run(id, revision);
  if (!result.changes) throw new ApiError(409, "논문이 변경되었습니다. 새로고침 후 다시 확인해주세요.");
  return { success: true };
}
export function assertPaperExists(id: string) {
  if (!findPaper(id)) throw new ApiError(404, "논문을 찾을 수 없습니다.");
}
export function listComments(paperId: string): Comment[] {
  return db.prepare("SELECT id,paperId,authorName,content,createdAt FROM comments WHERE paperId=? ORDER BY createdAt").all(paperId).map(row => ({ ...row })) as unknown as Comment[];
}
export function createComment(paperId: string, content: string) {
  assertPaperExists(paperId);
  const id = randomUUID();
  db.prepare("INSERT INTO comments (id,paperId,content,createdAt) VALUES (?,?,?,?)").run(id,paperId,content,new Date().toISOString());
  return { id };
}
