import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

test("로그인 없는 논문·토론 저장과 변경 요청 검증", async (t) => {
  const testRoot = resolve("work");
  mkdirSync(testRoot, { recursive: true });
  const testDirectory = mkdtempSync(resolve(testRoot, "security-"));
  process.env.DATABASE_PATH = resolve(testDirectory, "test.sqlite");
  process.env.APP_URL = "http://lab.test";
  const { db } = await import("../lib/db");
  const { setupDatabase } = await import("../lib/setup-database");
  await setupDatabase(db);
  const papers = await import("../app/api/papers/route");
  const paperRoute = await import("../app/api/papers/[id]/route");
  const comments = await import("../app/api/papers/[id]/comments/route");

  function request(path: string, method = "GET", body?: unknown, origin = "http://lab.test") {
    return new Request("http://lab.test" + path, {
      method, headers: { origin, "content-type": "application/json" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }
  const input = { title: "검증 논문", authors: "검증 저자", url: "https://example.org/paper", researchQuestion: "연구 질문", methods: "연구 방법", findings: "핵심 내용", limitations: "한계점", meetingDate: "2026-09-10", presenter: "논문 작성자", status: "planned" };
  let id = "";
  const context = () => ({ params: Promise.resolve({ id }) });

  try {
    await t.test("쿠키 없이 빈 목록 조회와 논문 등록, 상세 조회 및 파일 저장", async () => {
      const list = await papers.GET();
      assert.equal(list.status, 200);
      assert.deepEqual(await list.json(), []);
      const response = await papers.POST(request("/api/papers", "POST", { ...input, createdBy: "forged-user", creatorName: "위조 작성자" }));
      assert.equal(response.status, 201);
      id = ((await response.json()) as { id: string }).id;
      assert.ok(id);
      const detail = await paperRoute.GET(request("/api/papers/" + id), context());
      assert.equal(detail.status, 200);
      const saved = await detail.json() as { paper: { creatorName: string; limitations: string } };
      assert.ok(!("createdBy" in saved.paper));
      assert.equal(saved.paper.creatorName, "방문자");
      assert.equal(saved.paper.limitations, input.limitations);
      const secondConnection = new DatabaseSync(process.env.DATABASE_PATH!);
      try {
        assert.equal(secondConnection.prepare("SELECT title FROM papers WHERE id=?").get(id)?.title, input.title);
      } finally { secondConnection.close(); }
    });
    await t.test("외부 출처와 빈 출처의 등록·수정·삭제·토론 요청 차단", async () => {
      for (const origin of ["https://outside.test", ""]) {
        assert.equal((await papers.POST(request("/api/papers", "POST", input, origin))).status, 403);
        assert.equal((await paperRoute.PATCH(request("/api/papers/" + id, "PATCH", { ...input, revision: 1 }, origin), context())).status, 403);
        assert.equal((await paperRoute.DELETE(request("/api/papers/" + id, "DELETE", { revision: 1 }, origin), context())).status, 403);
        assert.equal((await comments.POST(request("/api/papers/" + id + "/comments", "POST", { content: "차단할 기록" }, origin), context())).status, 403);
      }
      assert.equal(db.prepare("SELECT revision FROM papers WHERE id=?").get(id)?.revision, 1);
    });
    await t.test("빈 제목, 잘못된 날짜, 실행 가능한 URL, 과도한 내용과 잘못된 JSON 거부", async () => {
      for (const patch of [{ title: "" }, { meetingDate: "2026-99-99" }, { meetingDate: "2026-02-30" }, { url: "javascript:alert(1)" }, { findings: "x".repeat(12001) }]) {
        assert.equal((await papers.POST(request("/api/papers", "POST", { ...input, ...patch }))).status, 422);
      }
      assert.equal((await papers.POST(request("/api/papers", "POST", null))).status, 422);
      const invalid = new Request("http://lab.test/api/papers", { method: "POST", headers: { origin: "http://lab.test", "content-type": "application/json" }, body: "{" });
      assert.equal((await papers.POST(invalid)).status, 400);
    });
    await t.test("인증 없는 동시 수정은 한 요청만 반영하여 이전 내용 덮어쓰기 방지", async () => {
      const results = await Promise.all([
        paperRoute.PATCH(request("/api/papers/" + id, "PATCH", { ...input, findings: "수정 A", revision: 1 }), context()),
        paperRoute.PATCH(request("/api/papers/" + id, "PATCH", { ...input, findings: "수정 B", revision: 1 }), context()),
      ]);
      assert.deepEqual(results.map(response => response.status).sort(), [200, 409]);
      assert.equal(db.prepare("SELECT revision FROM papers WHERE id=?").get(id)?.revision, 2);
    });
    await t.test("방문자 토론 저장 시 임의 회원 정보는 무시하고 빈 기록은 거부", async () => {
      const response = await comments.POST(request("/api/papers/" + id + "/comments", "POST", { content: "랩미팅 질문 <script>alert(1)</script>", authorId: "forged-user", authorName: "위조 이름" }), context());
      assert.equal(response.status, 201);
      const detail = await paperRoute.GET(request("/api/papers/" + id), context());
      const stored = await detail.json() as { comments: { authorName: string; content: string }[] };
      assert.ok(!("authorId" in stored.comments[0]));
      assert.equal(stored.comments[0].authorName, "방문자");
      assert.equal(stored.comments[0].content, "랩미팅 질문 <script>alert(1)</script>");
      assert.equal((await comments.POST(request("/api/papers/" + id + "/comments", "POST", { content: "  " }), context())).status, 422);
    });
    await t.test("기존 작성자 이름은 보존하고 내부 회원 ID는 공개 목록·상세·토론에 노출하지 않음", async () => {
      const legacyCreatorId = "legacy-paper-account-private";
      const legacyCommentId = "legacy-comment-account-private";
      db.prepare("UPDATE papers SET createdBy=?,creatorName=? WHERE id=?").run(legacyCreatorId, "기존 논문 작성자", id);
      db.prepare("UPDATE comments SET authorId=?,authorName=? WHERE paperId=?").run(legacyCommentId, "기존 토론 작성자", id);
      const list = await (await papers.GET()).json() as { creatorName: string }[];
      const detail = await (await paperRoute.GET(request("/api/papers/" + id), context())).json() as {
        paper: { creatorName: string }; comments: { authorName: string }[];
      };
      assert.equal(list[0].creatorName, "기존 논문 작성자");
      assert.equal(detail.paper.creatorName, "기존 논문 작성자");
      assert.equal(detail.comments[0].authorName, "기존 토론 작성자");
      assert.ok(!("createdBy" in list[0]));
      assert.ok(!("createdBy" in detail.paper));
      assert.ok(!("authorId" in detail.comments[0]));
      const publicData = JSON.stringify({ list, detail });
      assert.ok(!publicData.includes(legacyCreatorId));
      assert.ok(!publicData.includes(legacyCommentId));
      assert.equal(db.prepare("SELECT createdBy FROM papers WHERE id=?").get(id)?.createdBy, legacyCreatorId);
      assert.equal(db.prepare("SELECT authorId FROM comments WHERE paperId=?").get(id)?.authorId, legacyCommentId);
    });
    await t.test("누구나 논문을 삭제할 수 있고 토론도 삭제되며 이후 조회·수정·토론은 404", async () => {
      assert.equal((await paperRoute.DELETE(request("/api/papers/" + id, "DELETE", { revision: 1 }), context())).status, 409);
      assert.equal((await paperRoute.DELETE(request("/api/papers/" + id, "DELETE", { revision: 2 }), context())).status, 200);
      assert.equal((await paperRoute.GET(request("/api/papers/" + id), context())).status, 404);
      assert.equal((await paperRoute.PATCH(request("/api/papers/" + id, "PATCH", { ...input, revision: 2 }), context())).status, 404);
      assert.equal((await comments.POST(request("/api/papers/" + id + "/comments", "POST", { content: "삭제된 논문" }), context())).status, 404);
      assert.equal(db.prepare("SELECT count(*) AS count FROM comments WHERE paperId=?").get(id)?.count, 0);
    });
  } finally {
    db.close();
    if (dirname(testDirectory) !== testRoot) throw new Error("테스트 폴더 정리 경로가 올바르지 않습니다.");
    rmSync(testDirectory, { recursive: true });
  }
});
