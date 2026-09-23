import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { S3Client } from "@aws-sdk/client-s3";
import type { StoredDocument } from "../lib/cloud-documents";
import type { ExtractedPdf } from "../lib/document-types";
import type { GithubLinkSuggestions } from "../lib/github-links";

test("PDF GitHub 후보 API는 저장된 본문만 읽고 기존 자료를 변경하지 않음", async t => {
  const names = ["DATABASE_PATH", "CLOUD_STORAGE", "SUPABASE_URL", "SUPABASE_SECRET_KEY"] as const;
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const testRoot = resolve("work");
  mkdirSync(testRoot, { recursive: true });
  const testDirectory = mkdtempSync(resolve(testRoot, "github-links-api-"));
  process.env.DATABASE_PATH = resolve(testDirectory, "test.sqlite");
  process.env.CLOUD_STORAGE = "0";
  const { db } = await import("../lib/db");
  const { setupDatabase } = await import("../lib/setup-database");
  await setupDatabase(db);
  const route = await import("../app/api/papers/[id]/github-links/route");
  const documents = await import("../lib/documents");
  const extracted: ExtractedPdf = {
    pages: [{ pageNumber: 1, text: "Code: https://github.com/pathology-lab/example" }],
    pageCount: 1, textCharacters: 52, basicInfo: { title: "테스트 논문", authors: "연구자", url: "" },
  };
  const content = new TextEncoder().encode("변경되면 안 되는 원본 PDF 바이트");
  const { id: paperId } = await documents.importPaper("논문.pdf", content, extracted);
  const original = (await documents.getDocument(paperId))!;
  const context = (id = paperId) => ({ params: Promise.resolve({ id }) });
  function request(documentId: string | null = original.id, locale = "ko") {
    const url = new URL(`http://lab.test/api/papers/${paperId}/github-links`);
    if (documentId !== null) url.searchParams.set("documentId", documentId);
    return new Request(url, { headers: { cookie: `lab-locale=${locale}` } });
  }
  const errors = {
    missing: ["첨부된 PDF가 없습니다.", "No PDF is attached."],
    input: ["입력 내용을 확인해주세요.", "Please check your input."],
    changed: ["PDF가 변경되었습니다. 새로고침 후 다시 시도해주세요.", "The PDF has changed. Refresh the page and try again."],
    unreadable: ["PDF 내용을 읽지 못했습니다.", "The PDF contents could not be read."],
  } as const;
  let externalCalls = 0;
  t.mock.method(globalThis, "fetch", async () => { externalCalls++; throw new Error("외부 요청이 발생하면 안 됩니다."); });
  t.mock.method(S3Client.prototype, "send", async () => { externalCalls++; throw new Error("R2 요청이 발생하면 안 됩니다."); });
  try {
    await t.test("로컬 본문 조회는 원본 바이트를 읽지 않고 후보 조회는 논문·참고 링크·첨부를 유지", async st => {
      db.prepare("UPDATE papers SET referenceLinks=? WHERE id=?").run(JSON.stringify([{ label: "기존 자료", url: "https://example.org" }]), paperId);
      const paperBefore = db.prepare("SELECT * FROM papers WHERE id=?").get(paperId);
      const documentBefore = await documents.getDocument(paperId);
      const selects: string[] = [];
      const prepare = db.prepare.bind(db);
      st.mock.method(db, "prepare", (sql: string) => { selects.push(sql); return prepare(sql); });
      const textOnly = await documents.getDocumentText(paperId);
      assert.deepEqual(textOnly, { id: original.id, pagesJson: original.pagesJson });
      const response = await route.GET(request(), context());
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const result = await response.json() as GithubLinkSuggestions;
      assert.equal(result.documentId, original.id);
      assert.deepEqual(result.candidates.map(candidate => ({ url: candidate.url, pages: candidate.pages })), [
        { url: "https://github.com/pathology-lab/example", pages: [1] },
      ]);
      assert.ok(selects.every(sql => /^SELECT (?:id,pagesJson|id,paperId,filename,byteLength,pageCount,textCharacters,uploadedAt) FROM paper_documents WHERE paperId=\?$/.test(sql)));
      assert.deepEqual(prepare("SELECT * FROM papers WHERE id=?").get(paperId), paperBefore);
      assert.deepEqual(await documents.getDocument(paperId), documentBefore);
      assert.equal(externalCalls, 0);
    });
    await t.test("첨부 누락·잘못된 문서 ID·오래된 문서 ID는 한영 오류로 응답", async () => {
      for (const [index, locale] of ["ko", "en"].entries()) {
        for (const documentId of [null, "invalid-id"]) {
          const response = await route.GET(request(documentId, locale), context());
          assert.equal(response.status, 422);
          assert.deepEqual(await response.json(), { error: errors.input[index] });
        }
        const missing = await route.GET(request(original.id, locale), context("00000000-0000-4000-8000-000000000010"));
        assert.equal(missing.status, 404);
        assert.deepEqual(await missing.json(), { error: errors.missing[index] });
        const changed = await route.GET(request("00000000-0000-4000-8000-000000000001", locale), context());
        assert.equal(changed.status, 409);
        assert.deepEqual(await changed.json(), { error: errors.changed[index] });
      }
    });
    await t.test("깨진 JSON과 잘못된 페이지 구조는 안전한 오류로 처리", async () => {
      for (const value of ["{broken", "null", "{}", '[{"pageNumber":1,"text":7}]', '[{"pageNumber":0,"text":"본문"}]', '[{"pageNumber":101,"text":"본문"}]']) {
        db.prepare("UPDATE paper_documents SET pagesJson=? WHERE paperId=?").run(value, paperId);
        for (const [index, locale] of ["ko", "en"].entries()) {
          const response = await route.GET(request(original.id, locale), context());
          assert.equal(response.status, 422);
          assert.deepEqual(await response.json(), { error: errors.unreadable[index] });
        }
      }
      db.prepare("UPDATE paper_documents SET pagesJson=? WHERE paperId=?").run(original.pagesJson, paperId);
    });
    await t.test("GitHub 링크가 없는 본문과 추출되지 않은 빈 본문은 빈 후보로 응답", async () => {
      for (const pages of [[], [{ pageNumber: 1, text: "" }], [{ pageNumber: 1, text: "https://example.org" }]]) {
        db.prepare("UPDATE paper_documents SET pagesJson=? WHERE paperId=?").run(JSON.stringify(pages), paperId);
        const response = await route.GET(request(), context());
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { documentId: original.id, candidates: [] });
      }
      db.prepare("UPDATE paper_documents SET pagesJson=? WHERE paperId=?").run(original.pagesJson, paperId);
      assert.equal(externalCalls, 0);
    });
    await t.test("클라우드 조회는 Supabase 읽기 두 번만 사용하고 변경된 첨부의 결과는 폐기", async cloud => {
      process.env.CLOUD_STORAGE = "1";
      process.env.SUPABASE_URL = "https://github-links-test.supabase.co";
      process.env.SUPABASE_SECRET_KEY = "sb_secret_github-links-test";
      const stored: StoredDocument = { ...original, storageKey: `papers/${original.id}.pdf` };
      const calls: URL[] = [];
      let nextDocument: StoredDocument | undefined = stored;
      let fail = false;
      cloud.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : input.toString());
        calls.push(url);
        assert.equal(url.origin, "https://github-links-test.supabase.co");
        assert.equal(url.pathname, "/rest/v1/paper_documents");
        assert.equal(init?.method, "GET");
        assert.equal(init?.body, undefined);
        assert.equal(url.searchParams.get("paperId"), `eq.${paperId}`);
        assert.equal(url.searchParams.get("limit"), "1");
        const columns = url.searchParams.get("select")!.split(",");
        assert.ok(!columns.includes("content") && !columns.includes("storageKey"));
        if (fail) throw new Error("private database error");
        const document = columns.includes("pagesJson") ? stored : nextDocument;
        if (!document) return Response.json([]);
        const row = document as unknown as Record<string, unknown>;
        return Response.json([Object.fromEntries(columns.map(column => [column, row[column]]))]);
      });
      const before = structuredClone(stored);
      const response = await route.GET(request(), context());
      assert.equal(response.status, 200);
      assert.equal(calls.length, 2);
      assert.equal(calls[0].searchParams.get("select"), "id,pagesJson");
      assert.ok(!calls[1].searchParams.get("select")!.includes("pagesJson"));
      assert.deepEqual(stored, before);
      assert.doesNotMatch(await response.text(), /storageKey|pagesJson|content|sb_secret/);
      for (const document of [{ ...stored, id: "00000000-0000-4000-8000-000000000002" }, undefined]) {
        nextDocument = document;
        for (const [index, locale] of ["ko", "en"].entries()) {
          const changed = await route.GET(request(original.id, locale), context());
          assert.equal(changed.status, 409);
          assert.deepEqual(await changed.json(), { error: errors.changed[index] });
        }
      }
      fail = true;
      const failed = await route.GET(request(original.id, "en"), context());
      assert.equal(failed.status, 503);
      assert.deepEqual(await failed.json(), { error: "The database could not be reached. Please try again shortly." });
      assert.equal(externalCalls, 0);
    });
  } finally {
    db.close();
    delete (globalThis as typeof globalThis & { labDatabase?: unknown }).labDatabase;
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
    if (dirname(testDirectory) !== testRoot) throw new Error("테스트 폴더 정리 경로가 올바르지 않습니다.");
    rmSync(testDirectory, { recursive: true });
  }
});
