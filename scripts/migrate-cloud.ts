import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { ApiError } from "../lib/api";
import { PDF_LIMITS, type PaperDocumentInfo } from "../lib/document-types";
import { getPdf, putPdf } from "../lib/r2";
import { supabaseRequest } from "../lib/supabase";
import type { Comment, Paper } from "../lib/types";

type Table = "papers" | "comments" | "paper_documents";
type DocumentRow = PaperDocumentInfo & { pagesJson: string; storageKey: string };
class MigrationError extends Error {}
let stage = "설정 확인";

function sameRecord(expected: object, actual: object): boolean {
  const record = actual as Record<string, unknown>;
  return Object.entries(expected).every(([key, value]) => {
    if (["createdAt", "updatedAt", "uploadedAt"].includes(key)) {
      return typeof value === "string" && typeof record[key] === "string"
        && Number.isFinite(Date.parse(value)) && Date.parse(value) === Date.parse(record[key]);
    }
    return value === record[key];
  });
}

async function findRecord<T extends object>(table: Table, field: "id" | "paperId", value: string): Promise<T | undefined> {
  const rows = await supabaseRequest<T[]>(table, {
    query: { select: "*", [field]: `eq.${value}`, limit: "2" },
  });
  if (rows.length > 1) throw new MigrationError("중복된 원격 식별자가 있습니다. 자료를 변경하지 않고 중단합니다.");
  return rows[0];
}

async function checkRecord<T extends { id: string }>(table: Table, row: T): Promise<boolean> {
  const existing = await findRecord<T>(table, "id", row.id);
  if (existing && !sameRecord(row, existing)) {
    throw new MigrationError(`${table}에 로컬 자료와 다른 기존 내용이 있습니다. 덮어쓰지 않고 중단합니다.`);
  }
  return Boolean(existing);
}

function readPdf(database: DatabaseSync, document: DocumentRow): Uint8Array {
  const row = database.prepare("SELECT content FROM paper_documents WHERE id = ?").get(document.id);
  const content = row?.content;
  if (!(content instanceof Uint8Array) || content.byteLength !== document.byteLength
    || !content.byteLength || content.byteLength > PDF_LIMITS.maxBytes) {
    throw new MigrationError("로컬 PDF의 크기 또는 원본 데이터가 올바르지 않습니다.");
  }
  return content;
}

function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

async function checkStoredPdf(document: DocumentRow, content: Uint8Array): Promise<boolean> {
  let stored: Uint8Array;
  try { stored = await getPdf(document.storageKey); }
  catch (error) {
    if (error instanceof ApiError && error.status === 404) return false;
    throw error;
  }
  if (sha256(stored) !== sha256(content)) {
    throw new MigrationError("R2에 로컬 원본과 다른 PDF가 있습니다. 덮어쓰지 않고 중단합니다.");
  }
  return true;
}

