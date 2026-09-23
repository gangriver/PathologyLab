import { test } from "node:test";
import assert from "node:assert/strict";
import { DeleteObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import type { StoredDocument } from "../lib/cloud-documents";
import type { Paper } from "../lib/types";
import { makePdf } from "./pdf-fixture";

test("클라우드 논문 API와 PDF 저장 경로의 연결", async t => {
  const names = ["DATABASE_PATH", "APP_URL", "CLOUD_STORAGE", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const;
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  delete process.env.DATABASE_PATH;
  process.env.APP_URL = "http://lab.test";
  process.env.CLOUD_STORAGE = "1";
  process.env.SUPABASE_URL = "https://cloud-route-test.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test-only";
  process.env.R2_ACCOUNT_ID = "a".repeat(32);
  process.env.R2_BUCKET_NAME = "test-papers";
  process.env.R2_ACCESS_KEY_ID = "test-access-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
  const fixture = makePdf(["We evaluated cell classification using an independent validation set."], { title: "Cloud Pathology Study", author: "Test Researcher" });
  const paper: Paper = {
    id: "06a790f3-d963-45b8-8720-5bcb2b7f2275", title: "기존 논문", subtitle: "PICASSO", authors: "기존 저자", url: "", referenceLinks: [],
    researchQuestion: "", methods: "", findings: "", limitations: "", meetingDate: "", presenter: "발표자", status: "planned",
    creatorName: "방문자", createdAt: "2026-09-18T00:00:00.000Z", updatedAt: "2026-09-18T00:00:00.000Z", revision: 1,
  };
  const originalDocument: StoredDocument = {
    id: "a88cd7ac-568e-4b3d-b95f-3cd6763ce913", paperId: paper.id, filename: "기존 논문.pdf",
    storageKey: "papers/a88cd7ac-568e-4b3d-b95f-3cd6763ce913.pdf", byteLength: fixture.byteLength,
    pageCount: 1, textCharacters: 10, pagesJson: JSON.stringify([{ pageNumber: 1, text: "기존 본문" }]), uploadedAt: paper.createdAt,
  };
  const files = new Map<string, Uint8Array>();
  const puts: PutObjectCommand[] = [];
  const deletions: string[] = [];
  const calls: { resource: string; method: string; body: Record<string, unknown> }[] = [];
  const events: string[] = [];
  let failStagingCleanup = false;
  let respondRpc: (resource: string, body: Record<string, unknown>) => Response;
  function reset() {
    files.clear(); files.set(originalDocument.storageKey, fixture);
    puts.length = 0; deletions.length = 0; calls.length = 0; events.length = 0;
    failStagingCleanup = false;
    respondRpc = (resource, body) => {
      if (resource === "rpc/lab_import_paper") return Response.json({ id: (body.p_document as StoredDocument).paperId });
      if (resource === "rpc/lab_replace_document") return Response.json({ revision: 2, previousStorageKey: originalDocument.storageKey });
      if (resource === "rpc/lab_delete_document") return Response.json({ revision: 2, storageKey: originalDocument.storageKey });
      if (resource === "rpc/lab_remove_paper") return Response.json({ success: true, storageKey: originalDocument.storageKey });
      throw new Error("예상하지 않은 RPC입니다.");
    };
  }
  function request(method: string, body?: unknown, origin = "http://lab.test") {
    return new Request("http://lab.test/api/papers/" + paper.id, {
      method, headers: { origin, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  const context = () => ({ params: Promise.resolve({ id: paper.id }) });
  try {
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.hostname === `${"a".repeat(32)}.r2.cloudflarestorage.com`) {
        assert.equal(init?.redirect, "error");
        const key = decodeURIComponent(url.pathname.slice("/test-papers/".length));
        const content = files.get(key);
        return content ? new Response(new Uint8Array(content)) : new Response(null, { status: 404 });
      }
      assert.equal(url.hostname, "cloud-route-test.supabase.co");
      assert.equal(new Headers(init?.headers).get("apikey"), "sb_secret_test-only");
      const resource = url.pathname.slice("/rest/v1/".length);
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : {};
      calls.push({ resource, method, body });
      if (resource === "storage_cleanup") {
        if (method === "POST") { events.push(`queue:${String(body.storageKey)}`); return new Response(null, { status: 204 }); }
        assert.equal(method, "GET");
        return Response.json([]);
      }
      if (resource === "papers" && method === "GET") return Response.json([paper]);
      if (resource === "comments" && method === "GET") return Response.json([]);
      if (resource === "paper_documents" && method === "GET") {
        const columns = (url.searchParams.get("select") ?? "").split(",");
        const row = originalDocument as unknown as Record<string, unknown>;
        return Response.json([Object.fromEntries(columns.map(column => [column, row[column]]))]);
      }
      if (resource.startsWith("rpc/") && method === "POST") {
        events.push(resource);
        return respondRpc(resource, body);
      }
      throw new Error("예상하지 않은 데이터베이스 요청입니다.");
    });
    t.mock.method(S3Client.prototype, "send", async (command: unknown) => {
      if (command instanceof PutObjectCommand) {
        const { Key, Body, ContentLength, ContentType, IfNoneMatch } = command.input;
        assert.ok(Key && Body instanceof Uint8Array);
        assert.equal(ContentLength, Body.byteLength);
        assert.equal(ContentType, "application/pdf");
        assert.equal(IfNoneMatch, "*");
        if (files.has(Key)) throw new S3ServiceException({ name: "PreconditionFailed", $fault: "client", $metadata: { httpStatusCode: 412 } });
        puts.push(command); files.set(Key, new Uint8Array(Body)); events.push(`put:${Key}`);
        return { $metadata: { httpStatusCode: 200 } };
      }
      if (command instanceof DeleteObjectCommand) {
        const key = command.input.Key;
        assert.ok(key);
        deletions.push(key);
        if (failStagingCleanup && key.startsWith("staging/")) throw new Error("test-secret-key");
        files.delete(key);
        return { $metadata: { httpStatusCode: 204 } };
      }
      throw new Error("예상하지 않은 저장소 요청입니다.");
    });
    const imports = await import("../app/api/papers/import/route");
    const pdfRoute = await import("../app/api/papers/[id]/pdf/route");
    const paperRoute = await import("../app/api/papers/[id]/route");
    const tickets = await import("../app/api/papers/uploads/route");
    const { getDocumentInfo } = await import("../lib/documents");
    async function uploadTicket(filename = "연구 논문.pdf") {
      const response = await tickets.POST(request("POST", { filename, byteLength: fixture.byteLength }));
      assert.equal(response.status, 201);
      const ticket = await response.json() as { uploadToken: string; uploadUrl: string };
      const stagingKey = decodeURIComponent(new URL(ticket.uploadUrl).pathname.slice("/test-papers/".length));
      files.set(stagingKey, fixture);
      return { ...ticket, stagingKey, uploadId: stagingKey.slice("staging/".length, -4) };
    }
    await t.test("SQLite 설정 없이 티켓과 실제 PDF 추출을 거쳐 새 객체·RPC·공개 ID를 연결", async () => {
      reset();
      assert.equal(process.env.DATABASE_PATH, undefined);
      const ticket = await uploadTicket();
      const response = await imports.POST(request("POST", { uploadToken: ticket.uploadToken }));
      assert.equal(response.status, 201);
      assert.deepEqual(await response.json(), { id: ticket.uploadId });
      const rpc = calls.find(call => call.resource === "rpc/lab_import_paper");
      assert.ok(rpc);
      const document = rpc.body.p_document as StoredDocument;
      const input = rpc.body.p_input as Record<string, unknown>;
      assert.equal(document.paperId, ticket.uploadId);
      assert.equal(document.filename, "연구 논문.pdf");
      assert.equal(document.pageCount, 1);
      assert.match(document.pagesJson, /independent validation set/);
      assert.equal(input.title, "Cloud Pathology Study");
      assert.equal(input.subtitle, "");
      assert.equal(input.authors, "Test Researcher");
      assert.match(document.storageKey, /^papers\/[0-9a-f-]{36}\.pdf$/);
      assert.deepEqual(events.slice(0, 3), [`queue:${document.storageKey}`, `put:${document.storageKey}`, "rpc/lab_import_paper"]);
      assert.deepEqual(files.get(document.storageKey), fixture);
      assert.deepEqual(deletions, [ticket.stagingKey]);
    });
    await t.test("공개 논문 조회와 첨부 정보는 내부 경로를 숨기고 PDF는 서명 주소로 이동", async () => {
      reset();
      const response = await paperRoute.GET(request("GET"), context());
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { paper, comments: [] });
      const info = await getDocumentInfo(paper.id);
      assert.ok(info);
      assert.ok(!("storageKey" in info) && !("pagesJson" in info));
      const download = await pdfRoute.GET(request("GET"), context());
      assert.equal(download.status, 307);
      assert.equal(download.headers.get("Cache-Control"), "private, no-store");
      assert.equal(download.headers.get("Referrer-Policy"), "no-referrer");
      const url = new URL(download.headers.get("Location") ?? "");
      assert.equal(url.pathname, `/test-papers/${originalDocument.storageKey}`);
      assert.ok(url.searchParams.has("X-Amz-Signature"));
      assert.equal(puts.length, 0);
      assert.equal(deletions.length, 0);
    });
    await t.test("부제목 수정은 공백을 정리해 RPC로 전달하고 누락한 필드는 임의로 비우지 않음", async () => {
      reset();
      respondRpc = resource => {
        assert.equal(resource, "rpc/lab_edit_paper");
        return Response.json({ id: paper.id });
      };
      for (const subtitle of ["  STORM  ", "   ", undefined]) {
        const response = await paperRoute.PATCH(request("PATCH", { ...paper, subtitle }), context());
        assert.equal(response.status, 200);
        const rpc = calls.at(-1)!;
        assert.equal(rpc.resource, "rpc/lab_edit_paper");
        assert.equal(rpc.body.p_revision, 1);
        const input = rpc.body.p_input as Record<string, unknown>;
        assert.equal(input.subtitle, subtitle?.trim());
        assert.equal("subtitle" in input, subtitle !== undefined);
      }
    });
    await t.test("PDF 교체는 기존 버전을 RPC에 전달하고 새 버전과 공개 첨부 정보만 반환", async () => {
      reset();
      const ticket = await uploadTicket("교체 논문.pdf");
      const response = await pdfRoute.POST(request("POST", { uploadToken: ticket.uploadToken, revision: 1 }), context());
      assert.equal(response.status, 200);
      const result = await response.json() as { document: Record<string, unknown>; revision: number; basicInfo: { title: string } };
      assert.equal(result.revision, 2);
      assert.equal(result.document.filename, "교체 논문.pdf");
      assert.equal(result.basicInfo.title, "Cloud Pathology Study");
      assert.ok(!JSON.stringify(result).includes("storageKey") && !JSON.stringify(result).includes("StorageKey") && !JSON.stringify(result).includes("pagesJson"));
      const rpc = calls.find(call => call.resource === "rpc/lab_replace_document");
      assert.equal(rpc?.body.p_id, paper.id);
      assert.equal(rpc?.body.p_revision, 1);
      assert.notEqual((rpc?.body.p_document as StoredDocument).storageKey, originalDocument.storageKey);
      assert.deepEqual(files.get(originalDocument.storageKey), fixture);
      assert.deepEqual(deletions, [ticket.stagingKey]);
    });
    await t.test("DB 버전 충돌 때 기존 PDF는 유지하고 새 객체는 정리 큐에 남김", async () => {
      reset();
      respondRpc = () => Response.json({ code: "PT409", message: "revision_conflict" }, { status: 409 });
      const ticket = await uploadTicket();
      const response = await pdfRoute.POST(request("POST", { uploadToken: ticket.uploadToken, revision: 1 }), context());
      assert.equal(response.status, 409);
      assert.equal(puts.length, 1);
      const failedKey = puts[0].input.Key;
      assert.ok(calls.some(call => call.resource === "storage_cleanup" && call.method === "POST" && call.body.storageKey === failedKey));
      assert.ok(!deletions.includes(originalDocument.storageKey));
      assert.deepEqual(files.get(originalDocument.storageKey), fixture);
      assert.deepEqual(deletions, [ticket.stagingKey]);
    });
    await t.test("같은 티켓의 등록 재시도는 다른 영구 키를 쓰고 중복 거부 시 첫 PDF를 보존", async () => {
      reset();
      let registered = false;
      respondRpc = (_resource, body) => {
        if (registered) return Response.json({ code: "23505", message: "duplicate" }, { status: 409 });
        registered = true;
        return Response.json({ id: (body.p_document as StoredDocument).paperId });
      };
      const ticket = await uploadTicket();
      assert.equal((await imports.POST(request("POST", { uploadToken: ticket.uploadToken }))).status, 201);
      const firstKey = puts[0].input.Key;
      assert.ok(firstKey);
      files.set(ticket.stagingKey, fixture);
      assert.equal((await imports.POST(request("POST", { uploadToken: ticket.uploadToken }))).status, 409);
      assert.equal(puts.length, 2);
      assert.notEqual(puts[1].input.Key, firstKey);
      assert.deepEqual(files.get(firstKey), fixture);
      assert.ok(!deletions.includes(firstKey));
    });
    await t.test("임시 PDF 정리가 실패해도 완료된 논문 등록은 성공으로 반환", async st => {
      reset();
      failStagingCleanup = true;
      const warnings: unknown[][] = [];
      st.mock.method(console, "warn", (...values: unknown[]) => { warnings.push(values); });
      const ticket = await uploadTicket();
      const response = await imports.POST(request("POST", { uploadToken: ticket.uploadToken }));
      assert.equal(response.status, 201);
      assert.deepEqual(await response.json(), { id: ticket.uploadId });
      assert.equal(warnings.length, 1);
      assert.ok(!JSON.stringify(warnings).includes("test-secret-key"));
    });
    await t.test("출처 위조와 잘못된 수정 버전은 영구 저장 및 DB 변경 전에 차단", async () => {
      reset();
      const ticket = await uploadTicket();
      const foreign = await imports.POST(request("POST", { uploadToken: ticket.uploadToken }, "https://outside.test"));
      assert.equal(foreign.status, 403);
      const invalid = await pdfRoute.POST(request("POST", { uploadToken: ticket.uploadToken, revision: 0 }), context());
      assert.equal(invalid.status, 422);
      assert.equal(puts.length, 0);
      assert.equal(calls.filter(call => call.method !== "GET").length, 0);
    });
    await t.test("PDF와 논문 삭제는 버전을 전달하고 내부 저장 경로를 응답에서 제거", async () => {
      reset();
      const pdf = await pdfRoute.DELETE(request("DELETE", { revision: 1 }), context());
      assert.equal(pdf.status, 200);
      assert.deepEqual(await pdf.json(), { revision: 2 });
      const removed = await paperRoute.DELETE(request("DELETE", { revision: 1 }), context());
      assert.equal(removed.status, 200);
      assert.deepEqual(await removed.json(), { success: true });
      for (const resource of ["rpc/lab_delete_document", "rpc/lab_remove_paper"]) {
        const rpc = calls.find(call => call.resource === resource);
        assert.deepEqual(rpc?.body, { p_id: paper.id, p_revision: 1 });
      }
      assert.equal(deletions.length, 0);
    });
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
