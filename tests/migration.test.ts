import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { needsPublicMigration, setupDatabase } from "../lib/setup-database";

const legacySchema = `
  CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL);
  CREATE TABLE account (id TEXT PRIMARY KEY, userId TEXT REFERENCES user(id), password TEXT);
  CREATE TABLE papers (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, authors TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '',
    researchQuestion TEXT NOT NULL DEFAULT '', methods TEXT NOT NULL DEFAULT '', findings TEXT NOT NULL DEFAULT '',
    limitations TEXT NOT NULL DEFAULT '', meetingDate TEXT NOT NULL DEFAULT '', presenter TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK(status IN ('planned','discussed')) DEFAULT 'planned',
    createdBy TEXT NOT NULL REFERENCES user(id), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE comments (
    id TEXT PRIMARY KEY, paperId TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    authorId TEXT NOT NULL REFERENCES user(id), content TEXT NOT NULL, createdAt TEXT NOT NULL
  );
  CREATE INDEX comments_paper_idx ON comments(paperId,createdAt);
  CREATE INDEX papers_meeting_idx ON papers(meetingDate,createdAt);
  CREATE TABLE paper_documents (
    id TEXT NOT NULL UNIQUE, paperId TEXT PRIMARY KEY REFERENCES papers(id) ON DELETE CASCADE,
    filename TEXT NOT NULL, content BLOB NOT NULL, byteLength INTEGER NOT NULL,
    pagesJson TEXT NOT NULL, pageCount INTEGER NOT NULL, textCharacters INTEGER NOT NULL,
    uploadedBy TEXT NOT NULL REFERENCES user(id), uploadedAt TEXT NOT NULL
  );
`;

function createLegacyDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(legacySchema);
  database.prepare("INSERT INTO user VALUES (?,?,?)").run("member-1", "기존 작성자", "private@lab.test");
  database.prepare("INSERT INTO account VALUES (?,?,?)").run("account-1", "member-1", "기존 인증 데이터");
  database.prepare(`INSERT INTO papers (
    id,title,authors,url,researchQuestion,methods,findings,limitations,meetingDate,presenter,status,createdBy,createdAt,updatedAt,revision
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    "paper-1", "기존 논문", "저자", "https://example.org/paper", "질문", "방법", "결과", "한계",
    "2026-09-10", "발표자", "discussed", "member-1", "2026-09-09T10:00:00Z", "2026-09-10T12:00:00Z", 7,
  );
  database.prepare("INSERT INTO comments VALUES (?,?,?,?,?)").run("comment-1", "paper-1", "member-1", "기존 토론", "2026-09-10T12:00:00Z");
  const content = Uint8Array.from([37, 80, 68, 70, 45, 0, 255]);
  database.prepare("INSERT INTO paper_documents VALUES (?,?,?,?,?,?,?,?,?,?)").run(
    "document-1", "paper-1", "기존 원본.pdf", content, content.length,
    JSON.stringify([{ pageNumber: 1, text: "기존 추출 내용" }]), 1, 8, "member-1", "2026-09-10T11:00:00Z",
  );
  return database;
}

test("새 데이터베이스는 인증 테이블 없이 공개 자료를 저장하고 재초기화해도 보존한다", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("PRAGMA foreign_keys = ON");
    setupDatabase(database);
    assert.equal(needsPublicMigration(database), false);
    assert.equal(database.prepare("SELECT name FROM sqlite_master WHERE name='user'").get(), undefined);
    database.prepare("INSERT INTO papers (id,title,createdAt,updatedAt) VALUES (?,?,?,?)").run("public-paper", "공개 논문", "now", "now");
    database.prepare("INSERT INTO comments (id,paperId,content,createdAt) VALUES (?,?,?,?)").run("public-comment", "public-paper", "공개 토론", "now");
    setupDatabase(database);
    assert.deepEqual({ ...database.prepare("SELECT createdBy,creatorName FROM papers").get() }, { createdBy: "", creatorName: "방문자" });
    assert.deepEqual({ ...database.prepare("SELECT authorId,authorName FROM comments").get() }, { authorId: "", authorName: "방문자" });
    assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { database.close(); }
});

test("기존 작성자 이름, 모든 논문 값, 토론과 원본 PDF를 보존하고 인증 외래키만 제거한다", () => {
  const database = createLegacyDatabase();
  try {
    const originalPaper = { ...database.prepare("SELECT * FROM papers").get() };
    const originalComment = { ...database.prepare("SELECT * FROM comments").get() };
    const originalDocument = { ...database.prepare("SELECT * FROM paper_documents").get() };
    const originalUser = { ...database.prepare("SELECT * FROM user").get() };
    const originalAccount = { ...database.prepare("SELECT * FROM account").get() };
    assert.equal(needsPublicMigration(database), true);
    setupDatabase(database);
    setupDatabase(database);
    assert.equal(needsPublicMigration(database), false);
    assert.deepEqual({ ...database.prepare("SELECT * FROM papers").get() }, { ...originalPaper, creatorName: "기존 작성자" });
    assert.deepEqual({ ...database.prepare("SELECT * FROM comments").get() }, { ...originalComment, authorName: "기존 작성자" });
    assert.deepEqual({ ...database.prepare("SELECT * FROM paper_documents").get() }, originalDocument);
    assert.deepEqual({ ...database.prepare("SELECT * FROM user").get() }, originalUser);
    assert.deepEqual({ ...database.prepare("SELECT * FROM account").get() }, originalAccount);
    assert.deepEqual(database.prepare("PRAGMA foreign_key_list(papers)").all(), []);
    assert.equal(database.prepare("PRAGMA foreign_key_list(comments)").all().length, 1);
    assert.equal(database.prepare("PRAGMA foreign_key_list(paper_documents)").all().length, 1);
    assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(database.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='index' AND name IN ('comments_paper_idx','papers_meeting_idx')").get()?.count, 2);
    database.prepare("UPDATE user SET name=? WHERE id=?").run("변경된 계정 이름", "member-1");
    assert.equal(database.prepare("SELECT creatorName FROM papers").get()?.creatorName, "기존 작성자");
    database.prepare("INSERT INTO papers (id,title,createdAt,updatedAt) VALUES (?,?,?,?)").run("public-paper", "공개 논문", "now", "now");
    database.prepare("DELETE FROM papers WHERE id=?").run("paper-1");
    assert.equal(database.prepare("SELECT count(*) AS count FROM comments").get()?.count, 0);
    assert.equal(database.prepare("SELECT count(*) AS count FROM paper_documents").get()?.count, 0);
  } finally { database.close(); }
});

test("PDF 기능 도입 전 데이터베이스도 기존 논문을 보존하며 변환한다", () => {
  const database = createLegacyDatabase();
  try {
    database.exec("DROP TABLE paper_documents");
    setupDatabase(database);
    assert.equal(database.prepare("SELECT title FROM papers").get()?.title, "기존 논문");
    assert.equal(database.prepare("SELECT count(*) AS count FROM paper_documents").get()?.count, 0);
    assert.equal(needsPublicMigration(database), false);
  } finally { database.close(); }
});

test("연결이 깨진 자료가 있으면 변환 전체를 롤백하고 기존 데이터와 제약을 유지한다", () => {
  const database = createLegacyDatabase();
  try {
    database.exec("PRAGMA foreign_keys = OFF");
    database.prepare("UPDATE comments SET paperId=?").run("missing-paper");
    database.exec("PRAGMA foreign_keys = ON");
    assert.throws(() => setupDatabase(database), /데이터 연결 검증/);
    assert.equal(needsPublicMigration(database), true);
    assert.equal(database.prepare("PRAGMA foreign_keys").get()?.foreign_keys, 1);
    assert.equal(database.prepare("SELECT title FROM papers").get()?.title, "기존 논문");
    assert.equal(database.prepare("SELECT paperId FROM comments").get()?.paperId, "missing-paper");
    assert.equal(database.prepare("SELECT filename FROM paper_documents").get()?.filename, "기존 원본.pdf");
    assert.equal(database.prepare("SELECT name FROM sqlite_master WHERE name='migration_papers'").get(), undefined);
  } finally { database.close(); }
});