async function migrate(database: DatabaseSync) {
  const papers = database.prepare(`SELECT id, title, authors, url, researchQuestion, methods, findings,
    limitations, meetingDate, presenter, status, creatorName, createdAt, updatedAt, revision FROM papers`).all() as unknown as Paper[];
  const comments = database.prepare("SELECT id, paperId, authorName, content, createdAt FROM comments").all() as unknown as Comment[];
  const documents = (database.prepare(`SELECT id, paperId, filename, byteLength, pagesJson,
    pageCount, textCharacters, uploadedAt FROM paper_documents`).all() as unknown as Omit<DocumentRow, "storageKey">[])
    .map(document => ({ ...document, storageKey: `papers/migrated-${encodeURIComponent(document.id)}.pdf` }));
  const existingPapers = new Set<string>();
  const existingComments = new Set<string>();
  const existingDocuments = new Set<string>();
  const existingFiles = new Set<string>();

  // 전체 충돌 검사를 먼저 끝내고, 일치하는 기존 자료는 그대로 유지합니다.
  stage = "기존 원격 자료 비교";
  for (const paper of papers) {
    if (await checkRecord("papers", paper)) existingPapers.add(paper.id);
  }
  for (const comment of comments) {
    if (await checkRecord("comments", comment)) existingComments.add(comment.id);
  }
  for (const document of documents) {
    if (Buffer.byteLength(document.storageKey, "utf8") > 1024) throw new MigrationError("PDF 식별자가 저장소에서 허용하는 길이를 초과합니다.");
    const existing = await findRecord<DocumentRow>("paper_documents", "paperId", document.paperId);
    if (existing && !sameRecord(document, existing)) {
      throw new MigrationError("기존 논문에 다른 PDF 정보가 있습니다. 덮어쓰지 않고 중단합니다.");
    }
    if (await checkRecord("paper_documents", document)) existingDocuments.add(document.id);
    if (await checkStoredPdf(document, readPdf(database, document))) existingFiles.add(document.id);
  }

  stage = "논문 저장";
  for (const paper of papers) {
    if (!existingPapers.has(paper.id)) {
      await supabaseRequest("papers", { method: "POST", body: paper, prefer: "return=minimal" });
    }
  }
  stage = "PDF 및 파일 정보 저장";
  for (const document of documents) {
    if (!existingFiles.has(document.id)) {
      // 재실행 또는 동시 작업으로 파일이 생겨도 기존 원본을 덮어쓰지 않습니다.
      await putPdf(document.storageKey, readPdf(database, document), { ifAbsent: true });
    }
    if (!existingDocuments.has(document.id)) {
      await supabaseRequest("paper_documents", { method: "POST", body: document, prefer: "return=minimal" });
    }
  }
  stage = "토론 저장";
  for (const comment of comments) {
    if (!existingComments.has(comment.id)) {
      await supabaseRequest("comments", { method: "POST", body: comment, prefer: "return=minimal" });
    }
  }

  stage = "이전 결과 및 PDF 원본 검증";
  for (const paper of papers) {
    if (!await checkRecord("papers", paper)) throw new MigrationError("원격 논문 검증에서 누락된 자료가 확인되었습니다.");
  }
  for (const comment of comments) {
    if (!await checkRecord("comments", comment)) throw new MigrationError("원격 토론 검증에서 누락된 자료가 확인되었습니다.");
  }
  for (const document of documents) {
    if (!await checkRecord("paper_documents", document)
      || !await checkStoredPdf(document, readPdf(database, document))) {
      throw new MigrationError("원격 PDF 검증에서 누락된 자료가 확인되었습니다.");
    }
  }
  console.log(`이전 및 검증 완료: 논문 ${papers.length}개, 토론 ${comments.length}개, PDF ${documents.length}개.`);
  console.log(`동일한 기존 자료 유지: 논문 ${existingPapers.size}개, 토론 ${existingComments.size}개, PDF 정보 ${existingDocuments.size}개.`);
  console.log("이전 대상의 모든 필드와 PDF 원본 SHA-256이 로컬 백업과 일치합니다.");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(argument => argument !== "--apply")) {
    throw new MigrationError("지원하는 옵션은 --apply입니다. 옵션 없이 실행하면 개수만 확인합니다.");
  }
  for (const filename of [".env.local", ".env.cloud.local"]) {
    const path = resolve(filename);
    if (existsSync(path)) process.loadEnvFile(path);
  }
  if (!process.env.DATABASE_PATH) throw new MigrationError("DATABASE_PATH 설정이 필요합니다.");
  const source = new DatabaseSync(resolve(process.env.DATABASE_PATH), { readOnly: true });
  let snapshotPath: string | undefined;
  try {
    const counts = source.prepare(`SELECT (SELECT COUNT(*) FROM papers) AS papers,
      (SELECT COUNT(*) FROM comments) AS comments, COUNT(*) AS documents,
      COALESCE(SUM(byteLength), 0) AS bytes FROM paper_documents`).get()!;
    console.log(`로컬 자료: 논문 ${counts.papers}개, 토론 ${counts.comments}개, PDF ${counts.documents}개, PDF 합계 ${counts.bytes}바이트.`);
    if (!args.includes("--apply")) {
      console.log("읽기 전용 확인입니다. 실제 이전은 --apply 옵션으로 실행합니다.");
      return;
    }
    stage = "로컬 데이터베이스 백업";
    const backupDirectory = resolve("data");
    mkdirSync(backupDirectory, { recursive: true });
    snapshotPath = resolve(backupDirectory, `lab-before-cloud-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.sqlite`);
    // SQLite 백업 API로 WAL의 변경 내용까지 포함한 일관된 스냅샷을 만듭니다.
    await backup(source, snapshotPath);
    console.log("이전 기준 백업: " + snapshotPath);
  } finally { source.close(); }

  const snapshot = new DatabaseSync(snapshotPath!, { readOnly: true });
  try { await migrate(snapshot); }
  finally { snapshot.close(); }
}

main().catch(error => {
  console.error(`이전을 중단했습니다. 단계: ${stage}.`);
  console.error(error instanceof MigrationError ? error.message : "연결 설정, 접근 권한, 네트워크와 데이터베이스 상태를 확인해주세요.");
  console.error("로컬 원본과 이미 이전한 자료는 삭제하지 않았습니다. 문제를 해결한 뒤 같은 명령으로 재실행할 수 있습니다.");
  process.exitCode = 1;
});
