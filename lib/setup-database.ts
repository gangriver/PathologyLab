import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";

export function needsPublicMigration(database: DatabaseSync): boolean {
  return database.prepare("PRAGMA foreign_key_list(papers)").all().some(row => row.table === "user");
}

export function setupDatabase(database: DatabaseSync) {
  const schema = readFileSync(resolve("db/schema.sql"), "utf8");
  if (!needsPublicMigration(database)) {
    database.exec(schema);
    return;
  }

  const hasComments = Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get("comments"));
  const hasDocuments = Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get("paper_documents"));
  database.exec("PRAGMA foreign_keys = OFF");
  try {
    database.exec("BEGIN IMMEDIATE");
    try {
      if (hasComments) database.exec("ALTER TABLE comments RENAME TO migration_comments");
      if (hasDocuments) database.exec("ALTER TABLE paper_documents RENAME TO migration_paper_documents");
      database.exec("ALTER TABLE papers RENAME TO migration_papers");
      database.exec(schema);
      database.exec(`INSERT INTO papers (
        id,title,authors,url,researchQuestion,methods,findings,limitations,meetingDate,presenter,status,
        createdBy,creatorName,createdAt,updatedAt,revision
      ) SELECT p.id,p.title,p.authors,p.url,p.researchQuestion,p.methods,p.findings,p.limitations,p.meetingDate,p.presenter,p.status,
        p.createdBy,COALESCE(u.name,'방문자'),p.createdAt,p.updatedAt,p.revision
        FROM migration_papers p LEFT JOIN user u ON u.id=p.createdBy`);
      if (hasComments) {
        database.exec(`INSERT INTO comments (id,paperId,authorId,authorName,content,createdAt)
          SELECT c.id,c.paperId,c.authorId,COALESCE(u.name,'방문자'),c.content,c.createdAt
          FROM migration_comments c LEFT JOIN user u ON u.id=c.authorId`);
        database.exec("DROP TABLE migration_comments");
      }
      if (hasDocuments) {
        database.exec(`INSERT INTO paper_documents (id,paperId,filename,content,byteLength,pagesJson,pageCount,textCharacters,uploadedBy,uploadedAt)
          SELECT id,paperId,filename,content,byteLength,pagesJson,pageCount,textCharacters,uploadedBy,uploadedAt
          FROM migration_paper_documents`);
        database.exec("DROP TABLE migration_paper_documents");
      }
      database.exec("DROP TABLE migration_papers");
      // 이전 테이블의 인덱스를 제거한 다음 새 테이블에 같은 인덱스를 만듭니다.
      database.exec(schema);
      if (database.prepare("PRAGMA foreign_key_check").all().length) {
        throw new Error("데이터 연결 검증에 실패했습니다.");
      }
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  } finally {
    database.exec("PRAGMA foreign_keys = ON");
  }
}
