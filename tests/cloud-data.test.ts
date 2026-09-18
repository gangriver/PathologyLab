import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../lib/api";
import { supabaseRequest } from "../lib/supabase";
import * as papers from "../lib/cloud-papers";
import * as documents from "../lib/cloud-documents";
import type { ExtractedPdf } from "../lib/document-types";
import type { PaperInput } from "../lib/validation";

test("클라우드 데이터 경계와 원자 변경 요청", async (t) => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://cloud-data-test.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_cloud-data-test";
  const calls: { url: URL; options: RequestInit }[] = [];
  let respond = async (): Promise<Response> => Response.json([]);
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, options: RequestInit = {}) => {
    calls.push({ url: new URL(String(input)), options });
    return respond();
  });
  const input: PaperInput = {
    title: "검증 논문", authors: "저자", url: "", researchQuestion: "", methods: "", findings: "", limitations: "",
    meetingDate: "", presenter: "발표자", status: "planned",
  };
  const document: documents.StoredDocument = {
    id: "document-id", paperId: "paper-id", filename: "논문.pdf", byteLength: 100,
    pageCount: 1, textCharacters: 2, uploadedAt: "2026-09-18T00:00:00.000Z",
    storageKey: "papers/paper-id/document-id.pdf", pagesJson: '[{"pageNumber":1,"text":"본문"}]',
  };
  const extracted: ExtractedPdf = {
    pages: [{ pageNumber: 1, text: "본문" }], pageCount: 1, textCharacters: 2,
    basicInfo: { title: "자동 제목", authors: "자동 저자", url: "https://doi.org/10.1000/test" },
  };
  const last = () => calls[calls.length - 1]!;
  const lastBody = () => JSON.parse(String(last().options.body)) as Record<string, unknown>;
  try {
    await t.test("서버 키는 apikey에만 전달하며 리디렉션과 응답 캐시를 사용하지 않음", async () => {
      respond = async () => Response.json([]);
      await papers.listPapers();
      const headers = new Headers(last().options.headers);
      assert.equal(headers.get("apikey"), "sb_secret_cloud-data-test");
      assert.equal(headers.get("authorization"), null);
      assert.equal(last().options.redirect, "error");
      assert.equal(last().options.cache, "no-store");
      assert.ok(last().options.signal instanceof AbortSignal);
      assert.equal(last().url.searchParams.get("order"), "meetingDate.desc,createdAt.desc");
    });
    await t.test("외부 호스트와 잘못된 키는 요청하기 전에 차단", async () => {
      const before = calls.length;
      for (const url of ["https://project.supabase.co.evil.test", "https://user@project.supabase.co", "http://project.supabase.co", "https://project.supabase.co/path", "https://project.supabase.co/?key=value"]) {
        process.env.SUPABASE_URL = url;
        await assert.rejects(papers.listPapers(), (error: unknown) => error instanceof ApiError && error.status === 503);
      }
      process.env.SUPABASE_URL = "https://cloud-data-test.supabase.co";
      process.env.SUPABASE_SECRET_KEY = "sb_publishable_test";
      await assert.rejects(papers.listPapers(), (error: unknown) => error instanceof ApiError && error.status === 503);
      process.env.SUPABASE_SECRET_KEY = "sb_secret_cloud-data-test";
      assert.equal(calls.length, before);
    });
    await t.test("네트워크 오류와 응답 오류의 내부 정보는 노출하지 않음", async () => {
      respond = async () => { throw new Error("sb_secret_cloud-data-test private endpoint"); };
      await assert.rejects(papers.listPapers(), (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 503);
        assert.ok(!error.message.includes("sb_secret"));
        return true;
      });
      respond = async () => Response.json({ message: "private SQL details sb_secret_cloud-data-test" }, { status: 500 });
      await assert.rejects(papers.listPapers(), (error: unknown) => error instanceof ApiError && error.status === 503 && !error.message.includes("private"));
      respond = async () => new Response("private invalid JSON", { status: 200 });
      await assert.rejects(papers.listPapers(), (error: unknown) => error instanceof ApiError && error.status === 502);
    });
    await t.test("행 없음·충돌·잘못된 첨부와 DB 제약 오류를 정해진 상태로 구분", async () => {
      for (const [code, status] of [["PT404", 404], ["PT409", 409], ["PT422", 422], ["23503", 404], ["23505", 409]] as const) {
        respond = async () => Response.json({ code, message: "private" }, { status });
        await assert.rejects(papers.listPapers(), (error: unknown) => error instanceof ApiError && error.status === status && !error.message.includes("private"));
      }
      respond = async () => Response.json({ code: "PT404", message: "document_not_found" }, { status: 404 });
      await assert.rejects(documents.getStoredDocument("paper-id"), (error: unknown) => error instanceof ApiError && error.message === "첨부된 PDF가 없습니다.");
    });
    await t.test("필터 값을 URL 매개변수로 전달하고 없는 논문은 undefined 반환", async () => {
      respond = async () => Response.json([]);
      const id = "id&select=storageKey";
      assert.equal(await papers.findPaper(id), undefined);
      assert.equal(last().url.searchParams.get("id"), `eq.${id}`);
      assert.ok(!last().url.searchParams.get("select")?.includes("storageKey"));
      assert.equal(last().url.searchParams.getAll("select").length, 1);
      await assert.rejects(papers.assertPaperExists(id), (error: unknown) => error instanceof ApiError && error.status === 404);
    });
    await t.test("논문 등록은 서버 발급 ID와 허용된 입력 필드만 저장", async () => {
      respond = async () => new Response(null, { status: 201 });
      const result = await papers.createPaper({ ...input, creatorName: "위조 이름", revision: 999 } as PaperInput);
      const body = lastBody();
      assert.equal(body.id, result.id);
      assert.match(result.id, /^[0-9a-f-]{36}$/);
      assert.equal(body.title, input.title);
      assert.equal(body.creatorName, undefined);
      assert.equal(body.revision, undefined);
    });
    await t.test("논문 수정과 삭제는 revision과 함께 전용 RPC에 전달", async () => {
      respond = async () => Response.json({ id: "paper-id" });
      await papers.editPaper("paper-id", input, 3);
      assert.equal(last().url.pathname, "/rest/v1/rpc/lab_edit_paper");
      assert.deepEqual(lastBody(), { p_id: "paper-id", p_input: input, p_revision: 3 });
      respond = async () => Response.json({ success: true, storageKey: document.storageKey });
      assert.deepEqual(await papers.removePaper("paper-id", 4), { success: true, storageKey: document.storageKey });
      assert.equal(last().url.pathname, "/rest/v1/rpc/lab_remove_paper");
    });
    await t.test("공개 PDF 정보에는 저장 키와 추출 본문을 조회하지 않음", async () => {
      respond = async () => Response.json([]);
      assert.equal(await documents.getDocumentInfo("paper-id"), undefined);
      assert.ok(!last().url.searchParams.get("select")?.includes("storageKey"));
      assert.ok(!last().url.searchParams.get("select")?.includes("pagesJson"));
      respond = async () => Response.json([document]);
      assert.deepEqual(await documents.getStoredDocument("paper-id"), document);
      assert.ok(last().url.searchParams.get("select")?.includes("storageKey,pagesJson"));
    });
    await t.test("PDF 등록과 교체는 전용 RPC를 사용하고 공개 반환값에서 저장 키를 분리", async () => {
      respond = async () => Response.json({ id: "paper-id" });
      assert.deepEqual(await documents.importStoredPaper(document, extracted), { id: "paper-id" });
      assert.equal(last().url.pathname, "/rest/v1/rpc/lab_import_paper");
      assert.equal((lastBody().p_input as PaperInput).title, extracted.basicInfo.title);
      assert.deepEqual(lastBody().p_document, document);
      respond = async () => Response.json({ revision: 2, previousStorageKey: "papers/old.pdf" });
      const result = await documents.replaceStoredDocument("paper-id", document, extracted, 1);
      assert.equal(last().url.pathname, "/rest/v1/rpc/lab_replace_document");
      assert.equal(lastBody().p_revision, 1);
      assert.equal(result.revision, 2);
      assert.equal(result.previousStorageKey, "papers/old.pdf");
      assert.ok(!("storageKey" in result.document));
      assert.ok(!("pagesJson" in result.document));
      assert.deepEqual(result.basicInfo, extracted.basicInfo);
    });
    await t.test("PDF 삭제와 정리 큐 삭제는 지정 키와 버전으로 처리", async () => {
      respond = async () => Response.json({ revision: 3, storageKey: document.storageKey });
      assert.deepEqual(await documents.deleteStoredDocument("paper-id", 2), { revision: 3, storageKey: document.storageKey });
      assert.equal(last().url.pathname, "/rest/v1/rpc/lab_delete_document");
      assert.deepEqual(lastBody(), { p_id: "paper-id", p_revision: 2 });
      respond = async () => new Response(null, { status: 204 });
      await supabaseRequest<void>("storage_cleanup", { method: "DELETE", query: { storageKey: `eq.${document.storageKey}` } });
      assert.equal(last().options.method, "DELETE");
      assert.equal(last().url.searchParams.get("storageKey"), `eq.${document.storageKey}`);
    });
  } finally {
    t.mock.restoreAll();
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = originalKey;
  }
});
